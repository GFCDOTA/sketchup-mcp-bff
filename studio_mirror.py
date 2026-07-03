"""studio_mirror.py — VIDRO read-only do ESTÚDIO :8781 pro cockpit :8782 (irmão do bridge_mirror).

Absorve TUDO que o `studio_dashboard.py` (:8781) servia pro cockpit — o /api/state completo,
/api/kgraph, /api/consult/* e as imagens /img|/inbox-img — SEM subir o :8781 e SEM importar o
código do motor: lê os MESMOS arquivos que o motor escreve. É o que torna o cockpit :8782
100% autossuficiente por LEITURA DE ARQUIVO (zero requests ao :8781).

Fontes (SÓ LEITURA, todas sob fa.ENGINE_ROOT):
  artifacts/reference_lab/studio_activity.jsonl    -> feed/status dos agentes
  artifacts/planta_74/furnished/kitchen_angles/    -> renders (e bytes de /img/*)
  .ai_bridge/SESSION_COORDINATION.md + git         -> sessões/claims
  artifacts/reference_lab/kitchen/spec/KITCHEN_TO_100.md + .ai_bridge/kanban.json -> backlog
  artifacts/reference_lab/reference.db (mode=ro)   -> contagens de referência
  artifacts/reference_lab/inbox/INBOX.json         -> inbox (e bytes de /inbox-img/*)
  .ai_bridge/knowledge/architect.md + felipe_style_dna.md + judge_rules -> knowledge
  .ai_bridge/interior_consult/**                   -> consult + cycles.jsonl + learning
  .ai_bridge/interior_cycles/CYCLE-*.json          -> factory (esteira)
  .ai_bridge/reference_packs/*.json                -> refpack
  .ai_bridge/learning_patches/LP-*.json            -> patches
  .ai_bridge/proposals/{pending,approved,rejected} -> proposals (ÚNICA escrita: decide_proposal)
  artifacts/review/furniture/** + tools/*_class.py -> overview (state machine por asset)
  tools/vitrine/kgraph.json                        -> /api/kgraph

Dependências NÃO-arquivo (degradação honesta):
  - Ollama :11434 (status "online" dos agentes): injetado via set_ollama_probe() pelo
    cockpit_api (que já fala com o Ollama) — probe ausente/off => online=False, não erro.
  - consult.latest_question_md / openai_enabled: renderer e config são CÓDIGO do motor,
    sem arquivo-fonte => None/False sempre (nenhuma tela React consome).
  - POST /api/proposal action=propose|audit (roda LLM no motor): sem equivalente em arquivo.

Honestidade (igual bridge_mirror/noc_mirror): fonte ausente/vazia -> coleção vazia ou
{live: False, reason}, NUNCA mock. reference.db aberto EXCLUSIVAMENTE mode=ro (o :8781
fazia ingest() se vazio — o mirror JAMAIS replica isso).
"""
from __future__ import annotations

import json
import re
import sqlite3
import subprocess
import time
from pathlib import Path

import file_activity as fa

_TAIL_BYTES = 512 * 1024

# ── constantes ESPELHADAS do motor (espelha studio_dashboard.py — não importa do motor) ──
ROSTER = [
    {"id": "interior-orchestrator", "face": "\U0001F3AF", "label": "Team Lead"},
    {"id": "interior-pm",           "face": "\U0001F4CB", "label": "PM"},
    {"id": "interior-designer",     "face": "\U0001F3A8", "label": "Arquiteto"},
    {"id": "reference-scout",       "face": "\U0001F52D", "label": "Scout"},
    {"id": "ollama-deepseek",       "face": "\U0001F433", "label": "DeepSeek"},
    {"id": "ollama-qwen",           "face": "\U0001F916", "label": "Qwen-coder"},
    {"id": "ollama-llama",          "face": "\U0001F999", "label": "Llama"},
    {"id": "gpt-visual",            "face": "\U0001F9E0", "label": "GPT (visão)"},
    {"id": "ollama-spec",           "face": "\U0001F4D0", "label": "Especialista-Spec"},
]
UMBRELLAS = [
    {"id": "pm",        "label": "PM",        "lead": "interior-pm",           "subs": ["ollama-llama"]},
    {"id": "team_lead", "label": "Team Lead", "lead": "interior-orchestrator", "subs": ["ollama-qwen"]},
    {"id": "architect", "label": "Arquiteto", "lead": "interior-designer",     "subs": ["ollama-deepseek", "gpt-visual"]},
]
SKIP = (".denoiser.png", ".effectsResult.png")
KANBAN_COLS = ["backlog", "refinamento", "execução", "teste", "executado"]
DEFAULT_PACK = "sofa_reference_pack_001"
# espelha ollama_bridge.ROLE_MODEL + o online_map de studio_dashboard._agents
_ROLE_MODEL = {"deepseek": "deepseek-r1:14b", "qwen": "qwen2.5-coder:14b",
               "llama": "llama3.1:8b", "designer": "interior-designer:latest"}
_ONLINE_MAP = {"ollama-deepseek": _ROLE_MODEL["deepseek"], "ollama-qwen": _ROLE_MODEL["qwen"],
               "ollama-llama": _ROLE_MODEL["llama"], "ollama-spec": _ROLE_MODEL["designer"],
               "interior-pm": _ROLE_MODEL["llama"], "interior-orchestrator": _ROLE_MODEL["qwen"],
               "interior-designer": _ROLE_MODEL["deepseek"]}

# espelha tools/interior_studio/cycles.py (etapas canônicas da esteira)
STEP_ORDER = ["PM", "Team Lead", "Reference Scout", "Felipe", "Architect",
              "Gates", "Consult Liaison", "Learning"]
STEP_FACE = {"PM": "🦙", "Team Lead": "🤖", "Reference Scout": "🔭", "Felipe": "🧑",
             "Architect": "🐳", "Gates": "✅", "Consult Liaison": "🔌", "Learning": "📚"}
STATUS_ICON = {"done": "✓", "doing": "⚙", "waiting": "⏳", "blocked": "⛔",
               "pending": "—", "na": "·"}
DERIVED_STEPS = {"Felipe", "Architect", "Gates", "Consult Liaison", "Learning"}

