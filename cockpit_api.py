"""cockpit_api.py — endpoints "AI Cockpit" do BFF (montados em :8782 pelo server.py).

O BFF é o PONTO ÚNICO de integração: o frontend React fala só com /api/*; quem conversa
com modelos locais (Ollama :11434), com o estúdio espelhado por ARQUIVO (studio_mirror —
o :8781 deixou de ser dependência) e com o "agent runner" é aqui. O frontend NUNCA chama
Ollama direto.

Endpoints:
    GET  /api/status                  saúde (motor por arquivo + ollama)
    GET  /api/models                  modelos do Ollama (/api/tags)
    POST /api/models/chat             chat com um modelo (proxy p/ Ollama /api/chat)
    GET  /api/state                   estado do estúdio (studio_mirror — por ARQUIVO)
    GET  /api/kgraph                  mapa de conhecimento (tools/vitrine/kgraph.json)
    GET  /api/consult/*               consult GPT (arquivos de .ai_bridge/interior_consult)
    GET  /img/* /inbox-img/*          imagens de render/inbox (bytes do disco, com guard)
    GET  /api/agents                  agentes (derivado do state espelhado)
    POST /api/agents/<id>/run         dispara um run do agente (runner stub)
    GET  /api/runs                     histórico de runs
    GET  /api/runs/<id>                detalhe (steps, inputs/outputs, artifacts)
    GET  /api/runs/<id>/logs           logs — SSE (text/event-stream) ou JSON
    GET  /api/artifacts                artifacts (derivado de renders/refpack)
    GET  /api/decisions                decisões pendentes (propostas + visual review)
    POST /api/decisions/<id>/respond   responde uma decisão (proxy p/ /api/proposal)
    GET  /api/workflows                workflows/recipes (derivado do ciclo + pipeline)
    POST /api/workflows/<id>/run       dispara um run de workflow (runner stub)

O "runner" aqui é um STUB que simula o ciclo de um run (steps + logs ao vivo) — é o ponto
de plugue onde um runner real de agents/workflows entra. O chat com Ollama é REAL.
stdlib only.
"""
from __future__ import annotations

import json
import os
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import file_activity as fa  # Live System Map — eventos de atividade + scanner dos repos
import noc_mirror as noc  # NOC mirror — le os arquivos planos do atuador (vidro read-only)
import bridge_mirror as bridge  # ORACULO/:8765 mirror — audit/sessoes/git/skp por arquivo (vidro)
import studio_mirror as studio  # ESTUDIO/:8781 mirror — o /api/state inteiro por arquivo (vidro)
import curation_mirror as curation  # CURADORIA — corpus julgado do sweep + veredito humano
import decision_history_mirror as decision_history  # CARTEIRO — audit das decisões objetivas (vidro)

OLLAMA = os.environ.get("BFF_OLLAMA", "http://127.0.0.1:11434").rstrip("/")
MAX_BODY = 1 << 20  # 1 MiB — teto de corpo de POST (anti-DoS)
# modo MOCK do /api/state (migrou do proxy do server.py — o dispatch nativo o sombrearia)
_MOCK = os.environ.get("BFF_MOCK", "") not in ("", "0", "false", "False")
_MOCKS_DIR = Path(__file__).resolve().parent / "mocks"

_LOCK = threading.Lock()
RUNS: dict[str, dict] = {}
_SEEDED = False
_run_seq = 0

# ── throttle de instrumentação (não floodar o timeline com polling de fundo) ──
_emit_at: dict[str, float] = {}


def _gate(key: str, interval: float) -> bool:
    """True se já passou `interval`s desde o último emit dessa chave (inclua o
    estado na chave p/ transições sempre dispararem)."""
    now = time.time()
    if now - _emit_at.get(key, 0.0) >= interval:
        _emit_at[key] = now
        return True
    return False


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _gen_id(prefix: str) -> str:
    global _run_seq
    with _LOCK:
        _run_seq += 1
        n = _run_seq
    return f"{prefix}-{int(time.time())%100000:05d}-{n:03d}"


# ── estado do estúdio (studio_mirror — por ARQUIVO; era GET :8781/api/state) ──
_state_cache = {"t": 0.0, "v": None}


def _upstream_state() -> dict:
    """Mesmo nome/assinatura/cache de antes — o corpo trocou o GET :8781 pelo
    studio_mirror.state_view() (leitura de arquivo). Os _derive_* não mudam."""
    if _state_cache["v"] is not None and time.time() - _state_cache["t"] < 2.0:
        return _state_cache["v"]
    try:
        v = studio.state_view()
        if not fa.ENGINE_ROOT.is_dir():
            # views degradam pra coleções vazias sem levantar — sucesso aqui seria fabricado
            if _gate("up:err", 6.0):
                fa.emit("sketchup-mcp/.ai_bridge/", "error", "bff", repo="sketchup-mcp",
                        status="error", endpoint="/api/state",
                        label="motor ilegível (ENGINE_ROOT ausente) — state degradado")
        elif _gate("up:ok", 8.0):
            fa.emit("sketchup-mcp/.ai_bridge/", "read", "bff", repo="sketchup-mcp",
                    endpoint="/api/state", label="read state (studio_mirror, por arquivo)")
    except Exception:  # noqa: BLE001 — arquivo do motor corrompido/ausente não derruba o BFF
        v = {}
        if _gate("up:err", 6.0):
            fa.emit("sketchup-mcp/.ai_bridge/", "error", "bff", repo="sketchup-mcp",
                    status="error", endpoint="/api/state",
                    label="studio_mirror falhou ao ler o motor (ENGINE_ROOT?)")
    _state_cache.update(t=time.time(), v=v)
    return v


