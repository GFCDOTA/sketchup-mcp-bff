"""decision_history_mirror.py — VIDRO read-only do CARTEIRO (auto_decider) pro cockpit.

Lê o ledger append-only que o MOTOR (auto_decider / gate mode B) escreve por decisão
OBJETIVA que drenou: `<ENGINE_ROOT>/data/runs/auto_decider_audit.jsonl`
(schema decision_audit_record/1.0.0). Mesmo idioma dos outros mirrors (noc/bridge/
curation): SÓ LÊ, nunca escreve no motor; fonte ausente → {live: False, reason},
NUNCA mock.

Rail: este módulo NUNCA toca corpus/human_verdicts nem o próprio audit — é vidro.
Cada registro conta, por decisão que o carteiro avaliou:
  O QUE PEDIRAM  → decision_id + decision_type (furniture_program|consistency_gap)
  COMO RESOLVEU  → classification (OBJECTIVE_STRONG_*/BORDERLINE/INVALID/TASTE_REFUSED)
                   + action (auto_approve|auto_reject|escalated_gate|left_pending|refused_taste)
  O QUE USOU     → evidence[] (razão legível) + judge_verdicts + gate
  QUÃO CONFIANTE → confidence (0..1)
  QUEM DECIDIU   → decided_by (auto_decider | gate_mode_b — NUNCA humano, é o RAIL)
  QUANDO         → created_at (derivado do mtime do artefato — determinístico).
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import file_activity as fa

AUDIT_NAME = "auto_decider_audit.jsonl"
AUDIT_SCHEMA = "decision_audit_record/1.0.0"
# as 5 ações possíveis (enum do schema) — counts sempre traz as 5, zero-filled
ACTIONS = ("auto_approve", "auto_reject", "escalated_gate", "refused_taste", "left_pending")
_DEFAULT_LIMIT = 100
_MAX_LIMIT = 1000


def _audit_path() -> Path:
    """Ledger do carteiro — nível MOTOR (`<ENGINE_ROOT>/data/runs/...`). Dinâmico p/
    honrar env em teste (padrão dos mirrors irmãos: BFF_SWEEP_ROOT/BFF_NOC_ROOT)."""
    env = os.environ.get("BFF_DECISION_AUDIT", "")
    if env:
        return Path(env)
    return fa.ENGINE_ROOT / "data" / "runs" / AUDIT_NAME


def _read_jsonl_all(path: Path) -> list[dict]:
    """JSONL INTEIRO (counts precisam de TODAS as linhas — não é tail de feed). Linha
    inválida/truncada é PULADA (nunca derruba a view); mojibake não explode a leitura."""
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


def _norm_evidence(ev) -> list[str]:
    """Evidence é a RAZÃO legível (ex. 'completude:high BANHO 01 — falta CORE: vaso').
    O schema é array de strings, mas consumidores podem enriquecer com objetos — então
    coerço não-strings pra JSON compacto (nunca repr de Python)."""
    if not isinstance(ev, list):
        return []
    out: list[str] = []
    for e in ev:
        if isinstance(e, str):
            out.append(e)
        else:
            try:
                out.append(json.dumps(e, ensure_ascii=False))
            except (TypeError, ValueError):
                out.append(str(e))
    return out


def _summary(rec: dict) -> dict:
    """Projeta o registro num shape estável pro frontend (espelha _variant_summary da
    curadoria: contrato apertado, não o dict cru do motor)."""
    conf = rec.get("confidence")
    gate = rec.get("gate")
    jv = rec.get("judge_verdicts")
    return {
        "decision_id": str(rec.get("decision_id") or ""),
        "decision_type": rec.get("decision_type"),
        "classification": rec.get("classification"),
        "action": rec.get("action"),
        "confidence": conf if isinstance(conf, (int, float)) and not isinstance(conf, bool) else None,
        "evidence": _norm_evidence(rec.get("evidence")),
        "judge_verdicts": jv if isinstance(jv, dict) else {},
        "gate": gate if isinstance(gate, dict) else None,
        "decided_by": rec.get("decided_by"),
        "corpus_version": rec.get("corpus_version"),
        "created_at": rec.get("created_at"),
        # o audit só grava decisões APLICADAS (dry_run classifica mas nunca escreve);
        # o campo é defensivo — se um consumidor enriquecer com dry_run, respeitamos.
        "dry_run": bool(rec.get("dry_run", False)),
    }


def _zero_counts() -> dict[str, int]:
    return {a: 0 for a in ACTIONS}


def history_view(limit: int = _DEFAULT_LIMIT) -> dict:
    """GET /api/decisions/history?limit= — histórico REAL do carteiro, lido de ARQUIVO.

    Mais-recente-primeiro (created_at desc, empate = ordem de append desc), fatiado a
    `limit`. `counts` é sobre TODAS as decisões (não só a fatia). Degrada honesto:
    arquivo ausente → {live: False, records: [], counts: zero, reason} — nunca 500."""
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = _DEFAULT_LIMIT
    limit = max(1, min(_MAX_LIMIT, limit))

    path = _audit_path()
    if not path.exists():
        return {"live": False, "reason": f"audit ausente ({path}) — o carteiro nunca aplicou",
                "records": [], "counts": _zero_counts(), "total": 0, "source": str(path)}

    recs = _read_jsonl_all(path)
    counts = _zero_counts()
    for r in recs:
        a = r.get("action")
        if a in counts:
            counts[a] += 1

    # created_at é derivado do mtime (determinístico); idx = ordem de append (desempate).
    indexed = list(enumerate(recs))
    indexed.sort(key=lambda p: (str(p[1].get("created_at") or ""), p[0]), reverse=True)
    records = [_summary(r) for _, r in indexed[:limit]]

    fa.emit("sketchup-mcp/data/runs/auto_decider_audit.jsonl", "read", "bff",
            repo=fa.REPO_ENGINE, endpoint="/api/decisions/history",
            label=f"histórico do carteiro: {len(recs)} decisão(ões), {len(records)} na fatia")
    return {"live": True, "records": records, "counts": counts,
            "total": len(recs), "source": str(path)}