# espelha tools/interior_studio/project_state.py (state machine por asset)
STATE_LABEL = {
    "not_started": "a fazer", "references_needed": "falta referências", "curation_needed": "falta curar ⭐",
    "build_spec_ready": "pronto p/ build spec", "building": "construindo", "form_review_needed": "revisar forma (GPT)",
    "context_review_needed": "revisar contexto (GPT)", "vray_ready": "pronto p/ V-Ray", "approved": "aprovado",
    "learned": "aprendido", "frozen": "congelado",
}
NEXT_ACTION = {
    "not_started": ("definir/escopar", None), "references_needed": ("🔭 curar referências", "sec-refpack"),
    "curation_needed": ("⭐ escolher principal", "sec-refpack"), "build_spec_ready": ("🔌 Consult GPT → spec", "sec-consult"),
    "building": ("🔨 construir a classe", "sec-ren"), "form_review_needed": ("🤖 veredito de forma", None),
    "context_review_needed": ("🏠 veredito de contexto", None), "vray_ready": ("🎞️ gerar V-Ray", None),
    "approved": ("✓ congelar", None), "learned": ("🧠 aprendido", None), "frozen": ("🔒 congelado", None),
}
ASSET_META = {
    "sofa": "🛋️ Sofá", "armchair": "🪑 Poltrona", "coffee_table": "☕ Mesa de centro",
    "dining_table": "🍽️ Mesa de jantar", "rack": "📺 Rack", "bed": "🛏️ Cama",
    "wardrobe": "🚪 Guarda-roupa", "nightstand": "🗄️ Criado-mudo", "kitchen": "🍳 Cozinha (marcenaria)",
    "vanity": "🚿 Bancada/cuba",
}
ROOMS = [
    {"key": "sala", "label": "Sala / Jantar", "icon": "🛋️",
     "assets": ["sofa", "armchair", "coffee_table", "dining_table", "rack"]},
    {"key": "suite", "label": "Suíte / Quarto", "icon": "🛏️", "assets": ["bed", "wardrobe", "nightstand"]},
    {"key": "cozinha", "label": "Cozinha", "icon": "🍳", "assets": ["kitchen"]},
    {"key": "banheiro", "label": "Banheiro", "icon": "🚿", "assets": ["vanity"]},
]
FIXED_STATE = {"kitchen": "frozen"}
ASSET_KIND = {a: "furniture" for a in ("sofa", "armchair", "coffee_table", "dining_table",
                                       "rack", "bed", "wardrobe", "nightstand")}
ASSET_KIND.update({"kitchen": "kitchen", "vanity": "bathroom"})
PIPELINES = {
    "furniture": ["references", "curation", "build_spec", "build", "form_review", "context_review", "vray", "learned"],
    "kitchen": ["geometry", "appliances", "skin", "golden", "learned"],
    "bathroom": ["geometry", "fixtures", "counter", "tiling", "lighting", "render", "learned"],
}
STAGE_META = {
    "references": ("📚", "Referências"), "curation": ("🎨", "Curadoria"), "build_spec": ("📐", "Build Spec"),
    "build": ("🔨", "Construção"), "form_review": ("🤖", "GPT Forma"), "context_review": ("🏠", "GPT Contexto"),
    "vray": ("🎞️", "V-Ray"), "learned": ("🧠", "Aprendido"), "geometry": ("📐", "Geometria"),
    "appliances": ("🧊", "Eletros"), "skin": ("🎨", "Pele"), "golden": ("✨", "Golden"),
    "fixtures": ("🚿", "Louças"), "counter": ("🪨", "Bancada"), "tiling": ("🧱", "Revestimento"),
    "lighting": ("💡", "Luz"), "render": ("🎞️", "Render"),
}
_FURNITURE_DONE = {"not_started": 0, "references_needed": 0, "curation_needed": 1, "build_spec_ready": 2,
                   "building": 3, "form_review_needed": 4, "context_review_needed": 5, "vray_ready": 6,
                   "approved": 7, "learned": 8, "frozen": 8}
IN_PROGRESS = {"curation_needed", "build_spec_ready", "building", "form_review_needed",
               "context_review_needed", "vray_ready"}
ASSET_SYNONYMS = {
    "sofa": ["sofa", "sofá"],
    "armchair": ["poltrona", "armchair", "accent_chair", "cadeira_de_leitura", "leitura"],
    "coffee_table": ["mesa_centro", "mesa_de_centro", "coffee", "centro"],
    "dining_table": ["mesa_jantar", "mesa_de_jantar", "dining", "jantar"],
    "rack": ["rack", "tv_console", "console", "tv", "estante_tv", "painel_tv", "home_theater"],
    "bed": ["cama", "bed"],
    "wardrobe": ["guarda_roupa", "wardrobe", "closet", "armario_roupa", "roupeiro"],
    "nightstand": ["criado", "nightstand", "cabeceira"],
}
SINGLE_ASSET_ROOM = {"cozinha": "kitchen", "banheiro": "vanity"}

# espelha studio_dashboard._KB_HEAD_RE (blocos atômicos do architect.md)
_KB_HEAD_RE = re.compile(r"^<!--KB id=(\d+) \| title=(.*?)-->\s*$")
# espelha studio_dashboard._sessions (tabela MT- da SESSION_COORDINATION.md)
_CLAIM_RE = re.compile(r"\|\s*(MT-[\w/]+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|")


# ── paths (derivados de fa.ENGINE_ROOT — dinâmicos p/ honrar BFF_ENGINE_ROOT) ──────────
def _root() -> Path:
    return fa.ENGINE_ROOT


def _angles() -> Path:
    return _root() / "artifacts/planta_74/furnished/kitchen_angles"


def _inbox_dir() -> Path:
    return _root() / "artifacts/reference_lab/inbox"


def _consult_dir() -> Path:
    return _root() / ".ai_bridge/interior_consult"


def _cycles_dir() -> Path:
    return _root() / ".ai_bridge/interior_cycles"


def _packs_dir() -> Path:
    return _root() / ".ai_bridge/reference_packs"


def _patches_dir() -> Path:
    return _root() / ".ai_bridge/learning_patches"


def _proposals_dir() -> Path:
    return _root() / ".ai_bridge/proposals"