# ── ollama (modelos locais) — REAL ───────────────────────────────────────────
def _ollama_get(path: str, timeout: float = 4.0):
    try:
        with urlopen(OLLAMA + path, timeout=timeout) as r:
            data = json.loads(r.read())
        if _gate("oll:ok", 8.0):
            fa.emit(f"ollama:{path}", "proxy", "ollama", repo="external",
                    endpoint=path, label=f"Ollama {path} (online)")
        return data
    except (URLError, HTTPError, OSError, json.JSONDecodeError):
        if _gate("oll:err", 6.0):
            fa.emit(f"ollama:{path}", "error", "ollama", repo="external", status="error",
                    endpoint=path, label=f"Ollama {path} offline")
        return None


def _is_embedding_model(name: str, family: str) -> bool:
    """Modelo de EMBEDDING (ex. nomic-embed-text, família bert) vetoriza texto pro
    RAG — o /api/chat do Ollama devolve HTTP 400 pra ele. Detectar aqui evita o
    erro seco na tela de modelos (bug real: Felipe clicou e levou 'ollama HTTP 400')."""
    n, f = (name or "").lower(), (family or "").lower()
    return "embed" in n or "bert" in f


def _ollama_models() -> dict:
    data = _ollama_get("/api/tags")
    if data is None:
        return {"ok": False, "source": "none", "models": [],
                "hint": f"Ollama não acessível em {OLLAMA}. Suba com `ollama serve`."}
    out = []
    for m in data.get("models", []):
        det = m.get("details", {}) or {}
        name, family = m.get("name"), det.get("family")
        out.append({"name": name, "family": family,
                    "sizeBytes": m.get("size"), "parameterSize": det.get("parameter_size"),
                    "quantization": det.get("quantization_level"),
                    "modifiedAt": m.get("modified_at"),
                    "chat": not _is_embedding_model(name, family)})
    return {"ok": True, "source": "ollama", "models": out}


def _ollama_chat(body: dict) -> tuple[int, dict]:
    model = (body or {}).get("model")
    messages = (body or {}).get("messages")
    if not isinstance(model, str) or not model.strip():
        return 400, {"ok": False, "error": "model (string) obrigatório"}
    if not isinstance(messages, list) or not messages:
        return 400, {"ok": False, "error": "messages (lista) obrigatório"}
    if _is_embedding_model(model, ""):
        return 400, {"ok": False, "error": "modelo de embedding não conversa",
                     "hint": f"{model} vetoriza texto pro RAG (project_memory_db) — "
                             "não suporta chat. Escolha um modelo de geração "
                             "(qwen2.5-coder, llama3.1, deepseek-r1…)."}
    payload = json.dumps({"model": model, "messages": messages, "stream": False}).encode()
    req = Request(OLLAMA + "/api/chat", data=payload,
                  headers={"Content-Type": "application/json"}, method="POST")
    t0 = time.time()
    fa.emit("ollama:/api/chat", "execute", "ollama", repo="external", endpoint="/api/chat",
            label=f"chat → {model}")  # ação do usuário: sempre registra
    try:
        with urlopen(req, timeout=120) as r:
            data = json.loads(r.read())
    except HTTPError as e:
        fa.emit("ollama:/api/chat", "error", "ollama", repo="external", status="error",
                endpoint="/api/chat", label=f"chat {model} HTTP {e.code}")
        # repassa o MOTIVO do Ollama (ex. "does not support chat") — "HTTP 400"
        # seco não diz nada pra quem está na tela.
        detail = ""
        try:
            detail = (json.loads(e.read()) or {}).get("error", "")
        except (OSError, ValueError):
            pass
        return e.code, {"ok": False, "error": f"ollama HTTP {e.code}",
                        **({"detail": detail} if detail else {})}
    except (URLError, OSError) as e:
        fa.emit("ollama:/api/chat", "error", "ollama", repo="external", status="error",
                endpoint="/api/chat", label=f"chat {model} indisponível")
        return 503, {"ok": False, "error": "ollama_unreachable", "detail": str(e),
                     "hint": f"Suba o Ollama em {OLLAMA}."}
    msg = data.get("message") or {"role": "assistant", "content": ""}
    return 200, {"ok": True, "model": model, "message": msg,
                 "tookMs": int((time.time() - t0) * 1000)}


# ── derivações do /api/state ─────────────────────────────────────────────────
_AGENT_META = {
    "interior-pm": ("PM", "llama3.1:8b", ["coordenar", "backlog"]),
    "interior-orchestrator": ("Team Lead", "qwen2.5-coder:7b", ["consult-local", "cycle", "gates"]),
    "interior-designer": ("Arquiteto", "deepseek-r1:14b", ["program", "consult-gpt", "visão"]),
    "ollama-llama": ("LLM", "llama3.1:8b", ["chat"]),
    "ollama-qwen": ("LLM", "qwen2.5-coder:7b", ["code"]),
    "ollama-deepseek": ("LLM", "deepseek-r1:14b", ["reason"]),
    "gpt-visual": ("Visão", "gpt-4o", ["vision", "judge"]),
}

