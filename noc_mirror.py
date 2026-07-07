"""noc_mirror.py — Fase 1 do plano cockpit :8782 <-> NOC (VIDRO read-only).

Taila os arquivos PLANOS do NOC autonomo (atuador noc_dispatcher) e expoe o ESTADO
REAL pro cockpit — sem RPC, sem tocar no :8765, sem importar o codigo do motor. Reusa
so o fa.ENGINE_ROOT que o file_activity ja resolve pra achar .ai_bridge/noc/.

Fonte de verdade (SO LEITURA):
  .ai_bridge/noc/actions.jsonl   -> ledger append-only (1 linha por ciclo do dispatcher)
  .ai_bridge/noc/dispatcher.lock -> heartbeat do atuador (formato noc_lock: owner/pid/ts)
  .ai_bridge/noc/queue.jsonl     -> fila de tasks (contagem aqui; telas na fatia seguinte)

Honestidade: arquivo ausente/vazio -> {live: False, reason}, NUNCA mock. O lock e
interpretado como 'held'/'stale'/'free' — nunca afirma 'morto'.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import file_activity as fa

LOCK_TTL = 900            # espelha noc_lock.DEFAULT_TTL (15min) — nao importa do motor
_LEDGER_TAIL = 400        # le SO as ultimas N linhas (actions.jsonl e append-only e cresce)
_TAIL_BYTES = 256 * 1024


def _noc_dir() -> Path:
    return Path(os.environ.get("BFF_NOC_ROOT", str(fa.ENGINE_ROOT / ".ai_bridge" / "noc")))


def _tail_lines(path: Path, n: int) -> list[str]:
    """Ultimas n linhas nao-vazias lendo so o FIM do arquivo (nunca o todo)."""
    try:
        size = path.stat().st_size
        with path.open("rb") as fh:
            if size > _TAIL_BYTES:
                fh.seek(size - _TAIL_BYTES)
                fh.readline()                       # descarta a 1a linha parcial
            data = fh.read()
    except OSError:
        return []
    text = data.decode("utf-8", errors="replace")   # mojibake real no ledger ('Ã§Ã£o')
    return [ln for ln in text.splitlines() if ln.strip()][-n:]


def _short(s, n: int = 180) -> str:
    s = (s or "").replace("\r", " ").replace("\n", " | ").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def load_ledger(limit: int = _LEDGER_TAIL) -> dict:
    """Le actions.jsonl (so o fim) e deriva 1 entrada por task_id — a ULTIMA linha vence
    (T1: DRY_RUN -> COMMITTED no ledger real)."""
    path = _noc_dir() / "actions.jsonl"
    if not path.exists():
        return {"live": False, "reason": "actions.jsonl ausente", "tasks": [], "rawLines": 0}
    by_task: dict[str, dict] = {}
    raw = 0
    for ln in _tail_lines(path, limit):
        try:
            d = json.loads(ln)
        except ValueError:
            continue
        raw += 1
        tid = str(d.get("task_id") or d.get("id") or f"?{raw}")
        worker = d.get("worker") or {}
        vf = ((d.get("verify") or {}).get("verify_file") or {}) if isinstance(d.get("verify"), dict) else {}
        by_task[tid] = {
            "taskId": tid,
            "title": d.get("title") or "",
            "status": d.get("status") or "?",
            "branch": d.get("branch"),
            "worktree": d.get("worktree"),
            "dryRun": bool(d.get("dry_run")),
            "rc": worker.get("rc"),
            "verifyChecked": vf.get("checked") or [],
            "verifyMissing": vf.get("missing") or [],
            "outTail": _short(worker.get("out_tail")),
            "ts": d.get("t"),
        }
    tasks = sorted(by_task.values(), key=lambda x: x.get("ts") or 0, reverse=True)
    return {"live": True, "tasks": tasks, "rawLines": raw, "source": str(path)}


def lock_state() -> dict:
    """Estado do atuador pelo dispatcher.lock (TTL 15min). Honesto: held/stale/free."""
    path = _noc_dir() / "dispatcher.lock"
    try:
        d = json.loads(path.read_text("utf-8"))
    except (OSError, ValueError):
        return {"state": "free", "alive": False, "label": "ocioso (nenhum atuador no lock)"}
    age = max(0.0, time.time() - float(d.get("ts") or 0))
    if age <= LOCK_TTL:
        return {"state": "held", "alive": True, "owner": d.get("owner"),
                "pid": d.get("pid"), "ageS": round(age, 1),
                "label": f"NOC vivo ({d.get('owner', '?')})"}
    return {"state": "stale", "alive": False, "owner": d.get("owner"),
            "staleForS": round(age, 1),
            "label": f"lock stale ha {int(age)}s (atuador pode ter parado)"}


def _count_lines(path: Path) -> int:
    try:
        return sum(1 for ln in path.read_text("utf-8", errors="replace").splitlines() if ln.strip())
    except OSError:
        return 0


def ledger_view() -> dict:
    """GET /api/noc/ledger — runs REAIS do NOC (ledger) + a fila do gate humano."""
    led = load_ledger()
    if led.get("live"):
        fa.emit("sketchup-mcp/.ai_bridge/noc/actions.jsonl", "read", "noc",
                repo="sketchup-mcp", label="cockpit leu o ledger do NOC",
                count=len(led.get("tasks", [])))
    led["visualReview"] = [t for t in led.get("tasks", [])
                           if t.get("status") == "VISUAL_REVIEW_QUEUED"]
    return led


def status_view() -> dict:
    """GET /api/noc/status — saude do atuador (lock) + contagens, tudo derivado de arquivo."""
    d = _noc_dir()
    led = load_ledger()
    return {
        "nocRoot": str(d),
        "present": d.is_dir(),
        "lock": lock_state(),
        "queueCount": _count_lines(d / "queue.jsonl"),
        "taskCount": len(led.get("tasks", [])),
        "live": bool(led.get("live")),
    }
