"""curation_mirror.py — CURADORIA por arquivo (vidro sobre o corpus julgado do sweep).

Lê `data/runs/noc_variant_sweep/<plant>/corpus.jsonl` (produzido pelo motor —
variant_sweep/FP-034) com last-wins por variant_id — MESMA semântica de
`corpus_to_rag._last_wins` no repo do motor — e funde o veredito HUMANO de
`human_verdicts.jsonl` (arquivo PRÓPRIO, append-only, no MESMO dir do run).

Rails do KICKOFF_CURADORIA (quebrar = RED):
  - corpus.jsonl é do MOTOR — este módulo NUNCA escreve nele;
  - human_verdict (IMPROVED|SAME|WORSE) nasce SÓ de clique na tela:
    `record_human_verdict` é chamado exclusivamente pelo
    POST /api/curation/<plant>/verdict — nenhum job/agente chama;
  - a máquina segue só com CANDIDATE|FAIL|PENDING_VISION (negative_dogfood);
  - degradação honesta: ausente/corrompido → coleção vazia + reason, nunca mock.
"""
from __future__ import annotations

import json
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path

import file_activity as fa

HUMAN_VERDICTS = ("IMPROVED", "SAME", "WORSE")
_AXES = ("wall_fidelity", "door_fidelity", "window_fidelity", "room_fidelity",
         "scale_rotation", "global_visual", "material_light")
_HV_LOCK = threading.Lock()
_SEG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._\-]*$")


# ── paths (dinâmicos p/ honrar env em teste, padrão noc_mirror) ─────────────────────────
def _sweep_root() -> Path:
    """Raiz dos runs do sweep — nível WORKSPACE (E:\\Claude\\data\\runs\\...), não o
    repo do motor. ENGINE_ROOT = <workspace>/apps/sketchup-mcp → workspace é
    `.parent.parent` (mesma âncora do bridge_mirror.git_view)."""
    env = os.environ.get("BFF_SWEEP_ROOT", "")
    if env:
        return Path(env)
    return fa.ENGINE_ROOT.parent.parent / "data" / "runs" / "noc_variant_sweep"


def _plant_dir(plant: str) -> Path:
    return _sweep_root() / plant


def _safe_seg(s) -> bool:
    """Um segmento de path vindo da URL: sem separador, sem `..`, sem vazio."""
    return bool(isinstance(s, str) and _SEG_RE.match(s) and ".." not in s)


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ── infra ───────────────────────────────────────────────────────────────────────────────
def _read_jsonl_all(path: Path) -> list[dict]:
    """JSONL INTEIRO (last-wins precisa de todas as linhas — não é tail de feed).
    Linha inválida/truncada é PULADA; mojibake não explode (o corpus real já tem)."""
    try:
        text = path.read_text("utf-8", errors="replace")
    except OSError:
        return []
    out = []
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


def _last_wins(recs: list[dict]) -> tuple[dict[str, dict], dict[str, int]]:
    """Último registro de cada variant_id na ordem do ARQUIVO vence (espelha
    corpus_to_rag._last_wins — ordem-de-append, sem comparar created_at).
    Devolve também a contagem de appends por variante (transparência do upgrade
    PENDING_VISION→CANDIDATE)."""
    by: dict[str, dict] = {}
    seen: dict[str, int] = {}
    for r in recs:
        vid = r.get("variant_id")
        if isinstance(vid, str) and vid:
            by[vid] = r
            seen[vid] = seen.get(vid, 0) + 1
    return by, seen


def _theme_of(variant_id: str, plant: str, params: dict) -> str:
    """Tema do registro; quando params.theme vem vazio (dado real de hoje), infere do
    variant_id `<plant>__<style>__<theme>__L<seed>` (kickoff: 'inferível do variant_id')."""
    theme = str((params or {}).get("theme") or "").strip()
    if theme:
        return theme
    tail = variant_id[len(plant) + 2:] if variant_id.startswith(plant + "__") else variant_id
    segs = [s for s in tail.split("__") if s]
    return segs[-2] if len(segs) >= 2 else ""