# ── infra ───────────────────────────────────────────────────────────────────────────────
def _tail_lines(path: Path, n: int) -> list[str]:
    """Últimas n linhas não-vazias lendo só o FIM do arquivo (append-only cresce)."""
    try:
        size = path.stat().st_size
        with path.open("rb") as fh:
            if size > _TAIL_BYTES:
                fh.seek(size - _TAIL_BYTES)
                fh.readline()                       # descarta a 1ª linha parcial
            data = fh.read()
    except OSError:
        return []
    text = data.decode("utf-8", errors="replace")   # mojibake real no feed — nunca explode
    return [ln for ln in text.splitlines() if ln.strip()][-n:]


def _json_lines(path: Path, n: int) -> list[dict]:
    """Tail de JSONL parseado — linha inválida/truncada é PULADA (arquivos são escritos ao vivo)."""
    out = []
    for ln in _tail_lines(path, n):
        try:
            d = json.loads(ln)
        except ValueError:
            continue
        if isinstance(d, dict):
            out.append(d)
    return out


def _read_json(path: Path):
    """JSON de arquivo, ou None (ausente/corrompido/truncado — escrito por outro processo)."""
    try:
        return json.loads(path.read_text("utf-8"))
    except (OSError, ValueError):
        return None


def _git(*args: str) -> str:
    try:
        r = subprocess.run(["git", "-C", str(_root()), *args],
                           capture_output=True, text=True, timeout=8)
        return r.stdout.strip()
    except Exception:  # noqa: BLE001
        return ""


# probe do Ollama INJETADO pelo cockpit_api (que já fala com o :11434) — sem import circular.
_ollama_probe = None


def set_ollama_probe(fn) -> None:
    """cockpit_api injeta seu _ollama_get; probe ausente/off => agentes online=False (honesto)."""
    global _ollama_probe
    _ollama_probe = fn


def _ollama_models() -> set[str]:
    try:
        data = _ollama_probe("/api/tags", 2.0) if _ollama_probe else None
    except Exception:  # noqa: BLE001
        data = None
    return {m.get("name", "") for m in (data or {}).get("models", []) or []}


# ── 1. AGENTS (studio_activity.jsonl + Ollama injetado) ────────────────────────────────
def agents_view() -> dict:
    """Espelha studio_dashboard._agents: feed/último-status por agente do studio_activity.jsonl
    + status online dos LLMs via probe injetado (nunca importa tools.ollama_bridge)."""
    allrecs = [r for r in _json_lines(
        _root() / "artifacts/reference_lab/studio_activity.jsonl", 1000) if r.get("agent")]
    feed = allrecs[-40:]
    last: dict[str, dict] = {}
    for rec in allrecs[-400:]:
        last[rec["agent"]] = rec
    facemap = {a["id"]: a for a in ROSTER}
    avail = _ollama_models()
    avail_base = {n.split(":")[0] for n in avail}

    def card(aid: str) -> dict:
        rec = last.get(aid)
        base = facemap.get(aid, {"face": "•", "label": aid})
        mdl = _ONLINE_MAP.get(aid)
        return {"id": aid, "face": base["face"], "label": base["label"],
                "status": rec.get("status", "idle") if rec else "idle",
                "message": rec.get("message", "—") if rec else "—",
                "ts": rec.get("ts") if rec else None,
                "to": rec.get("to") if rec else None,
                "online": bool(mdl and (mdl in avail or mdl.split(":")[0] in avail_base))}

    metrics: dict[str, dict] = {}
    model_usage: dict[str, int] = {}
    for r in allrecs:
        m = metrics.setdefault(r["agent"], {"calls": 0, "errors": 0})
        m["calls"] += 1
        if r.get("status") == "error":
            m["errors"] += 1
        via = r.get("via")
        if via:
            model_usage[via] = model_usage.get(via, 0) + 1

    umbrellas = [{"id": u["id"], "label": u["label"], "lead": card(u["lead"]),
                  "subs": [card(s) for s in u["subs"]]} for u in UMBRELLAS]
    agent_umbrella: dict[str, str] = {}
    for u in UMBRELLAS:
        agent_umbrella[u["lead"]] = u["id"]
        for s in u["subs"]:
            agent_umbrella[s] = u["id"]
    return {"umbrellas": umbrellas, "feed": feed, "metrics": metrics,
            "agent_umbrella": agent_umbrella, "model_usage": model_usage}


# ── 2. RENDERS (kitchen_angles/*.png) ───────────────────────────────────────────────────
# espelha tools/reference_db.py:60/68 (THEME_WORDS/SUBELEM_WORDS — dados puros de keyword)
THEME_WORDS = {
    "black_wood_gold": "black_wood_gold", "blackgold": "black_wood_gold", "bwg": "black_wood_gold",
    "dark_walnut": "dark_walnut", "walnut": "dark_walnut", "nogueira": "dark_walnut",
    "hotel_boutique": "hotel_boutique", "boutique": "industrial_boutique",
    "industrial": "industrial_boutique", "nero": "black_wood_gold",
    "warm_compact": "warm_compact", "clara": "warm_compact", "fendi": "warm_compact",
    "moody": "black_wood_gold",
}
SUBELEM_WORDS = {
    "hero": "hero_render", "elevacao": "elevation", "elevation": "elevation",
    "dollhouse": "full_room", "plano": "plan", "matriz": "montage", "montagem": "montage",
    "ab_": "montage", "backsplash": "backsplash", "floor": "floor", "piso": "floor",
    "variante": "variant", "golden": "hero_render", "premium": "hero_render", "stress": "variant",
    "angle": "detail", "ang_": "detail", "3q": "hero_render", "materials": "montage",
}


def renders_view() -> list[dict]:
    """Espelha studio_dashboard._renders, incluindo a inferência theme/sub de
    reference_db._infer_from_name (o :8781 vivo dava nomes reais — '-'/'render' fixos
    apagavam o nome de 29/45 renders na tela Artefatos)."""
    d = _angles()
    if not d.is_dir():
        return []
    out = []
    try:
        pngs = sorted(d.glob("*.png"), key=lambda x: -x.stat().st_mtime)
    except OSError:
        return []
    for p in pngs:
        if p.name.endswith(SKIP):
            continue
        try:
            st = p.stat()
        except OSError:
            continue
        low = p.name.lower()
        theme = next((v for k, v in THEME_WORDS.items() if k in low), None)
        sub = next((v for k, v in SUBELEM_WORDS.items() if k in low), None)
        out.append({"name": p.name, "theme": theme or "-", "sub": sub or "render",
                    "kb": round(st.st_size / 1024), "mtime": int(st.st_mtime)})
    return out


