"""file_activity.py — Live System Map / File Activity Monitor (BFF).

Camada de EVENTOS DE ATIVIDADE: registra, em tempo real, quais arquivos / pastas /
scripts / endpoints / artifacts participam de cada ação do cockpit, e um SCANNER
ESTÁTICO que monta a árvore dos dois repos (cockpit/BFF + motor) classificando o
papel (role), a saúde (health) e a classificação ("o que é isto?") de cada nó.

PRINCÍPIOS (hard):
  * NUNCA deleta nada. "Lixo" é sempre `stale_candidate` — só sinaliza que o nó
    não apareceu em traces/referências recentes; jamais um delete com certeza.
  * Honesto: o que é mock / stub / legacy / generated é marcado como tal.
  * Fase 1 — só o BFF é instrumentado; o motor (sketchup-mcp) NÃO é tocado. Para
    o tracing dentro do motor há um plano de Fase 3 (env `STUDIO_TRACE`), aqui só
    documentado, não ligado.

O frontend React fala SÓ com /api/file-map/* (servido via cockpit_api.dispatch).
stdlib only — sem dependências.
"""
from __future__ import annotations

import json
import os
import threading
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

# ── localização dos repos ─────────────────────────────────────────────────────
MODULE_DIR = Path(__file__).resolve().parent
# Repo do BFF a ESCANEAR. Em dev = onde o módulo vive; em Docker pode ser um mount
# read-only do workspace (BFF_SCAN_ROOT) separado de onde o server.py de fato roda.
BFF_ROOT = Path(os.environ.get("BFF_SCAN_ROOT", MODULE_DIR)).resolve()
# motor (sketchup-mcp): por padrão irmão do BFF; configurável e honesto quando ausente.
ENGINE_ROOT = Path(os.environ.get("BFF_ENGINE_ROOT", BFF_ROOT.parent / "sketchup-mcp")).resolve()
# marks ficam num local GRAVÁVEL (o scan root pode ser read-only no container).
MARKS_FILE = Path(os.environ.get("BFF_MARKS_FILE", MODULE_DIR / ".file_map_marks.json"))

REPO_BFF = "sketchup-mcp-bff"
REPO_ENGINE = "sketchup-mcp"

# ── janelas de recência (segundos) ────────────────────────────────────────────
W_NOW = 4.0       # 🟢 em uso agora
W_RECENT = 90.0   # 🟡 lido / 🔵 escrito recentemente
W_ACTIVE = 1800.0  # health "active" (atividade na última meia hora)

# ── limites do scanner (sem caps silenciosos — truncamento é reportado) ───────
SKIP_DIRS = {
    "node_modules", ".git", "dist", "__pycache__", ".venv", "venv", ".pytest_cache",
    ".mypy_cache", ".ruff_cache", "build", ".idea", ".vscode", "_archive", "egg-info",
    "scratch", "runs", "old-repos", "backups", "worktrees", ".cache",
}
MAX_NODES = 1000         # backstop de segurança (a profundidade/cap por repo bound antes)
TEXT_EXT = {".py", ".rb", ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".html"}
CORPUS_MAX = 3_000_000   # bytes de corpo lido para o índice de referências

# Config por repo: o BFF (onde está o trabalho) é varrido fundo; o motor é
# REFERÊNCIA read-only e ENORME → árvore rasa e curada (o que for tocado ao vivo
# entra dinamicamente via eventos, mesmo fora do scan estático).
REPO_CFG = {
    REPO_BFF: {"max_depth": 7, "file_cap": 50},
    REPO_ENGINE: {"max_depth": 3, "file_cap": 12},
}

# ── estado em memória ─────────────────────────────────────────────────────────
_LOCK = threading.RLock()
_EVENTS: deque[dict] = deque(maxlen=2500)
_NODES: dict[str, dict] = {}          # key "repo\0path" -> node estático+atividade
_SCAN = {"at": None, "truncated": [], "counts": {}, "engine_present": False}
_seq = 0
_marks: dict[str, str] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def _key(repo: str, path: str) -> str:
    return repo + "\0" + path


