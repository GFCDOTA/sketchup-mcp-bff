"""bridge_mirror.py — VIDRO read-only do ORÁCULO/NOC :8765 pro cockpit :8782 (irmão do noc_mirror).

Absorve o conteúdo RICO do dashboard :8765 SEM tocar no servidor vivo (frágil) e SEM importar o
código do motor — lê os MESMOS arquivos planos que o :8765 já escreve. É o que deixa a página única
mostrar tudo E torna o dashboard.html do :8765 dispensável.

Fontes (SÓ LEITURA):
  .ai_bridge/audit/audit.jsonl   -> ledger do gate (consults do /ask) + heartbeat de atividade
  ~/.claude/projects/*/*.jsonl   -> sessões Claude Code (ACTIVE/IDLE/STOPPED por mtime)
  git (subprocess read-only)     -> repos/worktrees/branch/dirty do workspace
  artifacts/<plant>/             -> timeline de .skp + contagem de renders

Honestidade (igual noc_mirror): fonte ausente/vazia -> {live: False, reason}, NUNCA mock.
"""
from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path

import file_activity as fa

_TAIL_BYTES = 512 * 1024
_AUDIT_TAIL = 600


def _audit_path() -> Path:
    return fa.ENGINE_ROOT / ".ai_bridge" / "audit" / "audit.jsonl"


def _tail_lines(path: Path, n: int) -> list[str]:
    """Últimas n linhas não-vazias lendo só o FIM do arquivo (append-only cresce)."""
    try:
        size = path.stat().st_size
        with path.open("rb") as fh:
            if size > _TAIL_BYTES:
                fh.seek(size - _TAIL_BYTES)
                fh.readline()
            data = fh.read()
    except OSError:
        return []
    text = data.decode("utf-8", errors="replace")
    return [ln for ln in text.splitlines() if ln.strip()][-n:]


def _short(s, n: int = 160) -> str:
    s = (s or "").replace("\r", " ").replace("\n", " | ").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def _int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def _num(v):
    try:
        return round(float(v), 1)
    except (TypeError, ValueError):
        return None


# ── 1. GATE LEDGER (audit.jsonl: consults do /ask + última atividade) ──────────────────
def gate_view() -> dict:
    """GET /api/bridge/gate — decisões reais do oráculo (audit.jsonl), sem tocar no :8765."""
    path = _audit_path()
    if not path.exists():
        return {"live": False, "reason": "audit.jsonl ausente (oráculo nunca rodou?)",
                "consults": [], "consultCount": 0, "lastActivityAgeS": None}
    consults: list[dict] = []
    last_ts = 0.0
    for ln in _tail_lines(path, _AUDIT_TAIL):
        try:
            d = json.loads(ln)
        except ValueError:
            continue
        t = float(d.get("t") or d.get("ts") or 0)
        last_ts = max(last_ts, t)
        if d.get("kind") == "consult":
            # o audit loga METADADO do consult (sem prompt/resposta = privacidade por design):
            # model/tier/effort/mode + tamanho da pergunta/resposta + duração.
            consults.append({
                "ts": t,
                "model": d.get("model"),
                "tier": d.get("tier"),
                "effort": d.get("effort"),
                "mode": d.get("mode"),
                "qChars": _int(d.get("q_chars")),
                "aChars": _int(d.get("a_chars")),
                "durSec": _num(d.get("dur_sec")),
            })
    consults.sort(key=lambda x: x["ts"], reverse=True)
    fa.emit("sketchup-mcp/.ai_bridge/audit/audit.jsonl", "read", "bridge", repo="sketchup-mcp",
            label="cockpit leu o gate-ledger do oráculo", count=len(consults))
    return {"live": True, "consults": consults[:40], "consultCount": len(consults),
            "lastActivityAgeS": round(time.time() - last_ts, 1) if last_ts else None,
            "source": str(path)}


# ── 2. SESSÕES Claude Code (~/.claude/projects) ────────────────────────────────────────
def sessions_view() -> dict:
    """GET /api/bridge/sessions — sessões vivas/ociosas/paradas (mesma lógica do :8765)."""
    proj = Path.home() / ".claude" / "projects"
    if not proj.is_dir():
        return {"live": False, "reason": "~/.claude/projects ausente", "sessions": [], "total": 0, "active": 0}
    out: list[dict] = []
    for d in proj.iterdir():
        if not d.is_dir():
            continue
        for js in d.glob("*.jsonl"):
            try:
                age = time.time() - js.stat().st_mtime
            except OSError:
                continue
            state = "ACTIVE" if age < 300 else "IDLE" if age < 3600 else "STOPPED"
            out.append({"id": js.stem[:8], "project": d.name, "idleSec": round(age), "state": state})
    out.sort(key=lambda s: s["idleSec"])
    active = sum(1 for s in out if s["state"] == "ACTIVE")
    return {"live": True, "sessions": out[:60], "total": len(out), "active": active}