# ── 3. SESSIONS (git worktree ro + SESSION_COORDINATION.md) ─────────────────────────────
def sessions_view() -> dict:
    """Espelha studio_dashboard._sessions (regex idêntica da tabela MT-)."""
    wt = [ln for ln in _git("worktree", "list").splitlines() if ln.strip()]
    claims = []
    coord = _root() / ".ai_bridge/SESSION_COORDINATION.md"
    try:
        text = coord.read_text("utf-8", "ignore") if coord.exists() else ""
    except OSError:
        text = ""
    for ln in text.splitlines():
        m = _CLAIM_RE.match(ln)
        if m and m.group(1) != "MT":
            claims.append({"mt": m.group(1), "desc": m.group(2), "owner": m.group(3),
                           "status": m.group(4)})
    return {"worktrees": wt, "claims": claims}


# ── 4. BACKLOG (KITCHEN_TO_100.md + kanban.json) ────────────────────────────────────────
def _kanban_load() -> dict:
    return _read_json(_root() / ".ai_bridge/kanban.json") or {}


def backlog_view() -> dict:
    """Espelha studio_dashboard._backlog (mesmos regex/contagens)."""
    p = _root() / "artifacts/reference_lab/kitchen/spec/KITCHEN_TO_100.md"
    try:
        txt = p.read_text("utf-8", "ignore") if p.exists() else ""
    except OSError:
        txt = ""
    if not txt:
        return {"total": 0, "pele": 0, "geo": 0, "done": 0, "tasks": []}
    mts = set(re.findall(r"MT-\d+", txt))
    geo = set(re.findall(r"(MT-\d+)\s*`?\[GEO\]", txt))
    done = set(re.findall(r"(MT-\d+)[^\n]*(?:DONE|✓|completed)", txt))
    kb = _kanban_load()
    tasks, seen = [], set()
    for ln in txt.splitlines():
        if not ln.strip().startswith("|") or "MT-" not in ln:
            continue
        cells = [c.strip() for c in ln.split("|")]
        for i, c in enumerate(cells):
            mm = re.search(r"(MT-\d+)", c)
            if mm and i + 1 < len(cells):
                mt = mm.group(1)
                if mt in seen:
                    break
                seen.add(mt)
                desc = re.sub(r"[*`\[\]]", "", cells[i + 1]).strip()
                status = kb.get(mt) if kb.get(mt) in KANBAN_COLS else ("executado" if mt in done else "backlog")
                tasks.append({"mt": mt, "what": desc[:90], "geo": mt in geo, "done": mt in done, "status": status})
                break
    return {"total": len(mts), "geo": len(geo), "pele": len(mts) - len(geo),
            "done": len(done), "tasks": tasks}


# ── 5. REFERENCES (reference.db — SQLite READ-ONLY, nunca cria/ingere) ──────────────────
_REF_CACHE = {"t": 0.0, "v": None}   # espelha o cache 30s do :8781 (não reabrir a cada poll)


def references_view() -> dict:
    """Contagens do reference.db. mode=ro OBRIGATÓRIO: o :8781 fazia rdb.ingest() se vazio
    (ESCRITA) — o mirror jamais replica isso; db ausente/erro -> {'error': ...} honesto."""
    if _REF_CACHE["v"] is not None and time.time() - _REF_CACHE["t"] < 30:
        return _REF_CACHE["v"]
    db = _root() / "artifacts/reference_lab/reference.db"
    if not db.is_file():
        out = {"error": f"reference.db ausente ({db})"}
    else:
        try:
            con = sqlite3.connect(f"file:{db.as_posix()}?mode=ro", uri=True)
            try:
                by_kind = dict(con.execute(
                    "SELECT kind, COUNT(*) FROM reference GROUP BY kind").fetchall())
                by_theme = dict(con.execute(
                    "SELECT COALESCE(theme,'(sem tema)'), COUNT(*) FROM reference "
                    "WHERE kind IN ('render','theme_preset') GROUP BY theme").fetchall())
            finally:
                con.close()
            out = {"by_kind": by_kind, "by_theme": by_theme}
        except sqlite3.Error as e:
            out = {"error": str(e)}
    _REF_CACHE.update(t=time.time(), v=out)
    return out


# ── 6. INBOX (INBOX.json) ────────────────────────────────────────────────────────────────
def inbox_view() -> list[dict]:
    data = _read_json(_inbox_dir() / "INBOX.json")
    return (data or {}).get("items", []) if isinstance(data, dict) else []


# ── 7. KNOWLEDGE (architect.md blocos KB + DNA + judge rules) ───────────────────────────
def _kb_read() -> list[dict]:
    """Espelha studio_dashboard._kb_read: blocos atômicos [{id,title,body}]; arquivo legado
    sem header vira UM bloco id=0."""
    p = _root() / ".ai_bridge/knowledge/architect.md"
    try:
        # errors="replace": o motor appenda ao vivo — flush no meio de char multibyte
        # não pode derrubar a view (UnicodeDecodeError não é OSError)
        text = p.read_text("utf-8", "replace") if p.exists() else ""
    except OSError:
        text = ""
    if not text:
        return []
    if "<!--KB id=" not in text:
        body = text.strip()
        return [{"id": 0, "title": "(conhecimento legado)", "body": body}] if body else []
    entries, cur = [], None
    for line in text.splitlines():
        m = _KB_HEAD_RE.match(line)
        if m:
            cur = {"id": int(m.group(1)), "title": m.group(2).strip() or "(sem título)", "body": []}
            entries.append(cur)
        elif cur is not None:
            cur["body"].append(line)
    for e in entries:
        e["body"] = "\n".join(e["body"]).strip()
    return entries


def _judge_rules() -> dict:
    return _read_json(_root() / "references/design_rules/felipe_visual_judge_rules.json") or {}


def knowledge_view() -> dict:
    entries = _kb_read()
    jr = _judge_rules()
    kb = _root() / ".ai_bridge/knowledge/architect.md"
    try:
        chars = len(kb.read_text("utf-8", "replace")) if kb.exists() else 0
    except OSError:
        chars = 0
    return {"chars": chars,
            "entries": [{"id": e["id"], "title": e["title"], "chars": len(e["body"]),
                         "preview": e["body"][:160]} for e in entries],
            "dna": (_root() / ".claude/memory/felipe_style_dna.md").exists(),
            "judge": {"anti_patterns": len(jr.get("anti_patterns", [])),
                      "flagged": len(jr.get("flagged", []))}}