# Time canônico do estúdio (líderes) — SEMPRE presente, mesmo sem o state espelhado.
_CANONICAL_TEAM = [
    ("interior-pm", "PM Orquestrador"),
    ("interior-orchestrator", "Team Lead"),
    ("interior-designer", "Arquiteto"),
]


def _canonical_agents() -> list[dict]:
    """Fallback quando o state espelhado não dá agentes: mostra o time canônico com
    status REAL — cada agente fica 'online' se o modelo dele estiver vivo no Ollama."""
    tags = _ollama_get("/api/tags", timeout=2.0) or {}
    full = {m.get("name", "") for m in tags.get("models", []) or []}
    base = {n.split(":")[0] for n in full}
    out = []
    for aid, name in _CANONICAL_TEAM:
        role, model, tools = _AGENT_META.get(aid, (name, None, ["chat"]))
        ready = bool(model) and (model in full or model.split(":")[0] in base)
        out.append({"id": aid, "name": name, "role": role, "umbrella": "Interior Studio",
                    "status": "online" if ready else "idle", "online": ready,
                    "model": model, "tools": tools,
                    "message": (f"modelo {model} pronto no Ollama — pode rodar" if ready
                                else f"modelo {model} ausente no Ollama" if model else None),
                    "source": "canonical"})
    return out


def _derive_agents(state: dict) -> list[dict]:
    out = []
    if _gate("derive:agents", 4.0):
        fa.emit("sketchup-mcp-bff/cockpit_api.py", "execute", "bff", endpoint="/api/agents",
                label="derive agents (de /api/state)")
    for u in (state.get("agents", {}) or {}).get("umbrellas", []) or []:
        for card in [u.get("lead")] + (u.get("subs") or []):
            if not card:
                continue
            aid = card.get("id", "")
            role, model, tools = _AGENT_META.get(aid, (u.get("label", "agent"), None, ["chat"]))
            # normaliza o status legado para o union do contrato {idle,working,error,online}
            raw = str(card.get("status") or "idle").lower()
            st = ("working" if raw in ("working", "thinking", "running")
                  else "error" if raw in ("error", "blocked", "fail") else "idle")
            if st == "idle" and card.get("online"):
                st = "online"
            out.append({"id": aid, "name": card.get("label", aid), "role": role,
                        "umbrella": u.get("label", ""), "status": st, "model": model,
                        "online": bool(card.get("online")), "tools": tools,
                        "message": None if card.get("message") in (None, "—") else card.get("message")})
    # sem state espelhado (ou sem agentes nele) → time canônico com status real do Ollama
    return out or _canonical_agents()


def _derive_workflows(state: dict) -> list[dict]:
    if _gate("derive:workflows", 4.0):
        fa.emit("sketchup-mcp-bff/cockpit_api.py", "execute", "bff", endpoint="/api/workflows",
                label="derive workflows (de /api/state)")
    ov = (state.get("overview", {}) or {}).get("active_focuses") or [{}]
    pipe = (ov[0] or {}).get("pipeline") or []
    fac = state.get("factory", {}) or {}
    risks = ((state.get("learning", {}) or {}).get("anti_patterns") or [])[:3]
    steps = [{"key": re.sub(r"\W+", "-", (p.get("label") or "").lower()).strip("-"),
              "label": p.get("label"), "icon": p.get("icon"),
              "status": ("done" if "done" in str(p.get("status", "")).lower() else
                         "doing" if p is pipe[min(len(pipe) - 1, sum(1 for x in pipe if "done" in str(x.get("status", "")).lower()))] else "pending")}
             for p in pipe]
    main = {"id": "cycle-fidelity", "name": fac.get("title") or "Ciclo de fidelidade do asset",
            "description": "Leva um asset de referência → curadoria → build → render V-Ray validado.",
            "whenToUse": "Quando um asset precisa avançar no pipeline de fidelidade do cômodo.",
            "status": "running" if fac.get("has_cycle") else "idle", "steps": steps,
            "tools": ["interior-designer", "consult-gpt", "vray"],
            "inputs": ["Reference Pack", "planta (PDF)"], "outputs": ["render V-Ray", "SKP"],
            "risks": risks, "lastRunId": None}
    canned = [
        {"id": "curate-refpack", "name": "Curadoria de Reference Pack",
         "description": "Cura referências visuais em um pack aprovado (principal/anti).",
         "whenToUse": "Ao receber novas referências de um asset.", "status": "idle",
         "steps": [{"key": "ingest", "label": "Ingerir", "status": "done"},
                   {"key": "judge", "label": "Julgar", "status": "doing"},
                   {"key": "approve", "label": "Aprovar", "status": "pending"}],
         "tools": ["reference-scout", "gpt-visual"], "inputs": ["links/imagens"],
         "outputs": ["pack curado"], "risks": ["copiar imagem em vez de extrair gramática"]},
        {"id": "render-vray", "name": "Render V-Ray",
         "description": "Renderiza o asset montado na planta e valida com o juiz visual.",
         "whenToUse": "Quando forma + contexto foram aprovados.", "status": "idle",
         "steps": [{"key": "camera", "label": "Câmera", "status": "pending"},
                   {"key": "render", "label": "Render", "status": "pending"},
                   {"key": "judge", "label": "Veredito", "status": "pending"}],
         "tools": ["vray", "gpt-visual"], "inputs": ["SKP montado"], "outputs": ["PNG"],
         "risks": ["piso preto default", "eletro escuro que some no fundo"]},
    ]
    return [main] + canned


