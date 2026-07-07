"""test_carteiro_run_mirror.py — gatilho + acionamentos do CARTEIRO.

Roda com a venv canônica (o BFF é stdlib-only):
    E:\\Claude\\apps\\sketchup-mcp\\.venv\\Scripts\\python.exe -m pytest tests/ -q

O `data/runs` é um FAKE em tempdir via BFF_CARTEIRO_RUNS_DIR (NUNCA o data/ real do
motor). Rails pinados: a ÚNICA escrita é o gatilho (idempotente); a leitura dos runs
só LÊ, pula linha malformada, é mais-recente-primeiro, e degrada honesto sem arquivo.
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


def _run(t: str, *, trigger="manual", decided=0, auto_approve=0, auto_reject=0,
         escalated=0, left_pending=0, dry_run=False) -> dict:
    """Registro de acionamento (o shape que o atuador/motor grava por drain)."""
    return {"t": t, "trigger": trigger, "decided": decided, "auto_approve": auto_approve,
            "auto_reject": auto_reject, "escalated": escalated,
            "left_pending": left_pending, "dry_run": dry_run}


class QueueRunTest(unittest.TestCase):
    """A ÚNICA escrita do BFF no motor: TOCAR o gatilho. Idempotente; só data/runs."""

    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="bff_carteiro_"))
        os.environ["BFF_CARTEIRO_RUNS_DIR"] = str(self.root)
        import carteiro_run_mirror
        self.cr = carteiro_run_mirror

    def tearDown(self):
        os.environ.pop("BFF_CARTEIRO_RUNS_DIR", None)
        shutil.rmtree(self.root, ignore_errors=True)

    def test_queue_run_writes_trigger_marker(self):
        res = self.cr.queue_run(now="2026-07-07T12:00:00+00:00")
        self.assertTrue(res["ok"])
        self.assertEqual(res["queued_at"], "2026-07-07T12:00:00+00:00")
        self.assertIn("sweep", res["note"])
        marker = json.loads((self.root / "carteiro_trigger").read_text("utf-8"))
        self.assertTrue(marker["ok"])
        self.assertEqual(marker["queued_at"], "2026-07-07T12:00:00+00:00")
        self.assertEqual(marker["source"], "manual")

    def test_queue_run_is_idempotent(self):
        self.cr.queue_run(now="2026-07-07T12:00:00+00:00")
        self.cr.queue_run(source="ui", now="2026-07-07T12:05:00+00:00")   # re-tocar = ok
        marker = json.loads((self.root / "carteiro_trigger").read_text("utf-8"))
        self.assertEqual(marker["queued_at"], "2026-07-07T12:05:00+00:00")  # last-wins
        self.assertEqual(marker["source"], "ui")

    def test_queue_run_creates_runs_dir_when_missing(self):
        nested = self.root / "deep" / "data" / "runs"
        os.environ["BFF_CARTEIRO_RUNS_DIR"] = str(nested)
        self.cr.queue_run(now="2026-07-07T12:00:00+00:00")
        self.assertTrue((nested / "carteiro_trigger").is_file())

    def test_queue_run_raises_when_dir_unwritable(self):
        # gatilho apontando pra um ARQUIVO (não-dir) → mkdir/write levanta OSError,
        # que o caller traduz em 503 honesto (nunca finge que enfileirou).
        blocker = self.root / "not_a_dir"
        blocker.write_text("x", encoding="utf-8")
        os.environ["BFF_CARTEIRO_RUNS_DIR"] = str(blocker / "runs")
        with self.assertRaises(OSError):
            self.cr.queue_run()


class RunsViewTest(unittest.TestCase):
    """Ledger fake com 3 runs (um dry-run, um com listas em vez de counts) + linha
    quebrada + mojibake — nada disso pode derrubar a leitura."""

    @classmethod
    def setUpClass(cls):
        cls.root = Path(tempfile.mkdtemp(prefix="bff_carteiro_runs_"))
        cls.ledger = cls.root / "auto_decider_runs.jsonl"
        lines = [
            json.dumps(_run("2026-07-04T05:00:00+00:00", trigger="auto",
                            decided=2, auto_approve=1, auto_reject=1)),
            "{quebrada",  # inválida no meio — PULADA
            json.dumps(_run("2026-07-04T06:00:00+00:00", trigger="manual",
                            decided=1, auto_approve=1, dry_run=True)),
            # registro no idioma do drain: listas em vez de counts (projeção defensiva)
            json.dumps({"t": "2026-07-04T05:30:00+00:00", "source": "auto",
                        "decided": [{"decision_id": "x", "action": "auto_reject"}],
                        "escalated": [{"decision_id": "y"}], "left_pending": ["z"]}),
        ]
        with cls.ledger.open("wb") as fh:
            fh.write(("\n".join(lines) + "\n").encode("utf-8"))
            fh.write(b"\xff\xfe lixo nao-utf8\n")

        os.environ["BFF_CARTEIRO_RUNS_DIR"] = str(cls.root)
        import carteiro_run_mirror
        cls.cr = carteiro_run_mirror

    @classmethod
    def tearDownClass(cls):
        os.environ.pop("BFF_CARTEIRO_RUNS_DIR", None)
        shutil.rmtree(cls.root, ignore_errors=True)

    def test_parses_valid_and_skips_malformed(self):
        v = self.cr.runs_view()
        self.assertTrue(v["live"])
        self.assertEqual(v["total"], 3)          # 3 válidas; quebrada + mojibake PULADAS
        self.assertEqual(len(v["runs"]), 3)

    def test_most_recent_first_and_last_run(self):
        v = self.cr.runs_view()
        # t desc: 06:00 → 05:30 → 05:00
        self.assertEqual([r["t"] for r in v["runs"]],
                         ["2026-07-04T06:00:00+00:00", "2026-07-04T05:30:00+00:00",
                          "2026-07-04T05:00:00+00:00"])
        self.assertEqual(v["last_run"], "2026-07-04T06:00:00+00:00")

    def test_projection_shape_and_dry_run(self):
        by = {r["t"]: r for r in self.cr.runs_view()["runs"]}
        top = by["2026-07-04T06:00:00+00:00"]
        self.assertEqual(top["trigger"], "manual")
        self.assertEqual(top["decided"], 1)
        self.assertEqual(top["auto_approve"], 1)
        self.assertTrue(top["dry_run"])

    def test_defensive_count_from_lists(self):
        # o registro no idioma do drain (listas) vira counts, sem levantar
        r = {x["t"]: x for x in self.cr.runs_view()["runs"]}["2026-07-04T05:30:00+00:00"]
        self.assertEqual(r["trigger"], "auto")     # veio de `source`
        self.assertEqual(r["decided"], 1)          # len da lista
        self.assertEqual(r["escalated"], 1)
        self.assertEqual(r["left_pending"], 1)

    def test_limit_slices(self):
        v = self.cr.runs_view(limit=1)
        self.assertEqual(len(v["runs"]), 1)
        self.assertEqual(v["runs"][0]["t"], "2026-07-04T06:00:00+00:00")
        self.assertEqual(v["total"], 3)            # total = TODOS
        self.assertEqual(len(self.cr.runs_view(limit=99999)["runs"]), 3)  # clamp <= total
        self.assertEqual(len(self.cr.runs_view(limit="nan")["runs"]), 3)  # fallback default


class MissingLedgerTest(unittest.TestCase):
    """BFF_CARTEIRO_RUNS_DIR sem o jsonl — degradação honesta, nunca raise/mock/500."""

    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="bff_carteiro_empty_"))
        os.environ["BFF_CARTEIRO_RUNS_DIR"] = str(self.root)
        import carteiro_run_mirror
        self.cr = carteiro_run_mirror

    def tearDown(self):
        os.environ.pop("BFF_CARTEIRO_RUNS_DIR", None)
        shutil.rmtree(self.root, ignore_errors=True)

    def test_absent_ledger_degrades_honestly(self):
        v = self.cr.runs_view()
        self.assertFalse(v["live"])
        self.assertIn("reason", v)
        self.assertEqual(v["runs"], [])
        self.assertIsNone(v["last_run"])
        self.assertEqual(v["total"], 0)


if __name__ == "__main__":
    unittest.main()