# ── views ───────────────────────────────────────────────────────────────────────────────
def plants_view() -> dict:
    """GET /api/curation/plants — plantas com corpus julgado disponível."""
    root = _sweep_root()
    try:
        plants = sorted(p.name for p in root.iterdir()
                        if p.is_dir() and (p / "corpus.jsonl").is_file())
    except OSError:
        plants = []
    return {"plants": plants, "root": str(root)}


def _variant_summary(plant: str, rec: dict, revisions: int, human: dict | None) -> dict:
    vf = rec.get("visual_findings") or {}
    params = rec.get("params") or {}
    geo = rec.get("geometry") or {}
    rr = rec.get("render_refs") or {}
    iso = rr.get("iso")
    vid = str(rec.get("variant_id") or "")
    axes = vf.get("axes") or {}
    return {
        "variant_id": vid,
        "created_at": rec.get("created_at"),
        "plant": rec.get("plant") or plant,
        # verdict da MÁQUINA: CANDIDATE|FAIL|PENDING_VISION — nunca IMPROVED/SAME/WORSE
        "verdict": rec.get("verdict"),
        # objeto inteiro: o label "machine_provisional" é honestidade, não decoração
        "machine_score": rec.get("machine_score"),
        "params": {k: params.get(k) for k in ("style", "theme", "layout_seed", "layout_source")},
        "theme": _theme_of(vid, plant, params),
        "gates": geo.get("deterministic_gates") or {},
        "n_boxes": geo.get("n_boxes"),
        "img": f"/variant-img/{plant}/{iso}" if iso else None,
        "renderer": rr.get("renderer"),
        "top_level_verdict": vf.get("top_level_verdict"),
        "discriminated": bool(vf.get("discriminated")),
        "axes": {a: axes.get(a) for a in _AXES if axes.get(a)},
        "findings_count": len(vf.get("findings") or []),
        "patterns": [p for p in (vf.get("design_patterns_observed") or []) if isinstance(p, dict)],
        "promotion_note": vf.get("promotion_note"),
        "revisions": revisions,
        "human_verdict": human,
    }


def _aggregate_patterns(variants: list[dict]) -> dict:
    """Fatia 3 — 'o que já aprendemos': agrega design_patterns_observed dos VENCEDORES
    do last-wins (agregar sobre todas as linhas contaria os passes perdedores do painel)."""
    agg: dict[str, dict] = {}
    for v in variants:
        theme = v.get("theme") or ""
        for p in v.get("patterns") or []:
            name = str(p.get("pattern") or "").strip()
            if not name:
                continue
            e = agg.setdefault(name, {"pattern": name, "works": 0, "fails": 0, "neutral": 0,
                                      "themes": [], "variants": [], "why": []})
            verdict = str(p.get("verdict") or "").lower()
            if verdict in ("works", "fails", "neutral"):
                e[verdict] += 1
            if theme and theme not in e["themes"]:
                e["themes"].append(theme)
            if v["variant_id"] not in e["variants"]:
                e["variants"].append(v["variant_id"])
            why = str(p.get("why") or "").strip()
            if why and why not in e["why"] and len(e["why"]) < 3:
                e["why"].append(why)
    pats = sorted(agg.values(),
                  key=lambda x: (-(x["works"] + x["fails"] + x["neutral"]), x["pattern"]))
    return {"total": len(pats),
            "works": sum(x["works"] for x in pats),
            "fails": sum(x["fails"] for x in pats),
            "neutral": sum(x["neutral"] for x in pats),
            "patterns": pats}