# ── 3. GIT do workspace (subprocess read-only) ─────────────────────────────────────────
def _git(repo: Path, *args: str) -> str:
    try:
        r = subprocess.run(["git", "-C", str(repo), *args],
                           capture_output=True, text=True, timeout=8)
        return r.stdout.strip()
    except Exception:  # noqa: BLE001
        return ""


def git_view() -> dict:
    """GET /api/bridge/git — repos/worktrees/branch/dirty do workspace (E:/Claude)."""
    apps = fa.ENGINE_ROOT.parent
    candidates = [fa.ENGINE_ROOT]
    for base in (apps, apps.parent / "worktrees"):
        if base.is_dir():
            for p in sorted(base.iterdir()):
                if p.is_dir() and (p / ".git").exists() and p not in candidates:
                    candidates.append(p)
    repos = []
    for repo in candidates:
        branch = _git(repo, "rev-parse", "--abbrev-ref", "HEAD")
        if not branch:
            continue
        dirty = len([ln for ln in _git(repo, "status", "--porcelain").splitlines() if ln.strip()])
        repos.append({"name": repo.name, "branch": branch, "dirty": dirty,
                      "lastCommit": _short(_git(repo, "log", "-1", "--format=%h %s"), 80)})
    worktrees = [ln for ln in _git(fa.ENGINE_ROOT, "worktree", "list").splitlines() if ln.strip()]
    return {"live": bool(repos), "repos": repos, "worktrees": len(worktrees),
            "dirtyRepos": [r["name"] for r in repos if r["dirty"]]}


# ── 4. SKP timeline (artifacts) ────────────────────────────────────────────────────────
def skp_view() -> dict:
    """GET /api/bridge/skp — .skp canônicos por planta + contagem de renders."""
    art = fa.ENGINE_ROOT / "artifacts"
    if not art.is_dir():
        return {"live": False, "reason": "artifacts/ ausente", "plants": []}
    plants = []
    for pd in sorted(art.iterdir()):
        if not pd.is_dir():
            continue
        skps = sorted(pd.rglob("*.skp"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not skps:
            continue
        latest = skps[0]
        plants.append({"plant": pd.name, "skpCount": len(skps), "latestSkp": latest.name,
                       "latestMtime": round(latest.stat().st_mtime),
                       "renders": sum(1 for _ in pd.rglob("*.png"))})
    plants.sort(key=lambda p: p["latestMtime"], reverse=True)
    return {"live": bool(plants), "plants": plants}


# ── 5. SAÚDE GREEN/YELLOW/RED (derivada dos sinais acima + NOC) ────────────────────────
def health_view() -> dict:
    """GET /api/bridge/health — cor consolidada do projeto (mesmo espírito do :8765/api/status)."""
    import noc_mirror as noc
    gate = gate_view()
    ses = sessions_view()
    git = git_view()
    nocs = noc.status_view()
    led = noc.ledger_view()
    visual_review = len(led.get("visualReview", [])) if led.get("live") else 0
    dirty = git.get("dirtyRepos", [])
    lock = (nocs.get("lock") or {}).get("state")
    reasons, level = [], "GREEN"
    if visual_review:
        level = "RED"
        reasons.append(f"{visual_review} task(s) esperando VISUAL_REVIEW do Felipe")
    if dirty:
        level = "RED" if level == "RED" else "YELLOW"
        reasons.append(f"repos com mudança não-commitada: {', '.join(dirty)}")
    if lock == "stale":
        level = "RED" if level == "RED" else "YELLOW"
        reasons.append("lock do atuador NOC stale (pode ter parado)")
    if not reasons:
        reasons.append("sem review pendente, sem repo sujo, atuador ok")
    return {"level": level, "reasons": reasons, "signals": {
        "visualReviewPending": visual_review,
        "dirtyRepos": len(dirty),
        "activeSessions": ses.get("active"),
        "gateLastActivityS": gate.get("lastActivityAgeS"),
        "nocLock": lock,
    }}
