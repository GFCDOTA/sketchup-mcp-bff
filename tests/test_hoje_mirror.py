"""test_hoje_mirror.py — a home orientada a exceções (régua dos 5 segundos).

Roda com a venv canônica (stdlib/unittest):
    E:\\Claude\\apps\\sketchup-mcp\\.venv\\Scripts\\python.exe -m unittest tests.test_hoje_mirror -v

Fakes em tempdir via BFF_SWEEP_ROOT + BFF_NOC_ROOT + BFF_CARTEIRO_RUNS_DIR (NUNCA o
data/ real). Rails pinados: etiqueta de ator em toda missão; inbox só com decisão
humana; sintético nunca vira missão; degradação honesta (fontes ausentes → PARADO).
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

PLANT = "planta_x"
NOW = 1_783_900_000.0


def _variant(vid, theme, *, verdict="CANDIDATE", human=None, nota=None, synthetic=False):
    rec = {"variant_id": vid, "plant": PLANT, "verdict": verdict,
           "created_at": "2026-07-12T10:00:00Z",
           "params": {"style": "baseline", "theme": theme, "layout_seed": 0},
           "render_refs": {"iso": None if synthetic else f"{vid}/iso.png",
                           "renderer": "noc-evidence" if synthetic else "su-free"},
           "machine_score": {"value": 0.5, "label": "machine_provisional"},
           "human_verdict": human}
    return rec, nota


class HojeMirrorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(tempfile.mkdtemp(prefix="hoje_sweep_"))
        cls.noc = Path(tempfile.mkdtemp(prefix="hoje_noc_"))
        d = cls.root / PLANT
        d.mkdir(parents=True)

        variants = [
            _variant("planta_x__baseline__warm__L0", "warm", nota=4),          # espera VOCÊ
            _variant("planta_x__baseline__warm__L1", "warm", nota=2),          # espera VOCÊ
            _variant("planta_x__baseline__dark__L0", "dark",
                     verdict="PENDING_VISION"),                                # sistema agindo
            _variant("planta_x__baseline__done__L0", "done",
                     human={"verdict": "IMPROVED"}, nota=8),                   # concluída (some)
            _variant("planta_x__noc-t1__x__L0", "x", synthetic=True),          # sintética (some)
        ]
        with (d / "corpus.jsonl").open("w", encoding="utf-8") as fh:
            for rec, _ in variants:
                fh.write(json.dumps(rec) + "\n")
        with (d / "gpt_reviews.jsonl").open("w", encoding="utf-8") as fh:
            for rec, nota in variants:
                if nota is not None:
                    fh.write(json.dumps({"variant_id": rec["variant_id"], "nota": nota,
                                         "porque": "x", "caminho_pro_10": "y",
                                         "image_viewed": True, "t": NOW - 600}) + "\n")
        (d / "human_verdicts.jsonl").write_text(
            json.dumps({"variant_id": "planta_x__baseline__done__L0",
                        "human_verdict": "IMPROVED", "t": "2026-07-12T10:30:00Z"}) + "\n",
            "utf-8")
        (d / "curation_runs.jsonl").write_text(
            json.dumps({"t": NOW - 300, "trigger": "auto", "n_selected": 2,
                        "n_reviewed": 2, "remaining": 0, "reviewed": [],
                        "enqueued_fixes": []}) + "\n", "utf-8")

        # ledger NOC: 1 sucesso + 1 falha recente (bloqueio) + 1 falha velha (ignora)
        (cls.noc / "actions.jsonl").write_text(
            json.dumps({"t": NOW - 900, "task_id": "T-ok", "title": "sweep ok",
                        "status": "COMMITTED"}) + "\n"
            + json.dumps({"t": NOW - 1200, "task_id": "T-fail", "title": "drain quebrado",
                          "status": "WT_ADD_FAILED"}) + "\n"
            + json.dumps({"t": NOW - 3 * 86400, "task_id": "T-old", "title": "falha velha",
                          "status": "VERIFY_FAILED"}) + "\n", "utf-8")
        (cls.noc / "queue.jsonl").write_text(
            "".join(json.dumps({"id": f"Q{i}", "kind": "variant-sweep"}) + "\n"
                    for i in range(4)), "utf-8")

        os.environ["BFF_SWEEP_ROOT"] = str(cls.root)
        os.environ["BFF_NOC_ROOT"] = str(cls.noc)
        os.environ["BFF_CARTEIRO_RUNS_DIR"] = str(cls.noc)  # sem auto_decider_runs → ok
        import hoje_mirror
        cls.hm = hoje_mirror

    @classmethod
    def tearDownClass(cls):
        for k in ("BFF_SWEEP_ROOT", "BFF_NOC_ROOT", "BFF_CARTEIRO_RUNS_DIR"):
            os.environ.pop(k, None)
        shutil.rmtree(cls.root, ignore_errors=True)
        shutil.rmtree(cls.noc, ignore_errors=True)

    def test_autonomy_answers_the_five_second_rule(self):
        v = self.hm.hoje_view(plant=PLANT, now=NOW)
        a = v["autonomy"]
        self.assertEqual(a["estado"], "RODANDO")            # atividade há 5min
        self.assertEqual(a["estado_banner"], "BLOQUEIOS")   # exceção rebaixa o banner
        self.assertEqual(a["n_bloqueios"], 1)               # só a falha RECENTE
        self.assertEqual(a["bloqueios"][0]["task_id"], "T-fail")
        self.assertGreater(a["n_esperando_voce"], 0)

    def test_missions_have_actor_labels_and_hide_done_and_synthetic(self):
        v = self.hm.hoje_view(plant=PLANT, now=NOW)
        by_tema = {m.get("tema"): m for m in v["missions"]}
        self.assertEqual(by_tema["warm"]["etiqueta"], "ESPERA_VOCE")
        self.assertEqual(by_tema["warm"]["n_esperando_voce"], 2)
        self.assertEqual(by_tema["warm"]["melhor_nota"], 4)
        self.assertEqual(by_tema["dark"]["etiqueta"], "SISTEMA_AGINDO")
        self.assertNotIn("done", by_tema)                    # concluída não aparece
        self.assertNotIn("x", by_tema)                       # sintética nunca vira missão
        self.assertTrue(all(m["etiqueta"] in ("ESPERA_VOCE", "SISTEMA_AGINDO", "BLOQUEADO")
                            for m in v["missions"]))
        # ESPERA_VOCE ordenada primeiro (é o que importa)
        self.assertEqual(v["missions"][0]["etiqueta"], "ESPERA_VOCE")

    def test_inbox_only_human_work_grouped_by_theme(self):
        decisions = [{"id": "d1", "status": "pending", "title": "Gap · SUITE",
                      "question": "Aprovar?"},
                     {"id": "d2", "status": "answered", "title": "já foi"}]
        v = self.hm.hoje_view(decisions=decisions, plant=PLANT, now=NOW)
        tipos = [(i["tipo"], i.get("n")) for i in v["inbox"]]
        self.assertIn(("gosto", 2), tipos)                   # warm agrupado (2 variantes)
        self.assertIn(("decisao", 1), tipos)                 # d1 pending entra
        self.assertEqual(len([i for i in v["inbox"] if i["tipo"] == "decisao"]), 1)  # d2 não

    def test_degrades_honestly_when_sources_missing(self):
        os.environ["BFF_SWEEP_ROOT"] = str(self.root / "nao_existe")
        os.environ["BFF_NOC_ROOT"] = str(self.noc / "nao_existe")
        try:
            v = self.hm.hoje_view(plant=PLANT, now=NOW)
            self.assertEqual(v["autonomy"]["estado"], "PARADO")
            self.assertEqual(v["missions"], [])
            self.assertEqual(v["inbox"], [])
        finally:
            os.environ["BFF_SWEEP_ROOT"] = str(self.root)
            os.environ["BFF_NOC_ROOT"] = str(self.noc)


if __name__ == "__main__":
    unittest.main()