def _derive_decisions(state: dict) -> list[dict]:
    out = []
    if _gate("derive:decisions", 4.0):
        fa.emit("sketchup-mcp-bff/cockpit_api.py", "execute", "bff", endpoint="/api/decisions",
                label="derive decisions (propostas + visual review)")
    for p in (state.get("proposals", {}) or {}).get("pending", []) or []:
        # items reais podem ser dicts ({asset:...}) OU strings (gaps do Auditor)
        items = ", ".join(i.get("asset", "") if isinstance(i, dict) else str(i)
                          for i in (p.get("items") or [])[:4])
        out.append({"id": p.get("id"), "type": "program_proposal",
                    "title": f"Programa · {p.get('room_name', p.get('room_id', ''))}",
                    "question": f"Aprovar o programa proposto ({items})?",
                    "options": ["Aprovar", "Rejeitar"], "status": "pending",
                    "source": p.get("source_worker") or "Arquiteto", "createdAt": _now()})
    consult = state.get("consult", {}) or {}
    if consult.get("status") == "waiting_gpt_answer":
        out.append({"id": "visual-review", "type": "visual_review",
                    "title": "Veredito visual (Consult GPT)",
                    "question": "A aparência melhorou vs o PDF?",
                    "options": ["IMPROVED", "SAME", "WORSE"], "status": "pending",
                    "source": "Consult GPT", "createdAt": _now()})
    return out


def _derive_artifacts(state: dict) -> list[dict]:
    out = []
    if _gate("derive:artifacts", 4.0):
        fa.emit("sketchup-mcp-bff/cockpit_api.py", "execute", "bff", endpoint="/api/artifacts",
                label="derive artifacts (renders + refpack)")
    for r in (state.get("renders") or [])[:40]:
        name = r.get("name", "")
        # cada render é um artifact do motor — registra no mapa para aparecer "tocado"
        if name and _gate("art:" + name, 30.0):
            fa.emit(f"sketchup-mcp/artifacts/{name}", "read", "bff", repo="sketchup-mcp",
                    label="artifact render listado")
        out.append({"id": re.sub(r"\W+", "-", name.lower()).strip("-") or name,
                    "type": "render", "name": r.get("sub") or name, "path": name,
                    "url": "/img/" + name, "sizeKb": r.get("kb"),
                    "createdAt": datetime.fromtimestamp(r["mtime"], timezone.utc).isoformat()
                    if r.get("mtime") else None})
    rp = state.get("refpack", {}) or {}
    if rp.get("references"):
        out.append({"id": "refpack-" + str(rp.get("asset", "pack")), "type": "json",
                    "name": f"Reference Pack · {rp.get('theme', '')}", "path": "refpack.json",
                    "sizeKb": None, "createdAt": _now()})
    return out


def _status() -> dict:
    # `upstream` mantido no SHAPE (types.ts intocado); semântica nova = "motor legível
    # por ARQUIVO" (ENGINE_ROOT acessível), não mais "GET :8781 respondeu".
    oll = _ollama_get("/api/tags", timeout=2.0)
    # ok exige o dado REALMENTE legível (state_view não-vazio, cache 2s) — dir existir com
    # state {} deixava o badge verde com todos os painéis em branco (dado fabricado).
    return {"upstream": {"ok": fa.ENGINE_ROOT.is_dir() and bool(_upstream_state()),
                         "url": str(fa.ENGINE_ROOT)},
            "ollama": {"ok": oll is not None, "url": OLLAMA,
                       "models": len((oll or {}).get("models", []))},
            "time": _now()}


# ── runs (registry + runner STUB) ────────────────────────────────────────────
def _seed_runs():
    global _SEEDED
    if _SEEDED:
        return
    state = _upstream_state()   # I/O de arquivo FORA do lock
    claims = (state.get("sessions", {}) or {}).get("claims", []) or []
    with _LOCK:                 # double-checked locking — semeia uma vez só
        if _SEEDED:
            return
        for i, c in enumerate(claims[:6]):
            done = "DONE" in str(c.get("status", "")).upper() or "landed" in str(c.get("status", ""))
            rid = f"seed-{i:03d}"
            RUNS[rid] = {
            "id": rid, "kind": "agent", "agentId": "interior-orchestrator",
            "agentName": "Team Lead", "title": f"{c.get('mt', '')} · {c.get('desc', '')}",
            "status": "succeeded" if done else "running", "model": "qwen2.5-coder:7b",
            "startedAt": _now(), "finishedAt": _now() if done else None,
            "durationMs": 4200 if done else None,
            "steps": [{"name": "plan", "status": "done"}, {"name": "execute",
                      "status": "done" if done else "running"},
                      {"name": "verify", "status": "done" if done else "pending"}],
            "logs": [{"ts": _now(), "level": "info", "agent": "Team Lead",
                      "message": f"claim {c.get('mt', '')} — {c.get('owner', '')}"},
                     {"ts": _now(), "level": "success" if done else "info",
                      "agent": "Team Lead", "message": c.get("status", "")}],
            "inputs": {"mt": c.get("mt")}, "outputs": {}, "artifactIds": [],
            }
        _SEEDED = True