# ── 8. CONSULT (.ai_bridge/interior_consult/**) ─────────────────────────────────────────
def _newest(dir_path: Path, pattern: str) -> Path | None:
    if not dir_path.is_dir():
        return None
    files = sorted(dir_path.glob(pattern))   # nomes começam com ts ordenável (espelha store.py)
    return files[-1] if files else None


def _latest_question() -> dict | None:
    p = _newest(_consult_dir() / "outbox", "*.json")
    return _read_json(p) if p else None


def _latest_answer() -> dict | None:
    p = _newest(_consult_dir() / "inbox", "*_answer.md")
    if not p:
        return None
    try:
        raw = p.read_text("utf-8", "replace")
    except OSError:
        return None
    try:
        rel = str(p.relative_to(_root()))
    except ValueError:
        rel = str(p)
    return {"path": rel, "raw": raw}


def consult_view() -> dict:
    """Espelha studio_dashboard._consult_state via os arquivos do store.py.
    latest_question_md=None e openai_enabled=False DEGRADADOS (renderer/config = código do
    motor, sem arquivo-fonte; nenhuma tela React consome)."""
    c = _consult_dir()
    ing = c / "ingested"
    done = {p.stem for p in ing.glob("*.json")} if ing.is_dir() else set()
    pending = []
    outbox = c / "outbox"
    for p in (sorted(outbox.glob("*.json")) if outbox.is_dir() else []):
        q = _read_json(p)
        if not isinstance(q, dict):
            continue
        if q.get("question_id") not in done:
            pending.append({"question_id": q.get("question_id"), "mode": q.get("mode"),
                            "room": q.get("room"), "phase": q.get("phase"),
                            "created_at": q.get("created_at")})
    failed = c / "failed"
    la = _latest_answer()
    cc = _factory_current_cycle() or {}
    return {"pending_questions": pending, "latest_question": _latest_question(),
            "latest_question_md": None,   # DEGRADADO: contracts.render_question_md é código do motor
            "latest_answer": la.get("raw") if la else None,
            "latest_answer_path": la.get("path") if la else None,
            "status": (cc.get("consult") or {}).get("status"),
            "relay": _read_json(c / "relay.json"),
            "ingested_count": len(done),
            "failed_count": len(list(failed.glob("*.md"))) if failed.is_dir() else 0,
            "bridge_mode": "manual",
            "openai_enabled": False}     # DEGRADADO: config openai vive no código do motor


def consult_latest(which: str) -> dict:
    """Espelha studio_dashboard._consult_latest — shape {'ok': True, 'data': ...}."""
    try:
        return {"ok": True, "data": _latest_question() if which == "question" else _latest_answer()}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}


# ── 9. CYCLES (cycles.jsonl — histórico do loop local) ──────────────────────────────────
def cycles_view(n: int = 8) -> list[dict]:
    """Espelha studio_dashboard._cycles_recent (mais recente primeiro)."""
    out = _json_lines(_consult_dir() / "cycles.jsonl", n)
    out.reverse()
    return out


# ── 10. FACTORY (interior_cycles/CYCLE-*.json — espelha tools/interior_studio/cycles.py) ─
def _factory_list_cycles() -> list[dict]:
    d = _cycles_dir()
    if not d.is_dir():
        return []
    out = []
    for p in sorted(d.glob("CYCLE-*.json")):
        c = _read_json(p)
        if isinstance(c, dict):
            out.append(c)
    return out


def _factory_current_cycle() -> dict | None:
    """Espelha cycles.current_cycle: o de maior número não-fechado; senão o último."""
    cs = _factory_list_cycles()
    if not cs:
        return None
    closed = {"done", "frozen", "archived"}
    active = [c for c in cs if c.get("status") not in closed]
    pool = active or cs
    return sorted(pool, key=lambda c: c.get("cycle_id", ""))[-1]


def _architect_blocked(c: dict) -> bool:
    refs = c.get("references") or {}
    return not (refs.get("main") or [])


def _derived_step(agent: str, c: dict, blocked: bool) -> tuple:
    """Espelha cycles._derived_step (status/summary/needs/jump calculados ao vivo)."""
    refs = c.get("references") or {}
    if agent == "Felipe":
        if refs.get("main"):
            return "done", f"✓ principal escolhido ({len(refs['main'])})", None, None
        curated = (refs.get("approved") or []) + (refs.get("anti") or []) + (refs.get("rejected") or [])
        if curated:
            return "doing", "curando — falta marcar ⭐ PRINCIPAL (👍 aprovar NÃO basta)", "marcar ⭐ principal", "sec-refpack"
        return "waiting", "aguardando você curar (👍 aprovar · ⭐ principal · 👎 · 🚫)", "curar referências", "sec-refpack"
    if agent == "Architect":
        if blocked:
            return "blocked", "BLOQUEADO — precisa de 1 referência ⭐ PRINCIPAL (não só 👍 aprovada)", "marcar ⭐ principal", "sec-refpack"
        return "pending", "destravado ✓ — pronto pra virar SOFA_BUILD_SPEC (após Consult GPT)", None, None
    if agent == "Gates":
        return "na", "ainda não aplicável (sem sofá construído)", None, None
    if agent == "Consult Liaison":
        if (c.get("consult") or {}).get("ingested"):
            return "done", "resposta do GPT ingerida", None, None
        return "pending", "pronto pra gerar pergunta pós-curadoria", "gerar pergunta GPT", "sec-consult"
    if agent == "Learning":
        lr = c.get("learning") or {}
        if lr.get("new_rules") or lr.get("anti_patterns") or lr.get("golden_samples"):
            return "done", "aprendizado registrado", None, None
        return "pending", "pendente: regra/anti-pattern após resposta do GPT", None, None
    return "pending", "", None, None