# ══════════════════════════════════════════════════════════════════════════════
#  EVENTOS — emit() é o único primitivo de instrumentação
# ══════════════════════════════════════════════════════════════════════════════
def emit(path: str, op: str, source: str, *, repo: str = REPO_BFF, status: str = "ok",
         endpoint: str | None = None, run_id: str | None = None,
         workflow_id: str | None = None, agent_id: str | None = None,
         label: str | None = None, confidence: str = "high", **details) -> None:
    """Registra um evento de atividade e atualiza a saúde do nó. Nunca levanta —
    instrumentação não pode derrubar o request."""
    global _seq
    try:
        with _LOCK:
            _seq += 1
            ev = {
                "id": f"ev-{_seq:08d}", "seq": _seq, "ts": _now(), "repo": repo,
                "path": path, "op": op, "source": source, "status": status,
                "confidence": confidence,
            }
            if endpoint:
                ev["endpoint"] = endpoint
            if run_id:
                ev["runId"] = run_id
            if workflow_id:
                ev["workflowId"] = workflow_id
            if agent_id:
                ev["agentId"] = agent_id
            if label:
                ev["label"] = label
            if details:
                ev["details"] = details
            _EVENTS.append(ev)
            _touch(repo, path, op, status, run_id)
    except Exception:  # noqa: BLE001 — emit é best-effort
        pass


def _touch(repo: str, path: str, op: str, status: str, run_id: str | None) -> None:
    """Atualiza timestamps/atividade de um nó (cria mínimo se ainda não escaneado)."""
    k = _key(repo, path)
    n = _NODES.get(k)
    if n is None:
        n = _new_node(repo, path, scanned=False)
        _NODES[k] = n
    now = _now()
    n["lastActivityAt"] = now
    n["lastOp"] = op
    if op in ("read", "serve", "proxy"):
        n["lastReadAt"] = now
    elif op in ("write", "generate", "modify"):
        n["lastWriteAt"] = now
    elif op == "execute":
        n["lastExecutedAt"] = now
    elif op == "error":
        n["lastErrorAt"] = now
    if status == "error":
        n["lastErrorAt"] = now
    if run_id:
        runs = n.setdefault("activeRunIds", [])
        if run_id not in runs:
            runs.append(run_id)
            del runs[:-6]   # mantém só os 6 últimos