def _run_summary(r: dict) -> dict:
    return {k: r.get(k) for k in ("id", "kind", "agentId", "agentName", "workflowId",
            "title", "status", "model", "startedAt", "finishedAt", "durationMs")}


def _start_run(kind: str, **meta) -> str:
    """Cria um run e dispara o runner STUB (steps + logs ao vivo). Ponto de plugue
    para um runner real de agents/workflows."""
    rid = _gen_id(kind)
    steps = meta.pop("steps", None) or [
        {"name": "plan", "status": "pending"}, {"name": "execute", "status": "pending"},
        {"name": "verify", "status": "pending"}]
    run = {"id": rid, "kind": kind, "title": meta.get("title", kind),
           "status": "queued", "startedAt": _now(), "finishedAt": None, "durationMs": None,
           "steps": [{**s} for s in steps], "logs": [], "inputs": meta.get("inputs", {}),
           "outputs": {}, "artifactIds": [], **{k: meta[k] for k in
           ("agentId", "agentName", "workflowId", "model") if k in meta}}
    with _LOCK:
        RUNS[rid] = run
    fa.emit("sketchup-mcp-bff/cockpit_api.py", "execute", "runner", run_id=rid,
            workflow_id=meta.get("workflowId"), agent_id=meta.get("agentId"),
            label=f"run {kind} criado (runner STUB)", confidence="low", stub=True)
    threading.Thread(target=_runner, args=(rid,), daemon=True).start()
    return rid


def _log(run: dict, level: str, message: str, agent: str | None = None):
    with _LOCK:
        run["logs"].append({"ts": _now(), "level": level,
                            "agent": agent or run.get("agentName"), "message": message})


def _runner(rid: str):
    run = RUNS.get(rid)
    if not run:
        return
    t0 = time.time()
    run["status"] = "running"
    _log(run, "info", f"run {rid} iniciado ({run.get('model', '—')})")
    failed = False
    for i, step in enumerate(run["steps"]):
        step["status"] = "running"
        step["startedAt"] = _now()
        _log(run, "debug", f"step '{step['name']}' começou")
        time.sleep(0.8 + 0.5 * i)
        # falha pseudo-determinística só no passo 'verify' de ~1 em 5 runs
        if step["name"] == "verify" and int(t0) % 5 == 0:
            step["status"] = "failed"
            step["finishedAt"] = _now()
            _log(run, "error", f"step '{step['name']}' falhou: gate visual reprovou")
            failed = True
            break
        step["status"] = "done"
        step["finishedAt"] = _now()
        _log(run, "success", f"step '{step['name']}' concluído")
    run["status"] = "failed" if failed else "succeeded"
    run["finishedAt"] = _now()
    run["durationMs"] = int((time.time() - t0) * 1000)
    _log(run, "error" if failed else "success",
         f"run {run['status']} em {run['durationMs']}ms")
    fa.emit("sketchup-mcp-bff/cockpit_api.py", "error" if failed else "execute", "runner",
            run_id=rid, status="error" if failed else "ok", confidence="low", stub=True,
            label=f"run {run['status']} (STUB) em {run['durationMs']}ms")


