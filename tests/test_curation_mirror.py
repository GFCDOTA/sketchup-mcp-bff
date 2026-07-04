"""test_curation_mirror.py — comportamento do vidro de CURADORIA (KICKOFF_CURADORIA).

Roda com a venv canônica (o BFF é stdlib-only, unittest basta):
    E:\\Claude\\apps\\sketchup-mcp\\.venv\\Scripts\\python.exe -m unittest discover -s tests -v

O sweep root é um FAKE em tempdir via BFF_SWEEP_ROOT (NUNCA o data/ real).
Rails pinados aqui: corpus.jsonl NUNCA é reescrito pelo BFF; human_verdict só
IMPROVED|SAME|WORSE; last-wins por ORDEM DE ARQUIVO (espelho de corpus_to_rag);
degradação honesta em root/arquivo ausente.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

# PNG 1x1 válido (67 bytes) pra fixture de render
_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d4944415478da63fcff9fa10e0003030101d0a6f3aa0000000049454e44ae426082")

PLANT = "planta_x"
V1 = "planta_x__baseline__warm_compact__L0"
V2 = "planta_x__baseline__dark_wood__L1"


def _rec(vid: str, verdict: str, patterns=None, created="2026-07-04T05:00:00Z") -> dict:
    """Registro judged_variant/1.0.0 mínimo-realista (shape do corpus real)."""
    vf = None
    if verdict != "PENDING_VISION":
        vf = {
            "schema_version": "visual_findings.v1", "fixture": PLANT, "attempt": "variant",
            "top_level_verdict": "WARN",
            "axes": {a: {"verdict": "PASS", "evidence": f"ok {a}"} for a in (
                "wall_fidelity", "door_fidelity", "window_fidelity", "room_fidelity",
                "scale_rotation", "global_visual", "material_light")},
            "findings": [{"id": "vf_001", "severity": "WARN", "axis": "wall_fidelity",
                          "type": "x", "location": "y", "evidence_image": "iso.png",
                          "evidence": "z"}],
            "design_patterns_observed": patterns or [],
            "source": "claude_bridge", "discriminated": vid == V1,
            "raw_confidence": "high", "promotion_note": "nota",
        }
    return {
        "schema": "judged_variant/1.0.0", "run_id": PLANT, "variant_id": vid,
        "created_at": created, "plant": PLANT,
        "params": {"style": None, "theme": "", "layout_seed": 0,
                   "layout_source": "brain_default", "pt_to_m": "0.0259"},
        "geometry": {"n_boxes": 200, "rooms": [],
                     "deterministic_gates": {"geometry_sanity": "PASS"}},
        "render_refs": {"iso": f"{vid}/iso.png", "sha256": "abc", "renderer": "su-free"},
        "visual_findings": vf,
        "machine_score": {"value": None if vf is None else 0.6,
                          "label": "machine_provisional"},
        "verdict": verdict, "human_verdict": None,
    }


class CurationMirrorTest(unittest.TestCase):
    """Sweep root fake com corpus realista: upgrades (last-wins), linha quebrada,
    mojibake, human_verdicts.jsonl com correção (last-wins do clique)."""

    @classmethod
    def setUpClass(cls):
        cls.root = Path(tempfile.mkdtemp(prefix="bff_sweep_"))
        d = cls.root / PLANT
        d.mkdir(parents=True)

        lines = [
            json.dumps(_rec(V1, "PENDING_VISION", created="2026-07-04T03:31:00Z")),
            "{quebrada",  # linha inválida no meio — PULADA, nunca derruba a view
            json.dumps(_rec(V1, "CANDIDATE", patterns=[
                {"pattern": "paleta warm", "verdict": "works", "why": "aconchego"},
                {"pattern": "sem shell", "verdict": "fails", "why": "perde contexto"},
            ])),
            # PASSE PERDEDOR do painel (mesmo variant_id, patterns diferentes):
            # a agregação NÃO pode contar estes — só o vencedor do last-wins.
            json.dumps(_rec(V1, "CANDIDATE", patterns=[
                {"pattern": "paleta warm", "verdict": "works", "why": "quente"},
                {"pattern": "piso flutuante", "verdict": "neutral", "why": "aguarda pele"},
            ])),
            json.dumps(_rec(V2, "CANDIDATE", patterns=[
                {"pattern": "paleta warm", "verdict": "fails", "why": "escuro demais"},
                {"pattern": "iso coerente", "verdict": "works", "why": "proporção ok"},
            ], created="2026-07-04T05:02:00Z")),
        ]
        corpus = d / "corpus.jsonl"
        with corpus.open("wb") as fh:
            fh.write(("\n".join(lines) + "\n").encode("utf-8"))
            fh.write(b"\xff\xfe lixo nao-utf8\n")  # mojibake real não explode a leitura

        (d / V1).mkdir()
        (d / V1 / "iso.png").write_bytes(_PNG)
        (d / V2).mkdir()
        (d / V2 / "iso.png").write_bytes(_PNG)

        # clique do Felipe: SAME depois IMPROVED no V2 — o ÚLTIMO vence (last-wins),
        # com uma linha quebrada no meio (tolerância igual à do corpus)
        hv = d / "human_verdicts.jsonl"
        hv.write_text(
            json.dumps({"variant_id": V2, "human_verdict": "SAME",
                        "note": "primeira impressão", "t": "2026-07-04T10:00:00Z"}) + "\n"
            + "{quebrada tambem\n"
            + json.dumps({"variant_id": V2, "human_verdict": "IMPROVED",
                          "note": "melhor pra dark wood", "t": "2026-07-04T10:05:00Z"}) + "\n",
            "utf-8")

        os.environ["BFF_SWEEP_ROOT"] = str(cls.root)
        import curation_mirror
        cls.cm = curation_mirror

    @classmethod
    def tearDownClass(cls):
        os.environ.pop("BFF_SWEEP_ROOT", None)
        shutil.rmtree(cls.root, ignore_errors=True)

    # ── Fatia 1: galeria lê o corpus com last-wins ─────────────────────────────
    def test_curation_view_last_wins_and_shapes(self):
        v = self.cm.curation_view(PLANT)
        self.assertTrue(v["live"])
        self.assertEqual(len(v["variants"]), 2)          # 5 linhas → 2 variantes
        by = {x["variant_id"]: x for x in v["variants"]}
        v1 = by[V1]
        self.assertEqual(v1["verdict"], "CANDIDATE")     # upgrade venceu o PENDING_VISION
        self.assertEqual(v1["revisions"], 3)             # transparência dos appends
        self.assertTrue(v1["discriminated"])
        self.assertEqual(len(v1["axes"]), 7)
        self.assertEqual(v1["findings_count"], 1)
        self.assertEqual(v1["machine_score"]["label"], "machine_provisional")
        self.assertEqual(v1["img"], f"/variant-img/{PLANT}/{V1}/iso.png")
        # tema inferido do variant_id (params.theme vem vazio no dado real)
        self.assertEqual(v1["theme"], "warm_compact")
        self.assertEqual(by[V2]["theme"], "dark_wood")
        self.assertEqual(v["themes"], ["dark_wood", "warm_compact"])
        self.assertEqual(v["counts"], {"CANDIDATE": 2})

    def test_plants_view_lists_only_dirs_with_corpus(self):
        (self.root / "sem_corpus").mkdir(exist_ok=True)
        p = self.cm.plants_view()
        self.assertEqual(p["plants"], [PLANT])

    # ── Fatia 2: fusão + escrita do clique ─────────────────────────────────────
    def test_human_verdict_fused_last_wins(self):
        by = {x["variant_id"]: x for x in self.cm.curation_view(PLANT)["variants"]}
        self.assertIsNone(by[V1]["human_verdict"])       # ninguém julgou o V1
        h = by[V2]["human_verdict"]
        self.assertEqual(h["verdict"], "IMPROVED")       # o clique de correção venceu o SAME
        self.assertEqual(h["note"], "melhor pra dark wood")
        # 1 CANDIDATE sem veredito humano = 1 aguardando o Felipe
        self.assertEqual(self.cm.curation_view(PLANT)["awaiting_human"], 1)

    def test_record_human_verdict_appends_and_never_touches_corpus(self):
        corpus = self.root / PLANT / "corpus.jsonl"
        hv = self.root / PLANT / "human_verdicts.jsonl"
        corpus_before = corpus.read_bytes()
        hv_lines_before = len(hv.read_text("utf-8").splitlines())
        rec = self.cm.record_human_verdict(PLANT, V1, "WORSE", note="teste",
                                           t="2026-07-04T11:00:00Z")
        try:
            self.assertEqual(rec, {"variant_id": V1, "human_verdict": "WORSE",
                                   "note": "teste", "t": "2026-07-04T11:00:00Z"})
            # rail: o corpus do MOTOR fica byte-a-byte intacto
            self.assertEqual(corpus.read_bytes(), corpus_before)
            self.assertEqual(len(hv.read_text("utf-8").splitlines()), hv_lines_before + 1)
            # a galeria reflete o clique
            by = {x["variant_id"]: x
                  for x in self.cm.curation_view(PLANT)["variants"]}
            self.assertEqual(by[V1]["human_verdict"]["verdict"], "WORSE")
            self.assertEqual(self.cm.curation_view(PLANT)["awaiting_human"], 0)
        finally:
            # restaura o fake (ordem-independência entre testes, padrão do gabarito)
            text = hv.read_text("utf-8").splitlines(keepends=True)
            hv.write_text("".join(ln for ln in text if '"WORSE"' not in ln), "utf-8")

    def test_record_human_verdict_rejects_dishonest_input(self):
        # máquina não fala IMPROVED/SAME/WORSE — e a tela não fala CANDIDATE
        self.assertIsNone(self.cm.record_human_verdict(PLANT, V1, "CANDIDATE"))
        self.assertIsNone(self.cm.record_human_verdict(PLANT, V1, "improved"))
        self.assertIsNone(self.cm.record_human_verdict(PLANT, "nao_existe", "IMPROVED"))
        self.assertIsNone(self.cm.record_human_verdict("../fora", V1, "IMPROVED"))

    # ── Fatia 3: agregação SÓ sobre os vencedores do last-wins ────────────────
    def test_patterns_aggregate_only_last_wins_winners(self):
        pats = self.cm.curation_view(PLANT)["patterns"]
        by = {p["pattern"]: p for p in pats["patterns"]}
        # "paleta warm": works no vencedor V1 + fails no V2 (o passe perdedor não conta)
        self.assertEqual((by["paleta warm"]["works"], by["paleta warm"]["fails"]), (1, 1))
        self.assertEqual(sorted(by["paleta warm"]["themes"]),
                         ["dark_wood", "warm_compact"])
        self.assertIn("piso flutuante", by)              # pattern do VENCEDOR do V1
        self.assertNotIn("sem shell", by)                # pattern do passe perdedor — NÃO conta
        self.assertEqual(pats["works"], 2)
        self.assertEqual(pats["fails"], 1)
        self.assertEqual(pats["neutral"], 1)

    # ── imagem com guard ───────────────────────────────────────────────────────
    def test_variant_image_serves_png_and_blocks_traversal(self):
        img = self.cm.variant_image(f"{PLANT}/{V1}/iso.png")
        self.assertIsNotNone(img)
        body, ctype = img
        self.assertEqual(body, _PNG)
        self.assertEqual(ctype, "image/png")
        self.assertIsNone(self.cm.variant_image(f"{PLANT}/../../../etc/passwd"))
        self.assertIsNone(self.cm.variant_image(f"{PLANT}/{V1}/corpus.jsonl"))
        self.assertIsNone(self.cm.variant_image(f"{PLANT}/{V1}/nao_existe.png"))
        self.assertIsNone(self.cm.variant_image(""))


class EmptySweepRootTest(unittest.TestCase):
    """BFF_SWEEP_ROOT apontando pro nada — degradação honesta, nunca raise/mock."""

    @classmethod
    def setUpClass(cls):
        cls.prev = os.environ.get("BFF_SWEEP_ROOT")
        os.environ["BFF_SWEEP_ROOT"] = str(Path(tempfile.gettempdir()) / "nao_existe_sweep")
        import curation_mirror
        cls.cm = curation_mirror

    @classmethod
    def tearDownClass(cls):
        if cls.prev is None:
            os.environ.pop("BFF_SWEEP_ROOT", None)
        else:
            os.environ["BFF_SWEEP_ROOT"] = cls.prev

    def test_views_degrade_honestly(self):
        v = self.cm.curation_view("planta_74")
        self.assertFalse(v["live"])
        self.assertIn("reason", v)
        self.assertEqual(v["variants"], [])
        self.assertEqual(v["patterns"]["total"], 0)
        self.assertEqual(self.cm.plants_view()["plants"], [])
        self.assertIsNone(self.cm.variant_image("planta_74/x/iso.png"))
        # sem corpus não há variante conhecida → clique é rejeitado, nada é criado
        self.assertIsNone(self.cm.record_human_verdict("planta_74", "x", "IMPROVED"))


if __name__ == "__main__":
    unittest.main()
