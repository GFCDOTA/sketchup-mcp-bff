"""test_decision_history_mirror.py — comportamento do vidro do CARTEIRO (auto_decider).

Roda com a venv canônica (o BFF é stdlib-only):
    E:\\Claude\\apps\\sketchup-mcp\\.venv\\Scripts\\python.exe -m pytest tests/ -q

O audit é um FAKE em tempdir via BFF_DECISION_AUDIT (NUNCA o data/ real do motor).
Rails pinados: o BFF só LÊ o audit; linha malformada é PULADA (nunca derruba a view);
mais-recente-primeiro; counts sobre TODAS as decisões; arquivo ausente degrada honesto.
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


def _rec(did: str, action: str, *, decision_type="furniture_program",
         classification="OBJECTIVE_STRONG_FAIL", confidence=0.33, evidence=None,
         judge_verdicts=None, gate=None, decided_by="auto_decider",
         created_at="2026-07-04T05:00:00Z") -> dict:
    """Registro decision_audit_record/1.0.0 mínimo-realista (shape do _record do motor)."""
    return {
        "schema": "decision_audit_record/1.0.0",
        "decision_id": did,
        "decision_type": decision_type,
        "classification": classification,
        "action": action,
        "confidence": confidence,
        "evidence": evidence if evidence is not None else [
            "completude:high BANHO 01 — falta CORE: vaso"],
        "judge_verdicts": judge_verdicts or {"interns": "FAIL", "geometry_sanity": "PASS",
                                             "furniture_overlap": "PASS"},
        "gate": gate,
        "decided_by": decided_by,
        "caps_snapshot": {"max_auto_decisions_per_drain": 20, "max_gate_calls_per_drain": 5},
        "corpus_version": "unknown",
        "created_at": created_at,
    }


class DecisionHistoryMirrorTest(unittest.TestCase):
    """Audit fake com registros realistas: 2 ações + 1 escalada ao gate, uma linha
    quebrada no meio e mojibake — nada disso pode derrubar a leitura."""

    @classmethod
    def setUpClass(cls):
        cls.root = Path(tempfile.mkdtemp(prefix="bff_audit_"))
        cls.audit = cls.root / "auto_decider_audit.jsonl"
        lines = [
            json.dumps(_rec("furniture_program_r005", "auto_reject",
                            confidence=0.33, created_at="2026-07-04T05:00:00Z")),
            "{quebrada",  # linha inválida no meio — PULADA, nunca derruba a view
            json.dumps(_rec("furniture_program_r004", "auto_approve",
                            classification="OBJECTIVE_STRONG_PASS", confidence=1.0,
                            evidence=["interns=PASS", "geometry_sanity=PASS"],
                            judge_verdicts={"interns": "PASS", "geometry_sanity": "PASS",
                                            "furniture_overlap": "PASS"},
                            created_at="2026-07-04T06:00:00Z")),
            json.dumps(_rec("gap_capacidade_r004", "escalated_gate",
                            decision_type="consistency_gap", classification="BORDERLINE",
                            confidence=0.5, decided_by="gate_mode_b",
                            gate={"trigger": "objective_gate_borderline", "status": "ok",
                                  "verdict": "VISUAL_REVIEW", "confidence": "medium",
                                  "applied": None},
                            created_at="2026-07-04T05:30:00Z")),
        ]
        with cls.audit.open("wb") as fh:
            fh.write(("\n".join(lines) + "\n").encode("utf-8"))
            fh.write(b"\xff\xfe lixo nao-utf8\n")  # mojibake real não explode a leitura

        os.environ["BFF_DECISION_AUDIT"] = str(cls.audit)
        import decision_history_mirror
        cls.dh = decision_history_mirror

    @classmethod
    def tearDownClass(cls):
        os.environ.pop("BFF_DECISION_AUDIT", None)
        shutil.rmtree(cls.root, ignore_errors=True)

    def test_parses_valid_records_and_skips_malformed(self):
        v = self.dh.history_view()
        self.assertTrue(v["live"])
        self.assertEqual(v["total"], 3)               # 3 válidas; a quebrada + mojibake PULADAS
        self.assertEqual(len(v["records"]), 3)

    def test_most_recent_first(self):
        recs = self.dh.history_view()["records"]
        # created_at desc: r004 (06:00) → gap (05:30) → r005 (05:00)
        self.assertEqual([r["decision_id"] for r in recs],
                         ["furniture_program_r004", "gap_capacidade_r004", "furniture_program_r005"])

    def test_counts_over_all_records(self):
        counts = self.dh.history_view()["counts"]
        # as 5 chaves sempre presentes (zero-filled), contadas sobre TODAS as decisões
        self.assertEqual(counts, {"auto_approve": 1, "auto_reject": 1, "escalated_gate": 1,
                                  "refused_taste": 0, "left_pending": 0})

    def test_record_shape_carries_the_six_questions(self):
        by = {r["decision_id"]: r for r in self.dh.history_view()["records"]}
        r5 = by["furniture_program_r005"]
        self.assertEqual(r5["decision_type"], "furniture_program")     # O QUE PEDIRAM
        self.assertEqual(r5["classification"], "OBJECTIVE_STRONG_FAIL")  # COMO RESOLVEU
        self.assertEqual(r5["action"], "auto_reject")
        self.assertEqual(r5["confidence"], 0.33)                       # QUÃO CONFIANTE
        self.assertIn("falta CORE: vaso", r5["evidence"][0])           # O QUE USOU (razão)
        self.assertEqual(r5["judge_verdicts"]["interns"], "FAIL")
        self.assertEqual(r5["decided_by"], "auto_decider")            # QUEM DECIDIU
        self.assertEqual(r5["created_at"], "2026-07-04T05:00:00Z")     # QUANDO
        self.assertFalse(r5["dry_run"])                               # audit só grava aplicado
        # a escalada carrega o gate + decided_by=gate_mode_b
        gap = by["gap_capacidade_r004"]
        self.assertEqual(gap["decided_by"], "gate_mode_b")
        self.assertEqual(gap["gate"]["verdict"], "VISUAL_REVIEW")

    def test_limit_slices_but_counts_stay_global(self):
        v = self.dh.history_view(limit=1)
        self.assertEqual(len(v["records"]), 1)                        # só a mais recente
        self.assertEqual(v["records"][0]["decision_id"], "furniture_program_r004")
        self.assertEqual(v["total"], 3)                              # total = TODAS
        self.assertEqual(sum(v["counts"].values()), 3)              # counts globais

    def test_limit_is_clamped_and_defaults_on_garbage(self):
        self.assertLessEqual(len(self.dh.history_view(limit=99999)["records"]), 3)  # clamp p/ <=MAX
        self.assertEqual(len(self.dh.history_view(limit="nan")["records"]), 3)      # fallback default
        self.assertEqual(len(self.dh.history_view(limit=0)["records"]), 1)          # clamp p/ >=1

    def test_evidence_coerces_non_string_items(self):
        # consumidor pode enriquecer evidence com objeto — o vidro coage pra JSON, não repr
        # (unit direto: não muta o fixture compartilhado)
        ev = self.dh._norm_evidence(["texto", {"k": "v"}])
        self.assertEqual(ev[0], "texto")
        self.assertEqual(json.loads(ev[1]), {"k": "v"})               # JSON válido, não str(dict)
        self.assertEqual(self.dh._norm_evidence("nao_lista"), [])      # não-lista → vazio honesto


class MissingAuditTest(unittest.TestCase):
    """BFF_DECISION_AUDIT apontando pro nada — degradação honesta, nunca raise/mock/500."""

    @classmethod
    def setUpClass(cls):
        cls.prev = os.environ.get("BFF_DECISION_AUDIT")
        os.environ["BFF_DECISION_AUDIT"] = str(Path(tempfile.gettempdir()) / "nao_existe_audit.jsonl")
        import decision_history_mirror
        cls.dh = decision_history_mirror

    @classmethod
    def tearDownClass(cls):
        if cls.prev is None:
            os.environ.pop("BFF_DECISION_AUDIT", None)
        else:
            os.environ["BFF_DECISION_AUDIT"] = cls.prev

    def test_absent_file_degrades_honestly(self):
        v = self.dh.history_view()
        self.assertFalse(v["live"])
        self.assertIn("reason", v)
        self.assertEqual(v["records"], [])
        self.assertEqual(v["total"], 0)
        # as 5 chaves de counts existem mesmo sem arquivo (zero-filled)
        self.assertEqual(v["counts"], {"auto_approve": 0, "auto_reject": 0, "escalated_gate": 0,
                                       "refused_taste": 0, "left_pending": 0})


if __name__ == "__main__":
    unittest.main()