# ── dispatch ─────────────────────────────────────────────────────────────────
def dispatch(h) -> bool:
    """Tenta tratar uma rota nativa do cockpit. Retorna True se tratou."""
    from urllib.parse import urlparse, parse_qs
    method, path = h.command, urlparse(h.path).path
    if method == "HEAD":
        method = "GET"   # HEAD responde pelas mesmas views (h._send suprime o body)
    query = parse_qs(urlparse(h.path).query)

    # Live System Map: rotas /api/file-map/* (inclui o SSE) — antes de tudo.
    if fa.dispatch(h):
        return True
    # instrumenta toda chamada /api/* nativa no timeline (POST sempre; GET throttled)
    if path.startswith("/api/") and not path.startswith("/api/file-map"):
        if method != "GET" or _gate(f"req:{method}:{path}", 4.0):
            fa.emit("sketchup-mcp-bff/cockpit_api.py", "execute", "bff",
                    endpoint=path, label=f"{method} {path}", status="started")

    if method == "GET" and path == "/api/status":
        return _ok(h, _status())
    # ESTÚDIO por arquivo (studio_mirror) — rotas que antes eram PROXY pro :8781
    if method == "GET" and path == "/api/state":
        if _MOCK:
            fp = _MOCKS_DIR / "state.sample.json"
            if fp.is_file():
                if _gate("mock:state", 5.0):
                    fa.emit("sketchup-mcp-bff/mocks/state.sample.json", "read", "bff",
                            endpoint="/api/state", label="/api/state servido do MOCK",
                            confidence="medium", mock=True)
                h._send(200, fp.read_bytes(), "application/json; charset=utf-8",
                        {"X-Bff-Source": "mock"})
                return True
        return _ok(h, _upstream_state())
    if method == "GET" and path == "/api/kgraph":
        return _ok(h, studio.kgraph_view())
    if method == "GET" and path == "/api/consult/state":
        try:
            return _ok(h, studio.consult_view())
        except Exception as e:  # noqa: BLE001 — paridade com o :8781 (view inteira guardada)
            return _ok(h, {"error": str(e), "pending_questions": [], "latest_question": None,
                           "latest_answer": None})
    if method == "GET" and path == "/api/consult/latest-question":
        return _ok(h, studio.consult_latest("question"))
    if method == "GET" and path == "/api/consult/latest-answer":
        return _ok(h, studio.consult_latest("answer"))
    if method == "GET" and path.startswith(("/img/", "/inbox-img/")):
        from urllib.parse import unquote
        if path.startswith("/img/"):
            img = studio.render_image(unquote(path[len("/img/"):]))
        else:
            img = studio.inbox_image(unquote(path[len("/inbox-img/"):]))
        if img is None:
            return _ok(h, {"error": "not_found"}, 404)
        body, ctype = img
        h._send(200, body, ctype)
        return True
    if method == "GET" and path == "/api/models":
        return _ok(h, _ollama_models())
    if method == "POST" and path == "/api/models/chat":
        code, data = _ollama_chat(_body(h))
        return _ok(h, data, code)
    if method == "GET" and path == "/api/agents":
        return _ok(h, {"agents": _derive_agents(_upstream_state())})
    if method == "GET" and path == "/api/workflows":
        return _ok(h, {"workflows": _derive_workflows(_upstream_state())})
    if method == "GET" and path == "/api/artifacts":
        return _ok(h, {"artifacts": _derive_artifacts(_upstream_state())})
    if method == "GET" and path == "/api/decisions":
        return _ok(h, {"decisions": _derive_decisions(_upstream_state())})
    # HISTÓRICO do CARTEIRO (auto_decider) — vidro read-only do audit.jsonl por ARQUIVO
    if method == "GET" and path == "/api/decisions/history":
        lim = _q_int(query, "limit", 100, 1, 1000)
        return _ok(h, decision_history.history_view(lim))
    # NOC (vidro read-only): runs/ledger REAIS do atuador + saude do lock — lidos de arquivo
    if method == "GET" and path == "/api/noc/ledger":
        return _ok(h, noc.ledger_view())
    if method == "GET" and path == "/api/noc/status":
        return _ok(h, noc.status_view())
    # ORACULO/:8765 (vidro read-only): saude GYR + gate-ledger + sessoes + git + skp — de arquivo,
    # sem tocar no :8765 vivo. E o que torna a pagina UNICA e dispensa o dashboard.html do :8765.
    if method == "GET" and path == "/api/bridge/health":
        return _ok(h, bridge.health_view())
    if method == "GET" and path == "/api/bridge/gate":
        return _ok(h, bridge.gate_view())
    if method == "GET" and path == "/api/bridge/sessions":
        return _ok(h, bridge.sessions_view())
    if method == "GET" and path == "/api/bridge/git":
        return _ok(h, bridge.git_view())
    if method == "GET" and path == "/api/bridge/skp":
        return _ok(h, bridge.skp_view())
    if method == "GET" and path == "/api/bridge/gate/stream":
        return _bridge_gate_stream(h)
    # CURADORIA (KICKOFF_CURADORIA): corpus julgado por ARQUIVO + human_verdict por CLIQUE
    if method == "GET" and path == "/api/curation/plants":
        return _ok(h, curation.plants_view())
    m = re.match(r"^/api/curation/([^/]+)$", path)
    if method == "GET" and m:
        from urllib.parse import unquote
        return _ok(h, curation.curation_view(unquote(m.group(1))))
    m = re.match(r"^/api/curation/([^/]+)/verdicts$", path)   # PLURAL — curadoria em LOTE
    if method == "POST" and m:
        from urllib.parse import unquote
        return _curation_verdicts(h, unquote(m.group(1)), _body(h))
    m = re.match(r"^/api/curation/([^/]+)/verdict$", path)
    if method == "POST" and m:
        from urllib.parse import unquote
        return _curation_verdict(h, unquote(m.group(1)), _body(h))
    if method == "GET" and path.startswith("/variant-img/"):
        from urllib.parse import unquote
        img = curation.variant_image(unquote(path[len("/variant-img/"):]))
        if img is None:
            return _ok(h, {"error": "not_found"}, 404)
        body, ctype = img
        h._send(200, body, ctype)
        return True
    if method == "GET" and path == "/api/runs":
        _seed_runs()
        with _LOCK:   # snapshot consistente (RUNS é mutado por _runner/_start_run)
            vals = list(RUNS.values())
        runs = sorted(vals, key=lambda r: r.get("startedAt", ""), reverse=True)
        return _ok(h, {"runs": [_run_summary(r) for r in runs]})

    m = re.match(r"^/api/runs/([^/]+)/logs$", path)
    if method == "GET" and m:
        return _runs_logs(h, m.group(1), query)
    m = re.match(r"^/api/runs/([^/]+)$", path)
    if method == "GET" and m:
        _seed_runs()
        r = RUNS.get(m.group(1))
        return _ok(h, {"run": r}) if r else _ok(h, {"error": "not_found"}, 404)

    m = re.match(r"^/api/agents/([^/]+)/run$", path)
    if method == "POST" and m:
        aid = m.group(1)
        agents = {a["id"]: a for a in _derive_agents(_upstream_state())}
        a = agents.get(aid, {"name": aid, "model": None})
        rid = _start_run("agent", agentId=aid, agentName=a.get("name"),
                         model=a.get("model"), title=f"Run · {a.get('name', aid)}",
                         inputs=_body(h))
        return _ok(h, {"ok": True, "runId": rid})

    m = re.match(r"^/api/workflows/([^/]+)/run$", path)
    if method == "POST" and m:
        wid = m.group(1)
        wfs = {w["id"]: w for w in _derive_workflows(_upstream_state())}
        w = wfs.get(wid, {"name": wid})
        steps = [{"name": s.get("label", s.get("key")), "status": "pending"}
                 for s in (w.get("steps") or [])] or None
        rid = _start_run("workflow", workflowId=wid, title=f"Workflow · {w.get('name', wid)}",
                         agentName=w.get("name"), steps=steps)
        return _ok(h, {"ok": True, "runId": rid})

    m = re.match(r"^/api/decisions/([^/]+)/respond$", path)
    if method == "POST" and m:
        return _decide(h, m.group(1), _body(h))

    return False