def _factory_timeline(c: dict) -> list[dict]:
    """Espelha cycles.timeline (8 etapas; derivadas recalculadas todo render)."""
    recorded = {s.get("agent"): s for s in c.get("steps", [])}
    blocked = _architect_blocked(c)
    out = []
    for agent in STEP_ORDER:
        s = dict(recorded.get(agent, {}))
        needs = jump = None
        if agent in DERIVED_STEPS:
            st, summ, needs, jump = _derived_step(agent, c, blocked)
        else:
            st, summ = (s.get("status") or "pending"), s.get("summary", "")
        out.append({"agent": agent, "face": STEP_FACE.get(agent, "•"),
                    "status": st, "icon": STATUS_ICON.get(st, "•"),
                    "summary": summ, "model": s.get("model", ""), "files": s.get("files", []),
                    "needs": needs, "jump": jump})
    return out


def _factory_derive_status(c: dict) -> str:
    """Espelha cycles.derive_status (do estado real, não do congelado na semente)."""
    refs = c.get("references") or {}
    lr = c.get("learning") or {}
    applied = bool(lr.get("new_rules") or lr.get("anti_patterns") or lr.get("golden_samples") or lr.get("patches"))
    if not refs.get("main"):
        return "waiting_felipe_curation"
    if not applied:
        return "ready_for_sofa_build_spec_after_gpt_patch"
    return "ready_for_build_spec"


def _factory_next_step(c: dict) -> dict:
    """Espelha cycles.next_step."""
    refs = c.get("references") or {}
    consult = c.get("consult") or {}
    if not refs.get("pack_id"):
        return {"kind": "scout", "label": "🔭 Rodar Scout (buscar referências)", "actionable": True}
    if not refs.get("main"):
        return {"kind": "curate", "label": "⭐ Você: escolher 1–2 referências PRINCIPAIS no Reference Pack",
                "actionable": False}
    lr = c.get("learning") or {}
    if not (lr.get("new_rules") or lr.get("patches")):
        if consult.get("question_id"):
            return {"kind": "consult", "label": "📥 Cole a resposta do GPT no painel → vira Learning Patch (você aprova)",
                    "actionable": True}
        return {"kind": "consult", "label": "🔌 Gerar pergunta pro Consult GPT (SPEC) — já pré-preenchida",
                "actionable": True}
    return {"kind": "build", "label": "▶ MT-SOFA-004: construir o sofá da referência (patch aprovado)", "actionable": True}


def factory_view() -> dict:
    """Espelha cycles.factory_state (barra de fábrica + timeline do ciclo atual)."""
    c = _factory_current_cycle()
    if not c:
        return {"has_cycle": False, "cycles": []}
    cards = [{"cycle_id": x.get("cycle_id"), "asset": x.get("asset"), "microtask": x.get("microtask"),
              "title": x.get("title"), "status": x.get("status")}
             for x in sorted(_factory_list_cycles(), key=lambda y: y.get("cycle_id", ""), reverse=True)]
    return {
        "has_cycle": True,
        "cycle_id": c.get("cycle_id"), "project": c.get("project"), "room": c.get("room"),
        "asset": c.get("asset"), "microtask": c.get("microtask"), "title": c.get("title"),
        "mode": c.get("mode"), "status": _factory_derive_status(c), "next_action": c.get("next_action"),
        "architect_blocked": _architect_blocked(c),
        "references": c.get("references") or {}, "timeline": _factory_timeline(c),
        "consult": c.get("consult") or {}, "learning": c.get("learning") or {},
        "next_step": _factory_next_step(c), "cycles": cards,
    }


# ── 11. REFPACK (reference_packs/<pack>.json — espelha reference_packs.pack_state) ──────
def _load_pack(pack_id: str) -> dict | None:
    return _read_json(_packs_dir() / f"{pack_id}.json")


def _pack_counts(pack: dict) -> dict:
    refs = pack.get("references", [])
    if not isinstance(refs, list):
        refs = []
    out = {"total": len(refs), "approved": 0, "rejected": 0, "main": 0, "anti": 0, "pending": 0}
    for r in refs:
        if not isinstance(r, dict):   # pack malformado não pode derrubar o /api/state inteiro
            continue
        st = r.get("status", "pending")
        out[st] = out.get(st, 0) + 1
    return out


def refpack_view(pack_id: str) -> dict:
    pack = _load_pack(pack_id)
    if not pack:
        return {"ok": False, "pack_id": pack_id, "references": [], "counts": {}}
    return {"ok": True, "pack_id": pack_id, "asset": pack.get("asset"), "theme": pack.get("theme"),
            "honesty": pack.get("honesty"), "direction": pack.get("direction"),
            "references": pack.get("references", []), "counts": _pack_counts(pack)}


# ── 12. LEARNING (ingested + judge rules + patches applied + golden samples) ────────────
def _list_patches() -> list[dict]:
    d = _patches_dir()
    if not d.is_dir():
        return []
    out = []
    for p in sorted(d.glob("LP-*.json")):
        rec = _read_json(p)
        if isinstance(rec, dict):
            out.append(rec)
    return out


def _applied_rules() -> list[str]:
    """Espelha learning_patch.applied_rules."""
    out: list[str] = []
    for p in _list_patches():
        if p.get("status") == "applied":
            ap = p.get("applied") or {}
            out += ap.get("rules_added") or (p.get("proposed_changes") or {}).get("new_rules") or []
    return out


def learning_view() -> dict:
    """Espelha studio_dashboard._learning_log (só LÊ — não fabrica nada)."""
    new_rules: list = []
    anti_patterns: list = []
    golden: list = []
    ing_dir = _consult_dir() / "ingested"
    if ing_dir.is_dir():
        for p in sorted(ing_dir.glob("*.json"))[-12:]:
            rec = _read_json(p)
            if not isinstance(rec, dict):
                continue
            new_rules += rec.get("rules_added") or []
            anti_patterns += rec.get("anti_patterns_added") or []
    jd = _judge_rules()
    for a in jd.get("anti_patterns") or []:
        w = a.get("what") or a.get("id")
        if w:
            anti_patterns.append(w)
    new_rules += _applied_rules()
    gs_dir = _root() / "references/felipe/golden_samples"
    if gs_dir.is_dir():
        golden = [p.stem for p in sorted(gs_dir.glob("*")) if p.is_file()]

    def _dd(xs):
        seen, out = set(), []
        for x in xs:
            k = (x or "").strip().lower() if isinstance(x, str) else str(x)
            if k and k not in seen:
                seen.add(k)
                out.append(x.strip() if isinstance(x, str) else x)
        return out
    return {"new_rules": _dd(new_rules)[-15:], "anti_patterns": _dd(anti_patterns)[-15:],
            "golden_samples": golden}