def curation_view(plant: str) -> dict:
    """GET /api/curation/<plant> — galeria (Fatia 1) + fusão do human_verdict (Fatia 2)
    + padrões agregados (Fatia 3), tudo numa leitura só."""
    if not _safe_seg(plant):
        return {"live": False, "plant": str(plant), "reason": "plant inválido",
                "variants": [], "patterns": _aggregate_patterns([]), "counts": {}, "themes": []}
    d = _plant_dir(plant)
    corpus_path = d / "corpus.jsonl"
    recs = _read_jsonl_all(corpus_path)
    if not recs:
        return {"live": False, "plant": plant,
                "reason": f"corpus ausente/vazio ({corpus_path})",
                "variants": [], "patterns": _aggregate_patterns([]), "counts": {}, "themes": []}
    by, seen = _last_wins(recs)
    hv_by, _ = _last_wins(_read_jsonl_all(d / "human_verdicts.jsonl"))

    variants = []
    for vid, rec in by.items():
        h = hv_by.get(vid)
        human = None
        if h and h.get("human_verdict") in HUMAN_VERDICTS:
            human = {"verdict": h["human_verdict"], "note": str(h.get("note") or ""),
                     "t": h.get("t")}
        elif isinstance(rec.get("human_verdict"), (dict, str)) and rec.get("human_verdict"):
            # inline no corpus (shape livre do schema) — o jsonl do clique tem precedência
            human = {"verdict": None, "note": "", "t": None, "inline": rec["human_verdict"]}
        variants.append(_variant_summary(plant, rec, seen[vid], human))
    variants.sort(key=lambda v: v.get("created_at") or "", reverse=True)

    counts: dict[str, int] = {}
    for v in variants:
        counts[str(v.get("verdict"))] = counts.get(str(v.get("verdict")), 0) + 1
    themes = sorted({v["theme"] for v in variants if v["theme"]})
    awaiting = sum(1 for v in variants
                   if v.get("verdict") != "PENDING_VISION" and not v.get("human_verdict"))

    fa.emit(f"data/runs/noc_variant_sweep/{plant}/corpus.jsonl", "read", "bff",
            repo=fa.REPO_ENGINE, endpoint=f"/api/curation/{plant}",
            label=f"curadoria: {len(variants)} variante(s), {awaiting} aguardando Felipe")
    return {"live": True, "plant": plant, "counts": counts, "awaiting_human": awaiting,
            "themes": themes, "variants": variants,
            "patterns": _aggregate_patterns(variants)}


# ── escrita — ÚNICA, e só via clique na tela ────────────────────────────────────────────
def record_human_verdict(plant: str, variant_id: str, verdict: str,
                         note: str = "", t: str | None = None) -> dict | None:
    """Grava o VEREDITO HUMANO — chamado SÓ pelo POST /api/curation/<plant>/verdict
    (clique do Felipe na tela; rail do kickoff — nenhum job/agente chama).

    Escrita = APPEND em human_verdicts.jsonl (last-wins, mesmo idioma do corpus);
    corpus.jsonl NUNCA é tocado. None = plant/variant desconhecido ou verdict fora
    de IMPROVED|SAME|WORSE. OSError propaga — o caller responde 503 honesto
    (espelho de decide_proposal)."""
    if verdict not in HUMAN_VERDICTS or not _safe_seg(plant):
        return None
    d = _plant_dir(plant)
    known, _ = _last_wins(_read_jsonl_all(d / "corpus.jsonl"))
    if variant_id not in known:
        return None
    rec = {"variant_id": variant_id, "human_verdict": verdict,
           "note": str(note or "")[:500], "t": t or _utcnow()}
    line = json.dumps(rec, ensure_ascii=False)
    with _HV_LOCK:
        with (d / "human_verdicts.jsonl").open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    fa.emit(f"data/runs/noc_variant_sweep/{plant}/human_verdicts.jsonl", "write", "human",
            repo=fa.REPO_ENGINE, endpoint=f"/api/curation/{plant}/verdict",
            label=f"human_verdict {verdict} — {variant_id}")
    return rec


# ── imagem da variante (guard anti-traversal, espelha studio_mirror._serve_image) ───────
_IMG_CTYPE = {".png": "image/png"}


def variant_image(rel: str) -> tuple[bytes, str] | None:
    """GET /variant-img/<plant>/<variant_id>/iso.png — thumbnail da variante (só .png).
    `rel` inclui a planta; o guard é contra a raiz do sweep."""
    base = _sweep_root()
    if not rel or not base.is_dir():
        return None
    try:
        fp = (base / rel).resolve()
        root = base.resolve()
    except OSError:
        return None
    if root not in fp.parents:
        return None
    if fp.suffix.lower() not in _IMG_CTYPE or not fp.is_file():
        return None
    try:
        return fp.read_bytes(), _IMG_CTYPE[fp.suffix.lower()]
    except OSError:
        return None
