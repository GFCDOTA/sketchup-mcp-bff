"""carteiro_run_mirror.py — GATILHO + ACIONAMENTOS do CARTEIRO (auto_decider).

Duas responsabilidades, ambas na fronteira `data/runs` do MOTOR — e SÓ ali:

  ESCRITA (a ÚNICA que o BFF faz no motor): `queue_run()` TOCA um arquivo-gatilho
    `<ENGINE_ROOT>/data/runs/carteiro_trigger` (marcador JSON com timestamp). O BFF
    roda num container SEM as libs da engine → NÃO roda o carteiro direto; só
    SINALIZA. O ATUADOR no host (sweep ≤60s) pega o gatilho e roda o drain.
    Idempotente (re-tocar = ok). NÃO toca corpus/human_verdicts/audit — só o gatilho.
    Se o motor está montado read-only (Docker :ro), a escrita levanta OSError e o
    caller responde 503 honesto — NUNCA finge que enfileirou.

  LEITURA (vidro, mesmo idioma de decision_history_mirror/curation_mirror):
    `runs_view()` lê o ledger append-only de ACIONAMENTOS
    `<ENGINE_ROOT>/data/runs/auto_decider_runs.jsonl` (um registro por drain do
    carteiro: quando rodou, o que disparou, quantas decidiu e como se distribuíram).
    SÓ LÊ; linha malformada = PULA; mais-recente-primeiro; arquivo ausente → honesto
    ({runs: [], last_run: null}), NUNCA 500, NUNCA mock.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import file_activity as fa

TRIGGER_NAME = "carteiro_trigger"
RUNS_NAME = "auto_decider_runs.jsonl"
_NOTE = "o atuador roda no proximo sweep (ate ~60s)"
_DEFAULT_LIMIT = 50
_MAX_LIMIT = 500


# ── paths (dinâmicos p/ honrar env em teste — padrão dos mirrors irmãos) ──────────
def _runs_dir() -> Path:
    """`data/runs` do MOTOR (`<ENGINE_ROOT>/data/runs`). Dinâmico p/ honrar env em
    teste, como BFF_DECISION_AUDIT / BFF_SWEEP_ROOT nos mirrors vizinhos."""
    env = os.environ.get("BFF_CARTEIRO_RUNS_DIR", "")
    if env:
        return Path(env)
    return fa.ENGINE_ROOT / "data" / "runs"


def _trigger_path() -> Path:
    return _runs_dir() / TRIGGER_NAME


def _runs_path() -> Path:
    return _runs_dir() / RUNS_NAME


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ── ESCRITA — o gatilho (única escrita do BFF no motor, e só em data/runs) ─────────
def queue_run(source: str = "manual", *, now: str | None = None) -> dict:
    """POST /api/carteiro/run — TOCA o arquivo-gatilho pro atuador rodar o carteiro no
    próximo sweep. Idempotente (re-tocar sobrescreve o marcador = ok). Só escreve em
    `data/runs/carteiro_trigger` — corpus/human_verdicts/audit NUNCA são tocados.

    OSError (inclui PermissionError com o motor read-only) PROPAGA → o caller
    responde 503 honesto; nunca fingimos que enfileirou."""
    queued_at = now or _utcnow()
    marker = {"ok": True, "queued_at": queued_at, "source": str(source or "manual"),
              "note": _NOTE}
    path = _trigger_path()
    path.parent.mkdir(parents=True, exist_ok=True)   # data/runs é a zona permitida
    path.write_text(json.dumps(marker, ensure_ascii=False) + "\n", encoding="utf-8")
    fa.emit("sketchup-mcp/data/runs/carteiro_trigger", "write", "human",
            repo=fa.REPO_ENGINE, endpoint="/api/carteiro/run",
            label=f"gatilho do carteiro tocado ({marker['source']}) — atuador roda em ≤60s")
    return {"ok": True, "queued_at": queued_at, "note": _NOTE}


# ── LEITURA — vidro dos acionamentos ──────────────────────────────────────────────
def _read_jsonl_all(path: Path) -> list[dict]:
    """JSONL INTEIRO (não é tail de feed). Linha inválida/truncada é PULADA (nunca
    derruba a view); mojibake não explode a leitura (errors='replace')."""
    try:
        text = path.read_text("utf-8", errors="replace")
    except OSError:
        return []
    out: list[dict] = []
    for ln in text.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        try:
            d = json.loads(ln)
        except ValueError:
            continue
        if isinstance(d, dict):
            out.append(d)
    return out


def _count(v) -> int:
    """Conta defensiva: o motor pode gravar counts (int) OU as listas do drain
    (decided/escalated/left_pending são listas em auto_decider.drain). Ambos viram
    inteiro; qualquer outra coisa → 0 (nunca levanta)."""
    if isinstance(v, bool):
        return 0
    if isinstance(v, int):
        return max(0, v)
    if isinstance(v, (list, tuple)):
        return len(v)
    return 0


def _run_summary(rec: dict) -> dict:
    """Projeta um registro de acionamento num shape estável pro card: QUANDO rodou,
    o que DISPAROU, quantas DECIDIU e como se distribuíram. Tolerante a nomes de campo
    (t/created_at/finished_at; trigger/source) porque o ledger é escrito pelo motor."""
    return {
        "t": rec.get("t") or rec.get("created_at") or rec.get("finished_at"),
        "trigger": rec.get("trigger") or rec.get("source"),
        "decided": _count(rec.get("decided")),
        "auto_approve": _count(rec.get("auto_approve")),
        "auto_reject": _count(rec.get("auto_reject")),
        "escalated": _count(rec.get("escalated")),
        "left_pending": _count(rec.get("left_pending")),
        "dry_run": bool(rec.get("dry_run", False)),
    }


def runs_view(limit: int = _DEFAULT_LIMIT) -> dict:
    """GET /api/carteiro/runs?limit= — ACIONAMENTOS REAIS do carteiro, lidos de ARQUIVO.

    Mais-recente-primeiro (t desc, empate = ordem de append desc), fatiado a `limit`.
    Degrada honesto: arquivo ausente → {live: False, runs: [], last_run: null, total: 0}
    — NUNCA 500, NUNCA mock."""
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = _DEFAULT_LIMIT
    limit = max(1, min(_MAX_LIMIT, limit))

    path = _runs_path()
    if not path.exists():
        return {"live": False, "reason": f"ledger ausente ({path}) — o carteiro nunca rodou",
                "runs": [], "last_run": None, "total": 0, "source": str(path)}

    recs = _read_jsonl_all(path)
    # t é do motor (append monotônico); idx = ordem de append (desempate determinístico).
    indexed = list(enumerate(recs))
    indexed.sort(key=lambda p: (str(p[1].get("t") or p[1].get("created_at") or ""), p[0]),
                 reverse=True)
    runs = [_run_summary(r) for _, r in indexed[:limit]]
    last_run = runs[0]["t"] if runs else None

    fa.emit("sketchup-mcp/data/runs/auto_decider_runs.jsonl", "read", "bff",
            repo=fa.REPO_ENGINE, endpoint="/api/carteiro/runs",
            label=f"acionamentos do carteiro: {len(recs)} run(s), {len(runs)} na fatia")
    return {"live": True, "runs": runs, "last_run": last_run,
            "total": len(recs), "source": str(path)}