# ── 13. PATCHES (learning_patches/LP-*.json — espelha learning_patch.patches_state) ─────
def patches_view() -> dict:
    """diff=None DEGRADADO: compute_diff é código do motor (lê+normaliza o DNA); nenhuma
    tela React consome o diff — o painel de patches usa draft/patches/counts."""
    allp = _list_patches()
    drafts = [p for p in allp if p.get("status") == "draft"]
    draft = sorted(drafts, key=lambda x: x.get("patch_id", ""))[-1] if drafts else None
    return {"draft": draft, "diff": None,
            "patches": [{"patch_id": p.get("patch_id"), "status": p.get("status"), "asset": p.get("asset"),
                         "verdict": p.get("verdict"),
                         "rules": len((p.get("proposed_changes") or {}).get("new_rules") or []),
                         "anti": len((p.get("proposed_changes") or {}).get("anti_patterns") or [])}
                        for p in sorted(allp, key=lambda x: x.get("patch_id", ""), reverse=True)[:8]],
            "counts": {"draft": sum(1 for p in allp if p.get("status") == "draft"),
                       "applied": sum(1 for p in allp if p.get("status") == "applied"),
                       "rejected": sum(1 for p in allp if p.get("status") == "rejected")}}


# ── 14. PROPOSALS (.ai_bridge/proposals/{pending,approved,rejected}) ────────────────────
def _load_proposals(status: str) -> list[dict]:
    d = _proposals_dir() / status
    if not d.is_dir():
        return []
    out = []
    for f in sorted(d.glob("*.json")):
        rec = _read_json(f)
        if isinstance(rec, dict):
            out.append(rec)
    return out


def proposals_view() -> dict:
    return {s: _load_proposals(s) for s in ("pending", "approved", "rejected")}


def _approved_program(environment: str) -> dict | None:
    """Espelha proposals.approved_program."""
    for p in _load_proposals("approved"):
        if p.get("type") == "furniture_program" and p.get("environment") == environment:
            return p
    return None


def decide_proposal(pid: str, action: str) -> dict | None:
    """ÚNICA ESCRITA no motor (espelha proposals._move): move pending/<pid>.json →
    approved|rejected com status atualizado. None = proposta não existe (2ª chamada idem =
    idempotente no handler → 404). OSError/PermissionError PROPAGA — o caller degrada 503
    honesto quando o motor está montado read-only (Docker)."""
    to = {"approve": "approved", "reject": "rejected"}.get(action)
    if not to:
        return None
    src = _proposals_dir() / "pending" / f"{pid}.json"
    if not src.exists():
        return None
    data = json.loads(src.read_text("utf-8"))
    data["status"] = to
    dst_dir = _proposals_dir() / to
    dst_dir.mkdir(parents=True, exist_ok=True)
    (dst_dir / f"{pid}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")
    src.unlink()
    fa.emit(f"sketchup-mcp/.ai_bridge/proposals/{to}/{pid}.json", "write", "bff",
            repo="sketchup-mcp", label=f"proposta {pid} → {to} (decisão do Felipe, por arquivo)")
    return data


# ── 15. OVERVIEW (state machine por asset — espelha project_state.py) ───────────────────
def _asset_state(asset: str, cycles: list[dict]) -> dict:
    """Espelha project_state.asset_state (sinais: classe, pack, cycle.learning, artifacts)."""
    if asset in FIXED_STATE:
        st = FIXED_STATE[asset]
        lbl, jump = NEXT_ACTION.get(st, ("—", None))
        return {"asset": asset, "state": st, "state_label": STATE_LABEL[st], "next": lbl, "jump": jump,
                "refs": 0, "refs_img": 0, "has_class": False}
    has_class = (_root() / "tools" / f"{asset}_class.py").exists()
    pack = _load_pack(f"{asset}_reference_pack_001")
    prefs = (pack or {}).get("references", [])
    nrefs = len(prefs)
    nimg = sum(1 for r in prefs if r.get("og_image"))
    main = sum(1 for r in prefs if r.get("status") == "main")
    cyc = next((c for c in cycles if c.get("asset") == asset), None)
    lr = (cyc or {}).get("learning") or {}
    spec_done = bool(lr.get("new_rules") or lr.get("patches"))
    vdir = _root() / "artifacts/review/furniture" / asset

    def has(glb):
        return bool(list(vdir.glob(glb))) if vdir.exists() else False
    build_done = has("**/*compare*.png")
    vray_done = has("**/*vray*.png") or has("**/*_final*.png")
    verdicts = []
    for vj in (vdir.glob("**/gpt_verdict.json") if vdir.exists() else []):
        v = _read_json(vj)
        if isinstance(v, dict):
            verdicts.append(v)
    if verdicts:
        def _passed(gate_pref):
            return any(str(v.get("gate", "")).lower().startswith(gate_pref)
                       and str(v.get("verdict", "")).upper() == "PASS" for v in verdicts)
        form_pass = _passed("form")
        ctx_pass = _passed("context") or _passed("contexto")
    else:
        vf = list(vdir.glob("**/gpt_verdict.md")) if vdir.exists() else []
        try:
            vlow = (vf[0].read_text("utf-8", "ignore").lower() if vf else "")
        except OSError:
            vlow = ""
        form_pass = ("parou de parecer caixa" in vlow) or ("forma" in vlow and "pass" in vlow)
        ctx_pass = ("contexto" in vlow and "pass" in vlow) or ("context" in vlow and "pass" in vlow)

    if vray_done:
        st = "approved"
    elif ctx_pass:
        st = "vray_ready"
    elif form_pass:
        st = "context_review_needed"
    elif build_done:
        st = "form_review_needed"
    elif spec_done:
        st = "building"
    elif main:
        st = "build_spec_ready"
    elif nrefs > 0:
        st = "curation_needed"
    elif has_class:
        st = "references_needed"
    else:
        st = "not_started"
    lbl, jump = NEXT_ACTION.get(st, ("—", None))
    return {"asset": asset, "state": st, "state_label": STATE_LABEL[st], "next": lbl, "jump": jump,
            "refs": nrefs, "refs_img": nimg, "main": main, "has_class": has_class}