def _new_node(repo: str, path: str, *, scanned: bool, is_dir: bool = False) -> dict:
    leaf = path.rstrip("/").split("/")[-1] or path
    return {
        "repo": repo, "path": path, "leaf": leaf, "dir": is_dir, "scanned": scanned,
        "role": "unknown", "classification": "unknown", "referenced": False,
        "activeRunIds": [], "notes": [],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  SCANNER ESTÁTICO — monta a árvore dos dois repos
# ══════════════════════════════════════════════════════════════════════════════
def _classify(repo: str, rel: str, is_dir: bool) -> tuple[str, str]:
    """(role, classification) por heurística de path. Honesto: não inventa uso."""
    p = rel.replace("\\", "/").lower()
    leaf = p.rstrip("/").split("/")[-1]

    # ---- role -----------------------------------------------------------------
    if repo == REPO_BFF:
        if p.startswith("frontend/src/api/"):
            role = "api"
        elif p.startswith("frontend/src/components/") or p.endswith((".tsx", ".jsx")):
            role = "frontend"
        elif p.startswith("frontend/"):
            role = "frontend"
        elif p.startswith("mocks/") or leaf == "mocks.ts":
            role = "mock"
        elif p.startswith("docs/") or p.endswith(".md"):
            role = "doc"
        elif p.endswith(".py"):
            role = "bff"
        else:
            role = "source"
    else:  # motor
        if "studio_dashboard.py" in p or "/vitrine/" in p or "/claude_bridge/" in p:
            role = "legacy"
        elif p.startswith("artifacts/"):
            role = "artifact"
        elif p.startswith("fixtures/"):
            role = "fixture"
        elif p.endswith(".md"):
            role = "doc"
        elif p.startswith(("tools/", "interior/", "core/", "schemas/", ".claude/", ".ai_bridge/")) \
                or p.endswith((".py", ".rb")):
            role = "engine"
        else:
            role = "source"

    # ---- classification ("o que é isto?") -------------------------------------
    cls = "unknown"
    if "/canonical" in p or "consensus" in p or p.startswith("fixtures/") \
            or p.startswith("core/") or p.startswith("schemas/") \
            or p.startswith(".claude/specs") or "constitution" in leaf:
        cls = "source_of_truth"
    elif "mock" in leaf or "stub" in leaf or role == "mock":
        cls = "mock"
    elif role == "legacy":
        cls = "legacy"
    elif role == "artifact" or p.endswith("/dist") or "/dist/" in p:
        cls = "generated"
    elif not is_dir:
        cls = "active"   # arquivo de código/config "normal" — refina-se depois com referências
    return role, cls


def _read_text(fp: Path) -> str:
    try:
        if fp.suffix.lower() in TEXT_EXT and fp.stat().st_size < 262_144:
            return fp.read_text("utf-8", errors="ignore")
    except OSError:
        pass
    return ""


def _limits(repo: str, prefix: str, max_depth: int, file_cap: int) -> tuple[int, int]:
    # artifacts/ (gerado) e fixtures/ (fonte): mostra a ESTRUTURA, não cada arquivo —
    # os que forem realmente tocados aparecem dinamicamente via eventos.
    if repo == REPO_ENGINE and prefix.startswith(("artifacts/", "fixtures/")):
        return 2, 6
    return max_depth, file_cap


def _walk(root: Path, repo: str, prefix: str, nodes: dict, corpus: list,
          truncated: list, max_depth: int, file_cap: int, depth: int = 0) -> None:
    max_depth, file_cap = _limits(repo, prefix, max_depth, file_cap)
    if depth > max_depth or len(nodes) >= MAX_NODES:
        return
    try:
        entries = sorted(root.iterdir(), key=lambda e: (e.is_file(), e.name.lower()))
    except OSError:
        return
    dirs = [e for e in entries if e.is_dir() and e.name not in SKIP_DIRS and not e.name.endswith(".egg-info")]
    files = [e for e in entries if e.is_file()]
    for d in dirs:
        if len(nodes) >= MAX_NODES:
            truncated.append(f"{repo}: limite de {MAX_NODES} nós — pastas além de {prefix} não escaneadas")
            return
        rel = f"{prefix}{d.name}/"
        nodes[_key(repo, repo + "/" + rel)] = _mk_static(repo, rel, True)
        _walk(d, repo, rel, nodes, corpus, truncated, max_depth, file_cap, depth + 1)
    shown = files[:file_cap]
    for f in shown:
        rel = f"{prefix}{f.name}"
        nodes[_key(repo, repo + "/" + rel)] = _mk_static(repo, rel, False)
        if len(corpus) < 500 and sum(len(c[1]) for c in corpus) < CORPUS_MAX:
            txt = _read_text(f)
            if txt:
                corpus.append((repo + "/" + rel, txt.lower()))
    if len(files) > file_cap:
        extra = len(files) - file_cap
        rel = f"{prefix}… +{extra} arquivos"
        n = _new_node(repo, repo + "/" + rel, scanned=True, is_dir=False)
        n["truncatedMarker"] = True
        n["notes"] = [f"{extra} arquivos não listados (cap {file_cap}/pasta)"]
        nodes[_key(repo, repo + "/" + rel)] = n
        truncated.append(f"{repo}/{prefix}: +{extra} arquivos omitidos (cap por pasta)")


def _mk_static(repo: str, rel: str, is_dir: bool) -> dict:
    role, cls = _classify(repo, rel, is_dir)
    n = _new_node(repo, repo + "/" + rel, scanned=True, is_dir=is_dir)
    n["role"] = role
    n["classification"] = cls
    return n


def _stem(leaf: str) -> str:
    low = leaf.lower()
    return low.rsplit(".", 1)[0] if "." in low and not low.startswith(".") else low


def _is_referenced(path: str, leaf: str, corpus: list) -> bool:
    """True se o stem do arquivo aparece no corpo de OUTRO arquivo do corpus."""
    key = _stem(leaf)
    if len(key) < 4:
        return False
    for p, txt in corpus:
        if p != path and key in txt:
            return True
    return False


_ENTRY_CONFIG = {"app.tsx", "main.tsx", "index.html", "index.css", "index.tsx", "index.ts",
                 "readme.md", ".gitignore", ".env.example", "favicon.svg", "vite-env.d.ts"}


def _is_entry_or_config(leaf: str) -> bool:
    """Entry-points e arquivos de config/lock nunca são 'stale' (são carregados por
    convenção/tooling, não por import nomeado)."""
    lo = leaf.lower()
    return (lo in _ENTRY_CONFIG
            or lo.startswith(("tsconfig", "package", "vite.config", "postcss.config", "tailwind.config", ".env"))
            or lo.endswith((".config.js", ".config.ts", ".lock")) or "lock" in lo)


def scan() -> dict:
    """(Re)constrói a árvore estática preservando a atividade já registrada."""
    nodes: dict[str, dict] = {}
    corpus: list[str] = []
    truncated: list[str] = []

    # raiz do BFF (sempre presente)
    cb = REPO_CFG[REPO_BFF]
    nodes[_key(REPO_BFF, REPO_BFF + "/")] = _mk_static(REPO_BFF, "", True)
    _walk(BFF_ROOT, REPO_BFF, "", nodes, corpus, truncated, cb["max_depth"], cb["file_cap"])

    engine_present = ENGINE_ROOT.is_dir()
    if engine_present:
        ce = REPO_CFG[REPO_ENGINE]
        nodes[_key(REPO_ENGINE, REPO_ENGINE + "/")] = _mk_static(REPO_ENGINE, "", True)
        _walk(ENGINE_ROOT, REPO_ENGINE, "", nodes, corpus, truncated, ce["max_depth"], ce["file_cap"])

    # índice de referências: um nó-arquivo é "referenciado" se seu STEM (sem
    # extensão — imports TS/py descartam a extensão) aparece no corpo de OUTRO
    # arquivo escaneado. O sinal de "stale" só é confiável no BFF (corpus
    # completo); no motor (enorme, corpus parcial) um arquivo sem match vira
    # "unknown", não "stale" — honestidade > acusação. Entry/config nunca é stale.
    for n in nodes.values():
        if n["dir"] or n.get("truncatedMarker"):
            continue
        assessable = len(_stem(n["leaf"])) >= 4   # stem curto (nav/ui) é genérico demais
        referenced = _is_referenced(n["path"], n["leaf"], corpus) if assessable else False
        n["referenced"] = referenced
        if (n["classification"] == "active" and assessable and not referenced
                and not _is_entry_or_config(n["leaf"])):
            n["classification"] = "stale_candidate" if n["repo"] == REPO_BFF else "unknown"

    with _LOCK:
        # preserva atividade (timestamps/runs) dos nós que já existiam
        for k, old in _NODES.items():
            new = nodes.get(k)
            if new is not None:
                for fld in ("lastActivityAt", "lastReadAt", "lastWriteAt", "lastExecutedAt",
                            "lastErrorAt", "lastOp", "activeRunIds"):
                    if old.get(fld):
                        new[fld] = old[fld]
            elif not old.get("scanned"):
                nodes[k] = old   # nó só-de-atividade (ex.: artifact recém-gerado, upstream)
        # aplica marks manuais
        for k, n in nodes.items():
            mk = _marks.get(n["path"])
            if mk:
                n["mark"] = mk
                n["classification"] = mk
        _NODES.clear()
        _NODES.update(nodes)
        _SCAN.update(at=_now(), truncated=truncated, engine_present=engine_present,
                     counts=_role_counts(nodes))
    return dict(_SCAN)


def _role_counts(nodes: dict) -> dict:
    out: dict[str, int] = {}
    for n in nodes.values():
        out[n["role"]] = out.get(n["role"], 0) + 1
    return out


def _ensure_scanned() -> None:
    if _SCAN["at"] is None:
        scan()


# ══════════════════════════════════════════════════════════════════════════════
#  VISÃO DOS NÓS — badges + health derivados na hora (refletem recência)
# ══════════════════════════════════════════════════════════════════════════════
def _age(ts: str | None) -> float:
    if not ts:
        return 1e12
    try:
        return max(0.0, time.time() - datetime.fromisoformat(ts).timestamp())
    except ValueError:
        return 1e12


# role/classification → badges estruturais (chaves semânticas; o front mapeia p/ emoji)
_ROLE_BADGE = {"engine": "script", "api": "endpoint", "frontend": "component",
               "doc": "doc", "artifact": "artifact", "fixture": "fixture",
               "mock": "mock", "bff": "script", "legacy": "legacy"}
_CLS_BADGE = {"source_of_truth": "source_of_truth", "generated": "generated",
              "mock": "mock", "legacy": "legacy", "stale_candidate": "trash_candidate",
              "protected": "protected", "danger": "suspect"}


def _node_view(n: dict) -> dict:
    badges: list[str] = []
    cls = n["classification"]
    # estruturais
    rb = _ROLE_BADGE.get(n["role"])
    if rb and not n["dir"]:
        badges.append(rb)
    cb = _CLS_BADGE.get(cls)
    if cb:
        badges.append(cb)
    # dinâmicas (recência)
    a_act = _age(n.get("lastActivityAt"))
    a_read = _age(n.get("lastReadAt"))
    a_write = _age(n.get("lastWriteAt"))
    a_exec = _age(n.get("lastExecutedAt"))
    a_err = _age(n.get("lastErrorAt"))
    active_now = a_act <= W_NOW
    if active_now:
        badges.append("in_use")
    if a_read <= W_RECENT:
        badges.append("read_recent")
    if a_write <= W_RECENT:
        badges.append("write_recent")
    if a_exec <= W_RECENT:
        badges.append("executed")
    if a_err <= W_RECENT:
        badges.append("error")
    op = n.get("lastOp")
    if op == "proxy" and a_act <= W_RECENT:
        badges.append("proxied")
    if n["path"].startswith("sketchup-mcp-bff/frontend/dist") or op == "serve":
        badges.append("served")
    if n["path"].startswith("ollama:"):
        badges.append("llm")
    if n.get("activeRunIds"):
        badges.append("agent")

    # health
    if cls in ("protected", "source_of_truth"):
        health = "protected"
    elif a_err <= W_RECENT:
        health = "error"
    elif a_act <= W_ACTIVE:
        health = "active"
    elif cls == "stale_candidate":
        health = "stale_candidate"
    elif n["dir"] or n.get("referenced"):
        health = "idle"
    else:
        health = "unknown"

    return {
        "path": n["path"], "repo": n["repo"], "leaf": n["leaf"], "dir": n["dir"],
        "role": n["role"], "classification": cls, "health": health,
        "badges": _dedupe(badges), "referenced": n.get("referenced", False),
        "activeNow": active_now,
        "lastReadAt": n.get("lastReadAt"), "lastWriteAt": n.get("lastWriteAt"),
        "lastExecutedAt": n.get("lastExecutedAt"), "lastActivityAt": n.get("lastActivityAt"),
        "lastOp": op, "activeRunIds": n.get("activeRunIds", []),
        "mark": n.get("mark"), "truncatedMarker": n.get("truncatedMarker", False),
        "notes": n.get("notes", []),
    }


def _dedupe(seq: list) -> list:
    seen, out = set(), []
    for x in seq:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


# ══════════════════════════════════════════════════════════════════════════════
#  RELATÓRIOS — tree / summary / health / problems / references
# ══════════════════════════════════════════════════════════════════════════════
def tree(repo: str | None = None) -> dict:
    _ensure_scanned()
    with _LOCK:
        views = [_node_view(n) for n in _NODES.values()]
    views = [v for v in views if not repo or v["repo"] == repo]
    views.sort(key=lambda v: (v["repo"], v["path"]))
    return {"nodes": views, "scan": dict(_SCAN), "engineRoot": str(ENGINE_ROOT),
            "enginePresent": _SCAN.get("engine_present", False)}


def summary() -> dict:
    _ensure_scanned()
    with _LOCK:
        views = [_node_view(n) for n in _NODES.values()]
    by_role: dict[str, int] = {}
    by_health: dict[str, int] = {}
    by_cls: dict[str, int] = {}
    active = 0
    for v in views:
        by_role[v["role"]] = by_role.get(v["role"], 0) + 1
        by_health[v["health"]] = by_health.get(v["health"], 0) + 1
        by_cls[v["classification"]] = by_cls.get(v["classification"], 0) + 1
        if v["activeNow"]:
            active += 1
    return {"total": len(views), "activeNow": active, "byRole": by_role,
            "byHealth": by_health, "byClassification": by_cls,
            "scan": dict(_SCAN), "events": len(_EVENTS),
            "engineRoot": str(ENGINE_ROOT), "enginePresent": _SCAN.get("engine_present", False)}


def health() -> dict:
    """Painéis 'o que é lixo?' + 'o que está errado?' (sem nunca deletar)."""
    _ensure_scanned()
    with _LOCK:
        views = [_node_view(n) for n in _NODES.values()]
    stale = [v for v in views if v["classification"] == "stale_candidate" and not v["dir"]]
    protecteds = [v for v in views if v["classification"] in ("protected", "source_of_truth")]
    mocks = [v for v in views if v["classification"] == "mock"]
    legacy = [v for v in views if v["classification"] == "legacy"]
    return {
        "staleCandidates": sorted(stale, key=lambda v: v["path"])[:60],
        "protected": sorted(protecteds, key=lambda v: v["path"])[:60],
        "mocks": sorted(mocks, key=lambda v: v["path"])[:40],
        "legacy": sorted(legacy, key=lambda v: v["path"])[:40],
        "problems": _problems(views),
        "warning": "Stale candidate não significa deletar. Apenas indica que o "
                   "arquivo não apareceu em traces nem referências recentes.",
        "scan": dict(_SCAN),
    }


def set_status_probe(probe) -> None:
    """O cockpit_api injeta sua função de status (motor-por-arquivo/ollama) para os problemas."""
    global _status_probe
    _status_probe = probe


_status_probe = None


def _problems(views: list) -> list:
    out = []
    # upstream / ollama offline (via probe do cockpit_api)
    try:
        st = _status_probe() if _status_probe else None
    except Exception:  # noqa: BLE001
        st = None
    if st:
        if not st.get("upstream", {}).get("ok"):
            out.append({"id": "upstream-offline", "severity": "error", "kind": "upstream_offline",
                        "title": "Motor (arquivo) inacessível",
                        "detail": f"ENGINE_ROOT {st.get('upstream', {}).get('url')} não existe — "
                                  "o studio_mirror não tem o que ler e /api/state cai em vazio. "
                                  "Confira BFF_ENGINE_ROOT.",
                        "path": "sketchup-mcp-bff/studio_mirror.py"})
        if not st.get("ollama", {}).get("ok"):
            out.append({"id": "ollama-offline", "severity": "warn", "kind": "ollama_offline",
                        "title": "Ollama offline",
                        "detail": f"{st.get('ollama', {}).get('url')} não respondeu — chat/modelos locais indisponíveis.",
                        "path": "ollama:/api/tags"})
    # runner STUB usado em ação que parece real
    out.append({"id": "runner-stub", "severity": "warn", "kind": "runner_stub",
                "title": "Runner de runs é STUB",
                "detail": "POST /api/agents/:id/run e /api/workflows/:id/run usam um runner "
                          "simulado (steps + logs fake). É o ponto de plugue do runner real.",
                "path": "sketchup-mcp-bff/cockpit_api.py"})
    # erros recentes em nós
    for v in views:
        if "error" in v["badges"]:
            out.append({"id": "err-" + v["path"], "severity": "error", "kind": "recent_error",
                        "title": f"Erro recente: {v['leaf']}", "detail": f"último op com falha em {v['path']}.",
                        "path": v["path"]})
    return out


def references(repo: str, path: str) -> dict:
    """referencedBy sob demanda: quais arquivos escaneados mencionam este leaf."""
    _ensure_scanned()
    leaf = path.rstrip("/").split("/")[-1]
    refs = []
    with _LOCK:
        items = list(_NODES.values())
    if len(leaf) >= 4:
        for n in items:
            if n["dir"] or n["path"] == path or n.get("truncatedMarker"):
                continue
            fp = _abs(n["repo"], n["path"])
            if fp and fp.is_file():
                txt = _read_text(fp)
                if txt and leaf.lower() in txt.lower():
                    refs.append(n["path"])
    return {"path": path, "leaf": leaf, "referencedBy": sorted(refs)[:40],
            "count": len(refs)}


def _abs(repo: str, path: str) -> Path | None:
    if repo == REPO_BFF and path.startswith(REPO_BFF + "/"):
        return BFF_ROOT / path[len(REPO_BFF) + 1:]
    if repo == REPO_ENGINE and path.startswith(REPO_ENGINE + "/"):
        return ENGINE_ROOT / path[len(REPO_ENGINE) + 1:]
    return None


# ── marks manuais (persistidos; ação humana, nunca delete) ────────────────────
VALID_MARKS = {"protected", "legacy", "stale_candidate", "source_of_truth", "danger", "active", "unknown"}


def load_marks() -> None:
    global _marks
    if MARKS_FILE.is_file():
        try:
            _marks = json.loads(MARKS_FILE.read_text("utf-8"))
        except (OSError, json.JSONDecodeError):
            _marks = {}


def mark(path: str, classification: str) -> dict:
    if classification not in VALID_MARKS:
        return {"ok": False, "error": "invalid_classification", "valid": sorted(VALID_MARKS)}
    with _LOCK:
        if classification == "unknown":
            _marks.pop(path, None)
        else:
            _marks[path] = classification
        try:
            MARKS_FILE.write_text(json.dumps(_marks, ensure_ascii=False, indent=2), "utf-8")
        except OSError:
            pass
        for n in _NODES.values():
            if n["path"] == path:
                n["mark"] = _marks.get(path)
                if classification != "unknown":
                    n["classification"] = classification
    return {"ok": True, "path": path, "classification": _marks.get(path)}


# ══════════════════════════════════════════════════════════════════════════════
#  EVENTOS — leitura + SSE
# ══════════════════════════════════════════════════════════════════════════════
def events(since: int = 0, limit: int = 200) -> dict:
    with _LOCK:
        evs = [e for e in _EVENTS if e["seq"] > since]
    return {"events": evs[-limit:], "cursor": _seq}


def _sse(h, since: int) -> None:
    """Stream SSE de eventos de atividade ao vivo (tail do ring buffer)."""
    h.send_response(200)
    h.send_header("Content-Type", "text/event-stream; charset=utf-8")
    h.send_header("Cache-Control", "no-cache")
    h.send_header("Connection", "keep-alive")
    h.send_header("X-Accel-Buffering", "no")
    h.end_headers()
    cursor = since
    ticks = 0
    deadline = time.time() + 120
    try:
        # despeja o backlog desde o cursor, depois faz tail
        while time.time() < deadline:
            with _LOCK:
                batch = [e for e in _EVENTS if e["seq"] > cursor]
            for e in batch:
                cursor = e["seq"]
                h.wfile.write(f"data: {json.dumps(e, ensure_ascii=False)}\n\n".encode())
                h.wfile.flush()
            ticks += 1
            if not batch and ticks % 10 == 0:   # heartbeat
                h.wfile.write(b": keep-alive\n\n")
                h.wfile.flush()
            time.sleep(0.5)
    except (BrokenPipeError, ConnectionResetError, OSError):
        pass


# ══════════════════════════════════════════════════════════════════════════════
#  DISPATCH — rotas /api/file-map/* (chamado por cockpit_api.dispatch)
# ══════════════════════════════════════════════════════════════════════════════
def dispatch(h) -> bool:
    from urllib.parse import urlparse, parse_qs
    method, path = h.command, urlparse(h.path).path
    if not path.startswith("/api/file-map"):
        return False
    query = parse_qs(urlparse(h.path).query)

    def _qi(name, default=0):
        try:
            return int(query.get(name, [default])[0])
        except (ValueError, TypeError):
            return default

    if method == "GET" and path == "/api/file-map":
        h._json(200, summary())
        return True
    if method == "GET" and path == "/api/file-map/tree":
        h._json(200, tree(query.get("repo", [None])[0]))
        return True
    if method == "GET" and path == "/api/file-map/events":
        h._json(200, events(_qi("since"), _qi("limit", 200)))
        return True
    if method == "GET" and path == "/api/file-map/events/stream":
        _sse(h, _qi("since"))
        return True
    if method == "GET" and path == "/api/file-map/health":
        h._json(200, health())
        return True
    if method == "GET" and path == "/api/file-map/references":
        h._json(200, references(query.get("repo", [REPO_BFF])[0], query.get("path", [""])[0]))
        return True
    if method == "POST" and path == "/api/file-map/rescan":
        h._json(200, {"ok": True, "scan": scan()})
        return True
    if method == "POST" and path == "/api/file-map/mark":
        body = _read_body(h)
        h._json(200, mark(body.get("path", ""), body.get("classification", "unknown")))
        return True
    return False


def _read_body(h) -> dict:
    try:
        n = int(h.headers.get("Content-Length", 0) or 0)
        if n <= 0 or n > (1 << 20):
            return {}
        return json.loads(h.rfile.read(n) or b"{}")
    except (ValueError, json.JSONDecodeError):
        return {}


load_marks()