# ── helpers de I/O do handler ────────────────────────────────────────────────
def _body(h) -> dict:
    try:
        n = int(h.headers.get("Content-Length", 0) or 0)
        if n <= 0 or n > MAX_BODY:   # rejeita corpo ausente ou grande demais (DoS)
            return {}
        return json.loads(h.rfile.read(n) or b"{}")
    except (ValueError, json.JSONDecodeError):
        return {}


def _ok(h, obj, code: int = 200) -> bool:
    h._json(code, obj)
    return True


def _q_int(query: dict, key: str, default: int, lo: int, hi: int) -> int:
    """Lê um inteiro do query-string (parse_qs → dict de listas), com clamp e fallback
    honesto (valor ausente/malformado → default)."""
    try:
        v = int((query.get(key) or [str(default)])[0])
    except (ValueError, TypeError):
        return default
    return max(lo, min(hi, v))


def _decide(h, did: str, body: dict) -> bool:
    choice = (body or {}).get("choice") or (body or {}).get("answer") or ""
    # valida o id contra as decisões pendentes REAIS (não aceitar id arbitrário)
    pending = {d["id"] for d in _derive_decisions(_upstream_state())}
    if did not in pending:
        return _ok(h, {"ok": False, "error": "unknown_decision", "id": did}, 404)
    applied = None
    # decisão de programa → ÚNICA escrita no motor: mover a proposta por ARQUIVO
    # (.ai_bridge/proposals/pending → approved|rejected), espelho de proposals._move.
    if did != "visual-review":
        action = "approve" if str(choice).lower().startswith("aprov") else \
                 "reject" if str(choice).lower().startswith("rejeit") else None
        if action:
            try:
                moved = studio.decide_proposal(did, action)
            except OSError as e:   # inclui PermissionError — motor montado read-only (Docker)
                return _ok(h, {"ok": False, "error": "decision_write_unavailable",
                               "hint": "motor montado read-only — aprove pelo repo do motor",
                               "detail": str(e)}, 503)
            if moved is None:
                return _ok(h, {"ok": False, "error": "unknown_proposal", "id": did}, 404)
            applied = {"ok": True, "proposal": moved}   # shape do antigo /api/proposal do :8781
            _state_cache.update(t=0.0, v=None)          # próximo /api/state já reflete o move
    return _ok(h, {"ok": True, "id": did, "choice": choice, "upstream": applied})


def _curation_verdict(h, plant: str, body: dict) -> bool:
    """POST /api/curation/<plant>/verdict — o CLIQUE do Felipe (única origem legítima
    de human_verdict; rail do KICKOFF_CURADORIA). Append em human_verdicts.jsonl —
    o corpus.jsonl do motor nunca é reescrito."""
    verdict = str((body or {}).get("verdict") or "").upper()
    variant_id = str((body or {}).get("variant_id") or "")
    note = str((body or {}).get("note") or "")
    if verdict not in curation.HUMAN_VERDICTS:
        return _ok(h, {"ok": False, "error": "invalid_verdict",
                       "hint": "verdict humano é IMPROVED|SAME|WORSE"}, 400)
    try:
        rec = curation.record_human_verdict(plant, variant_id, verdict, note)
    except OSError as e:   # inclui PermissionError — dado montado read-only
        return _ok(h, {"ok": False, "error": "verdict_write_unavailable",
                       "detail": str(e)}, 503)
    if rec is None:
        return _ok(h, {"ok": False, "error": "unknown_variant",
                       "plant": plant, "variant_id": variant_id}, 404)
    return _ok(h, {"ok": True, "recorded": rec})


def _curation_verdicts(h, plant: str, body) -> bool:
    """POST /api/curation/<plant>/verdicts — o CLIQUE do Felipe em LOTE (plural).
    Aceita um array [{variant_id, human_verdict, liked, note, tags}] (ou {"items": [...]}).
    N appends sob UM único _HV_LOCK; variant/verdict inválido isola SÓ aquele item.
    Espelha _curation_verdict: só a tela grava, o corpus.jsonl do motor nunca é tocado."""
    items = body if isinstance(body, list) else \
        ((body or {}).get("items") or (body or {}).get("verdicts") or [])
    if not isinstance(items, list) or not items:
        return _ok(h, {"ok": False, "error": "empty_batch",
                       "hint": "envie um array de vereditos [{variant_id, human_verdict, ...}]"}, 400)
    if len(items) > curation.MAX_BATCH_VERDICTS:
        return _ok(h, {"ok": False, "error": "batch_too_large",
                       "max": curation.MAX_BATCH_VERDICTS, "got": len(items)}, 400)
    try:
        res = curation.record_human_verdicts_batch(plant, items)
    except OSError as e:   # inclui PermissionError — dado montado read-only
        return _ok(h, {"ok": False, "error": "verdict_write_unavailable",
                       "detail": str(e)}, 503)
    if res is None:
        return _ok(h, {"ok": False, "error": "invalid_plant", "plant": plant}, 400)
    return _ok(h, {"ok": True, **res})