def _canonical_asset(name: str, room_key: str | None = None) -> str | None:
    """Espelha project_state.canonical_asset."""
    if room_key in SINGLE_ASSET_ROOM:
        return SINGLE_ASSET_ROOM[room_key]
    n = name.strip().lower().replace(" ", "_").replace("-", "_")
    if n in ASSET_META:
        return n
    for canon, kws in ASSET_SYNONYMS.items():
        if any(k in n for k in kws):
            return canon
    return None


def _room_asset_keys(room_key: str, default_assets: list) -> tuple[list, str]:
    """Espelha project_state.room_asset_keys (programa aprovado sobrepõe ROOMS)."""
    prog = _approved_program(room_key)
    if not prog:
        return list(default_assets), "default"
    seen, out = set(), []
    for it in prog.get("items", []):
        nm = str(it.get("asset", "")).strip().lower()
        if not nm:
            continue
        key = _canonical_asset(nm, room_key) or nm
        if key in seen:
            continue
        seen.add(key)
        out.append(key)
    return (out, "program") if out else (list(default_assets), "default")


def _pipeline_for(asset: str, state: str) -> list:
    """Espelha project_state.pipeline_for (pipeline = política do domínio por kind)."""
    kind = ASSET_KIND.get(asset, "furniture")
    stages = PIPELINES.get(kind, PIPELINES["furniture"])
    if kind == "furniture":
        done = _FURNITURE_DONE.get(state, 0)
    elif state == "frozen":
        done = len(stages)
    else:
        done = 0
    closed = state in ("frozen", "approved", "learned")
    out = []
    for i, sg in enumerate(stages):
        ic, lbl = STAGE_META.get(sg, ("•", sg))
        status = "done" if i < done else ("doing" if (i == done and not closed) else "pending")
        out.append({"icon": ic, "label": lbl, "status": status})
    return out


def overview_view() -> dict:
    """Espelha studio_dashboard._overview (project_state + active_focuses) — tudo de arquivo."""
    cycles = _factory_list_cycles()
    reason = {"curation_needed": "referências baixadas, falta escolher a principal ⭐",
              "build_spec_ready": "principal escolhida, pronto p/ build spec",
              "building": "spec aprovada, construindo a classe",
              "form_review_needed": "classe construída, aguardando veredito de forma",
              "context_review_needed": "forma OK, aguardando veredito de contexto",
              "vray_ready": "forma + contexto aprovados pelo GPT"}
    state_cache: dict[str, dict] = {}

    def stt_of(a: str) -> dict:
        if a not in state_cache:
            state_cache[a] = _asset_state(a, cycles)
        return state_cache[a]

    focuses = []
    for r in ROOMS:
        for a in r["assets"]:
            stt = stt_of(a)
            if stt["state"] in IN_PROGRESS:
                focuses.append({"environment": r["key"], "env_label": r["label"], "env_icon": r["icon"],
                                "asset": a, "label": ASSET_META.get(a, a), "state": stt["state"],
                                "state_label": stt["state_label"], "next": stt["next"], "jump": stt["jump"],
                                "reason": reason.get(stt["state"], ""),
                                "pipeline": _pipeline_for(a, stt["state"])})
    rooms = []
    for r in ROOMS:
        keys, source = _room_asset_keys(r["key"], r["assets"])
        assets = []
        for a in keys:
            stt = dict(stt_of(a))
            stt["label"] = ASSET_META.get(a, a)
            assets.append(stt)
        done = sum(1 for a in assets if a["state"] in ("approved", "learned", "frozen"))
        rooms.append({"key": r["key"], "label": r["label"], "icon": r["icon"],
                      "assets": assets, "done": done, "total": len(assets), "assets_source": source})
    return {"project": "planta_74", "active_focuses": focuses, "n_focus": len(focuses), "rooms": rooms}


# ── STATE agregado (o /api/state completo, shape do studio_dashboard._state) ────────────
def state_view() -> dict:
    """GET /api/state — os 15 blocos que o :8781 servia, TODOS por arquivo."""
    fac = factory_view()
    pack_id = (fac.get("references") or {}).get("pack_id") or DEFAULT_PACK
    return {"agents": agents_view(), "renders": renders_view(), "sessions": sessions_view(),
            "backlog": backlog_view(), "references": references_view(), "inbox": inbox_view(),
            "knowledge": knowledge_view(), "consult": consult_view(), "cycles": cycles_view(8),
            "factory": fac, "refpack": refpack_view(pack_id), "learning": learning_view(),
            "patches": patches_view(), "proposals": proposals_view(), "overview": overview_view()}


# ── KGRAPH + imagens (o que o proxy servia além do /api/state) ──────────────────────────
def kgraph_view() -> dict:
    """GET /api/kgraph — tools/vitrine/kgraph.json do motor (arquivo estático)."""
    p = _root() / "tools/vitrine/kgraph.json"
    data = _read_json(p)
    if data is None:
        return {"live": False, "reason": f"kgraph.json ausente/ilegível ({p})"}
    return data


_IMG_CTYPE = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
              ".webp": "image/webp"}


def _serve_image(base: Path, rel: str, exts: tuple[str, ...]) -> tuple[bytes, str] | None:
    """Bytes de uma imagem sob `base` com guard anti-traversal (espelha o guard do
    studio_dashboard: resolve() + parent-check). Fora da base / extensão errada → None."""
    if not rel or not base.is_dir():
        return None
    try:
        fp = (base / rel).resolve()
        root = base.resolve()
    except OSError:
        return None
    if root not in fp.parents:
        return None
    if fp.suffix.lower() not in exts or not fp.is_file():
        return None
    try:
        return fp.read_bytes(), _IMG_CTYPE.get(fp.suffix.lower(), "application/octet-stream")
    except OSError:
        return None


def render_image(name: str) -> tuple[bytes, str] | None:
    """GET /img/<name> — PNG de kitchen_angles (espelha studio_dashboard, só .png)."""
    return _serve_image(_angles(), name, (".png",))


def inbox_image(rel: str) -> tuple[bytes, str] | None:
    """GET /inbox-img/<rel> — imagem do inbox (png/jpg/jpeg/webp, espelha studio_dashboard)."""
    return _serve_image(_inbox_dir(), rel, (".png", ".jpg", ".jpeg", ".webp"))