def _bridge_gate_stream(h) -> bool:
    """SSE: tail -f do audit.jsonl → cada ACESSO ao gate (consult/heartbeat) ao vivo, igual o feed
    'Acontecendo agora' mas do ORÁCULO. Emite um 'seed' com a contagem atual, depois só as linhas
    novas conforme aparecem. Não toca no :8765 — só segue o arquivo."""
    path = bridge._audit_path()
    h.send_response(200)
    h.send_header("Content-Type", "text/event-stream; charset=utf-8")
    h.send_header("Cache-Control", "no-cache")
    h.send_header("Connection", "keep-alive")
    h.send_header("X-Accel-Buffering", "no")
    h.end_headers()
    try:
        seed = bridge.gate_view()
        h.wfile.write(("event: seed\ndata: " + json.dumps(
            {"consultCount": seed.get("consultCount", 0),
             "lastActivityAgeS": seed.get("lastActivityAgeS")}, ensure_ascii=False) + "\n\n").encode())
        h.wfile.flush()
    except OSError:
        return True
    try:
        pos = path.stat().st_size if path.exists() else 0
    except OSError:
        pos = 0
    deadline = time.time() + 300
    ticks = 0
    try:
        while time.time() < deadline:
            emitted = False
            try:
                size = path.stat().st_size if path.exists() else 0
            except OSError:
                size = 0
            if size < pos:                      # arquivo rotou/truncou → recomeça do início
                pos = 0
            if size > pos:
                with path.open("rb") as fh:
                    fh.seek(pos)
                    chunk = fh.read()
                    pos = fh.tell()
                for raw in chunk.decode("utf-8", "replace").splitlines():
                    if not raw.strip():
                        continue
                    try:
                        d = json.loads(raw)
                    except ValueError:
                        continue
                    ev = {"kind": d.get("kind"), "ts": d.get("t") or d.get("ts")}
                    if d.get("kind") == "consult":
                        ev.update({"model": d.get("model"), "tier": d.get("tier"),
                                   "durSec": bridge._num(d.get("dur_sec")),
                                   "qChars": bridge._int(d.get("q_chars")),
                                   "aChars": bridge._int(d.get("a_chars"))})
                    elif d.get("kind") == "heartbeat":
                        ev.update({"session": d.get("session_id") or d.get("session"),
                                   "cycle": d.get("cycle")})
                    h.wfile.write(("data: " + json.dumps(ev, ensure_ascii=False) + "\n\n").encode())
                    h.wfile.flush()
                    emitted = True
            ticks += 1
            if not emitted and ticks % 6 == 0:  # heartbeat SSE (detecta desconexão)
                h.wfile.write(b": keep-alive\n\n")
                h.wfile.flush()
            time.sleep(0.5)
    except (BrokenPipeError, ConnectionResetError, OSError):
        pass
    return True


def _runs_logs(h, rid: str, query: dict) -> bool:
    _seed_runs()
    run = RUNS.get(rid)
    if not run:
        return _ok(h, {"error": "not_found"}, 404)
    wants_sse = "text/event-stream" in (h.headers.get("Accept") or "") \
        and query.get("format", [""])[0] != "json"
    if not wants_sse:
        return _ok(h, {"logs": run.get("logs", [])})
    # ── SSE: tail dos logs até o run terminar ──
    h.send_response(200)
    h.send_header("Content-Type", "text/event-stream; charset=utf-8")
    h.send_header("Cache-Control", "no-cache")
    h.send_header("Connection", "keep-alive")
    h.send_header("X-Accel-Buffering", "no")
    h.end_headers()
    sent, ticks = 0, 0
    deadline = time.time() + 60
    try:
        while time.time() < deadline:
            logs = run.get("logs", [])
            progressed = sent < len(logs)
            while sent < len(logs):
                line = logs[sent]
                sent += 1
                h.wfile.write(f"data: {json.dumps(line, ensure_ascii=False)}\n\n".encode())
                h.wfile.flush()
            if run.get("status") in ("succeeded", "failed") and sent >= len(run.get("logs", [])):
                h.wfile.write(f"event: end\ndata: {json.dumps({'status': run['status']})}\n\n".encode())
                h.wfile.flush()
                break
            ticks += 1
            if not progressed and ticks % 7 == 0:   # heartbeat: detecta desconexão rápido
                h.wfile.write(b": keep-alive\n\n")
                h.wfile.flush()
            time.sleep(0.4)
    except (BrokenPipeError, ConnectionResetError, OSError):
        pass
    return True


# Liga o painel "o que está errado?" do Live System Map à saúde motor(arquivo)/ollama.
fa.set_status_probe(_status)
# O studio_mirror pergunta o status do Ollama por AQUI (probe injetado — sem import circular).
studio.set_ollama_probe(_ollama_get)
