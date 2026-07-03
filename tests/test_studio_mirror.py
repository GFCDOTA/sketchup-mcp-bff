"""test_studio_mirror.py — comportamento do espelho por ARQUIVO do estúdio (:8781 morto).

Roda com a venv canônica (o BFF é stdlib-only, unittest basta):
    E:\\Claude\\apps\\sketchup-mcp\\.venv\\Scripts\\python.exe -m unittest discover -s tests -v

O ENGINE_ROOT é um FAKE em tempdir (NUNCA o motor real — escrita lá é proibida); o único
teste de escrita (decide_proposal) mexe só no fake.
"""
from __future__ import annotations

import importlib
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import time
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

# PNG 1x1 válido (67 bytes) pra fixtures de render
_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d4944415478da63fcff9fa10e0003030101d0a6f3aa0000000049454e44ae426082")


def _w(p: Path, text: str) -> Path:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, "utf-8")
    return p


def _wj(p: Path, obj) -> Path:
    return _w(p, json.dumps(obj, ensure_ascii=False, indent=2))


class StudioMirrorTest(unittest.TestCase):
    """ENGINE_ROOT fake completo — cada view lê a sua fonte; degradação testada à parte."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="studio_mirror_fake_"))
        root = cls.tmp / "engine"
        cls.root = root
        # agents: linha válida + linha quebrada + mojibake (errors='replace')
        act = root / "artifacts/reference_lab/studio_activity.jsonl"
        act.parent.mkdir(parents=True, exist_ok=True)
        with act.open("wb") as f:
            f.write(json.dumps({"ts": 1.0, "agent": "interior-pm", "status": "done",
                                "message": "puxei MT-01", "via": "llama3.1:8b"}).encode() + b"\n")
            f.write(b'{"ts": 2.0, "agent": "interior-designer", "status":\n')          # quebrada
            f.write('{"ts": 3.0, "agent": "interior-designer", "status": "working", "message": "execução"}\n'.encode("utf-8"))
            f.write(b'\xff\xfe{"broken": mojibake}\n')                                  # bytes invalidos
        # renders: 1 valido + 2 com sufixo SKIP
        ang = root / "artifacts/planta_74/furnished/kitchen_angles"
        ang.mkdir(parents=True, exist_ok=True)
        (ang / "a.png").write_bytes(_PNG)
        (ang / "b.denoiser.png").write_bytes(_PNG)
        (ang / "c.effectsResult.png").write_bytes(_PNG)
        # sessions: tabela MT- da coordenação
        _w(root / ".ai_bridge/SESSION_COORDINATION.md",
           "| MT | desc | owner | status |\n"
           "| MT-01 | pele da cozinha | sessao-A | DONE |\n"
           "| MT-02 | geometria | sessao-B | em andamento |\n")
        # backlog: MT-01 [GEO], MT-02 DONE + kanban movendo MT-01
        _w(root / "artifacts/reference_lab/kitchen/spec/KITCHEN_TO_100.md",
           "| MT-01 `[GEO]` | ajustar parede |\n"
           "| **MT-02** | pintar bancada DONE |\n")
        _wj(root / ".ai_bridge/kanban.json", {"MT-01": "execução"})
        # inbox
        _wj(root / "artifacts/reference_lab/inbox/INBOX.json",
            {"items": [{"slug": "ref1", "title": "Cozinha preta", "status": "uploaded",
                        "local_path": "inbox/ref1.png"}]})
        (root / "artifacts/reference_lab/inbox/ref1.png").write_bytes(_PNG)
        # knowledge: 2 blocos KB + judge rules
        _w(root / ".ai_bridge/knowledge/architect.md",
           "\n<!--KB id=1 | title=paleta-->\ncorpo um\n\n<!--KB id=2 | title=luz-->\ncorpo dois\n")
        _wj(root / "references/design_rules/felipe_visual_judge_rules.json",
            {"anti_patterns": [{"what": "piso preto default"}], "flagged": [{"agent": "x", "message": "y"}]})
        # consult: pergunta pendente + resposta + ingested/failed + relay + cycles.jsonl
        c = root / ".ai_bridge/interior_consult"
        _wj(c / "outbox/20260101T000000_q1.json", {"question_id": "q1", "mode": "JUDGE",
                                                   "room": "kitchen", "phase": "skin", "created_at": "t"})
        _wj(c / "outbox/20260102T000000_q2.json", {"question_id": "q2", "mode": "SPEC",
                                                   "room": "sala", "phase": "form", "created_at": "t"})
        _w(c / "inbox/20260102T010000_q2_answer.md", "## Veredito\nPASS")
        _wj(c / "ingested/q1.json", {"question_id": "q1", "rules_added": ["regra ingerida"],
                                     "anti_patterns_added": ["anti ingerido"]})
        _w(c / "failed/20260101T020000_qX.md", "parse falhou")
        _wj(c / "relay.json", {"question_id": "q2", "status": "requested"})
        _w(c / "cycles.jsonl",
           json.dumps({"cycle_id": "CYCLE-001", "mt": "MT-01", "directive": "d1"}) + "\n"
           + "{quebrada\n"
           + json.dumps({"cycle_id": "CYCLE-002", "mt": "MT-02", "directive": "d2"}) + "\n")
        # factory: ciclo do sofá SEM referência ⭐ main → waiting_felipe_curation/blocked
        _wj(root / ".ai_bridge/interior_cycles/CYCLE-001.json",
            {"cycle_id": "CYCLE-001", "project": "planta_74", "room": "living", "asset": "sofa",
             "microtask": "MT-SOFA-001", "title": "sofá ref", "mode": "reference", "status": "running",
             "next_action": "", "steps": [{"agent": "PM", "status": "done", "summary": "ok"}],
             "references": {"pack_id": "sofa_reference_pack_001", "approved": ["r1"],
                            "rejected": [], "main": [], "anti": []},
             "gates": {}, "consult": {"question_id": "q2", "answer_id": None, "ingested": False},
             "learning": {"new_rules": [], "anti_patterns": [], "golden_samples": []}})
        # refpack: r1 aprovado, r2 main → sofa vira build_spec_ready (foco ativo)
        _wj(root / ".ai_bridge/reference_packs/sofa_reference_pack_001.json",
            {"pack_id": "sofa_reference_pack_001", "asset": "sofa", "theme": "BLACK_WOOD_GOLD",
             "honesty": "curada", "direction": "industrial",
             "references": [{"id": "r1", "status": "approved", "og_image": "http://x/1.jpg"},
                            {"id": "r2", "status": "main"}]})
        # patches: 1 applied (alimenta learning) + 1 draft
        _wj(root / ".ai_bridge/learning_patches/LP-SOFA-001.json",
            {"patch_id": "LP-SOFA-001", "status": "applied", "asset": "sofa", "verdict": "PASS",
             "proposed_changes": {"new_rules": ["regra do patch"], "anti_patterns": []},
             "applied": {"rules_added": ["regra do patch"]}})
        _wj(root / ".ai_bridge/learning_patches/LP-SOFA-002.json",
            {"patch_id": "LP-SOFA-002", "status": "draft", "asset": "sofa", "verdict": "WARN",
             "proposed_changes": {"new_rules": ["r nova"], "anti_patterns": ["a nova"]}})
        # proposals: p1 pendente
        _wj(root / ".ai_bridge/proposals/pending/p1.json",
            {"id": "p1", "type": "furniture_program", "environment": "sala",
             "room_id": "sala", "room_name": "Sala", "items": [{"asset": "sofa"}],
             "source_worker": "Arquiteto", "requires_approval": True, "status": "pending"})
        # golden samples
        _w(root / "references/felipe/golden_samples/GOLDEN_SAMPLE_004.md", "golden")
        # kgraph
        _wj(root / "tools/vitrine/kgraph.json", {"nodes": [{"id": "n1"}], "edges": []})
        # sobe o mirror APONTANDO pro fake (reload após setar o env)
        os.environ["BFF_ENGINE_ROOT"] = str(root)
        import file_activity
        importlib.reload(file_activity)
        import studio_mirror
        cls.sm = importlib.reload(studio_mirror)

    @classmethod
    def tearDownClass(cls):
        os.environ.pop("BFF_ENGINE_ROOT", None)
        shutil.rmtree(cls.tmp, ignore_errors=True)
        import file_activity
        importlib.reload(file_activity)
        import studio_mirror
        importlib.reload(studio_mirror)

    # ── contrato do /api/state ──────────────────────────────────────────────
    def test_state_view_has_all_15_blocks_and_matches_sample_keys(self):
        st = self.sm.state_view()
        sample = json.loads((REPO / "mocks/state.sample.json").read_text("utf-8"))
        missing = set(sample.keys()) - set(st.keys())
        self.assertFalse(missing, f"state_view sem blocos do contrato: {missing}")
        # sub-shapes que os _derive_* do cockpit consomem
        self.assertEqual(set(sample["agents"].keys()) - set(st["agents"].keys()), set())
        self.assertIn("claims", st["sessions"])
        self.assertIn("pending", st["proposals"])
        self.assertIn("active_focuses", st["overview"])

    # ── agents ──────────────────────────────────────────────────────────────
    def test_tail_skips_invalid_jsonl_and_mojibake(self):
        ag = self.sm.agents_view()
        agents_no_feed = {r["agent"] for r in ag["feed"]}
        self.assertIn("interior-pm", agents_no_feed)
        self.assertIn("interior-designer", agents_no_feed)
        self.assertEqual(len(ag["feed"]), 2)          # quebrada + mojibake PULADAS
        self.assertEqual(ag["metrics"]["interior-pm"]["calls"], 1)
        self.assertEqual(ag["model_usage"].get("llama3.1:8b"), 1)
        # sem probe do Ollama → online False honesto (nunca inventa)
        for u in ag["umbrellas"]:
            self.assertFalse(u["lead"]["online"])

    def test_agents_online_via_probe_injetado(self):
        self.sm.set_ollama_probe(lambda path, timeout=2.0: {"models": [{"name": "llama3.1:8b"}]})
        try:
            ag = self.sm.agents_view()
            pm = next(u["lead"] for u in ag["umbrellas"] if u["id"] == "pm")
            arq = next(u["lead"] for u in ag["umbrellas"] if u["id"] == "architect")
            self.assertTrue(pm["online"])             # PM usa llama → vivo
            self.assertFalse(arq["online"])           # Arquiteto usa deepseek → ausente
        finally:
            self.sm.set_ollama_probe(None)

    # ── renders + imagens ───────────────────────────────────────────────────
    def test_renders_skip_denoiser_and_effects_suffix(self):
        r = self.sm.renders_view()
        self.assertEqual([x["name"] for x in r], ["a.png"])
        self.assertEqual(r[0]["sub"], "render")
        self.assertGreaterEqual(r[0]["kb"], 0)

    def test_render_image_serves_exact_bytes(self):
        got = self.sm.render_image("a.png")
        self.assertIsNotNone(got)
        body, ctype = got
        self.assertEqual(body, _PNG)
        self.assertEqual(ctype, "image/png")

    def test_render_image_blocks_path_traversal(self):
        self.assertIsNone(self.sm.render_image("../SESSION_COORDINATION.md"))
        self.assertIsNone(self.sm.render_image("../../.ai_bridge/kanban.json"))
        self.assertIsNone(self.sm.render_image(str(self.root / ".ai_bridge/kanban.json")))
        self.assertIsNone(self.sm.render_image(""))
        self.assertIsNone(self.sm.render_image("nao_existe.png"))

    def test_inbox_image_serves_and_guards(self):
        got = self.sm.inbox_image("ref1.png")
        self.assertIsNotNone(got)
        self.assertEqual(got[0], _PNG)
        self.assertIsNone(self.sm.inbox_image("../INBOX_fora/x.png"))
        self.assertIsNone(self.sm.inbox_image("INBOX.json"))   # extensão não-imagem

    # ── sessions / backlog / knowledge ──────────────────────────────────────
    def test_sessions_claims_parse(self):
        s = self.sm.sessions_view()
        self.assertEqual([c["mt"] for c in s["claims"]], ["MT-01", "MT-02"])
        self.assertEqual(s["claims"][0]["owner"], "sessao-A")

    def test_backlog_counts_geo_done_and_kanban_status(self):
        b = self.sm.backlog_view()
        self.assertEqual(b["total"], 2)
        self.assertEqual(b["geo"], 1)
        self.assertEqual(b["done"], 1)
        by = {t["mt"]: t for t in b["tasks"]}
        self.assertEqual(by["MT-01"]["status"], "execução")    # kanban vence
        self.assertEqual(by["MT-02"]["status"], "executado")   # DONE sem kanban

    def test_kb_blocks_parsed_with_stable_ids(self):
        k = self.sm.knowledge_view()
        self.assertEqual([e["id"] for e in k["entries"]], [1, 2])
        self.assertEqual(k["entries"][0]["title"], "paleta")
        self.assertTrue(k["entries"][0]["preview"].startswith("corpo um"))
        self.assertFalse(k["dna"])
        self.assertEqual(k["judge"], {"anti_patterns": 1, "flagged": 1})

    # ── references (SQLite ro) ──────────────────────────────────────────────
    def test_refdb_opened_readonly_never_creates(self):
        db = self.root / "artifacts/reference_lab/reference.db"
        self.assertFalse(db.exists())
        self.sm._REF_CACHE.update(t=0.0, v=None)
        out = self.sm.references_view()
        self.assertIn("error", out)
        self.assertFalse(db.exists(), "mirror NUNCA cria o reference.db (o :8781 criava)")
        # agora com db real (criado PELO TESTE, rw) o mirror lê em ro
        con = sqlite3.connect(db)
        con.execute("CREATE TABLE reference (kind TEXT, theme TEXT)")
        con.execute("INSERT INTO reference VALUES ('render','dark'), ('render','dark'), ('spec',NULL)")
        con.commit()
        con.close()
        self.sm._REF_CACHE.update(t=0.0, v=None)
        out = self.sm.references_view()
        self.assertEqual(out["by_kind"], {"render": 2, "spec": 1})
        self.assertEqual(out["by_theme"], {"dark": 2})
        db.unlink()
        self.sm._REF_CACHE.update(t=0.0, v=None)

    # ── consult / cycles ────────────────────────────────────────────────────
    def test_consult_view_pending_and_latest(self):
        cv = self.sm.consult_view()
        self.assertEqual([p["question_id"] for p in cv["pending_questions"]], ["q2"])
        self.assertEqual(cv["latest_question"]["question_id"], "q2")
        self.assertIn("Veredito", cv["latest_answer"])
        self.assertEqual(cv["ingested_count"], 1)
        self.assertEqual(cv["failed_count"], 1)
        self.assertIsNone(cv["latest_question_md"])            # degradado honesto
        self.assertFalse(cv["openai_enabled"])                 # degradado honesto
        self.assertEqual(cv["relay"]["status"], "requested")

    def test_cycles_view_recent_first_skips_broken(self):
        cs = self.sm.cycles_view(8)
        self.assertEqual([c["cycle_id"] for c in cs], ["CYCLE-002", "CYCLE-001"])

    # ── factory / overview ──────────────────────────────────────────────────
    def test_factory_derive_status_waiting_curation_sem_main(self):
        f = self.sm.factory_view()
        self.assertTrue(f["has_cycle"])
        self.assertEqual(f["status"], "waiting_felipe_curation")
        self.assertTrue(f["architect_blocked"])
        agents = {s["agent"]: s for s in f["timeline"]}
        self.assertEqual(agents["Architect"]["status"], "blocked")
        self.assertEqual(agents["PM"]["status"], "done")
        self.assertEqual(f["next_step"]["kind"], "curate")

    def test_overview_active_focus_pipeline_shape(self):
        ov = self.sm.overview_view()
        focus = {f["asset"]: f for f in ov["active_focuses"]}
        # sofa: pack com main + patch applied no... learning do ciclo está vazio → main ⇒ build_spec_ready
        self.assertIn("sofa", focus)
        self.assertEqual(focus["sofa"]["state"], "build_spec_ready")
        for stage in focus["sofa"]["pipeline"]:
            self.assertEqual({"icon", "label", "status"}, set(stage.keys()))
        rooms = {r["key"]: r for r in ov["rooms"]}
        self.assertEqual(rooms["cozinha"]["assets"][0]["state"], "frozen")   # FIXED_STATE
        self.assertEqual(rooms["cozinha"]["done"], 1)
        # programa aprovado ainda não existe → assets default
        self.assertEqual(rooms["sala"]["assets_source"], "default")

    def test_refpack_counts(self):
        rp = self.sm.refpack_view("sofa_reference_pack_001")
        self.assertTrue(rp["ok"])
        self.assertEqual(rp["counts"]["main"], 1)
        self.assertEqual(rp["counts"]["approved"], 1)
        missing = self.sm.refpack_view("nao_existe_pack")
        self.assertFalse(missing["ok"])
        self.assertEqual(missing["references"], [])

    def test_learning_and_patches(self):
        lv = self.sm.learning_view()
        self.assertIn("regra ingerida", lv["new_rules"])
        self.assertIn("regra do patch", lv["new_rules"])       # applied via LEARNING_PATCH
        self.assertIn("anti ingerido", lv["anti_patterns"])
        self.assertIn("piso preto default", lv["anti_patterns"])
        self.assertEqual(lv["golden_samples"], ["GOLDEN_SAMPLE_004"])
        pv = self.sm.patches_view()
        self.assertEqual(pv["draft"]["patch_id"], "LP-SOFA-002")
        self.assertIsNone(pv["diff"])                          # degradado (código do motor)
        self.assertEqual(pv["counts"], {"draft": 1, "applied": 1, "rejected": 0})

    # ── kgraph ──────────────────────────────────────────────────────────────
    def test_kgraph_reads_file(self):
        kg = self.sm.kgraph_view()
        self.assertEqual(kg["nodes"][0]["id"], "n1")

    # ── decide (ÚNICA escrita, no fake) ─────────────────────────────────────
    def test_decide_proposal_moves_file_and_is_idempotent(self):
        pend = self.root / ".ai_bridge/proposals/pending/p1.json"
        appr = self.root / ".ai_bridge/proposals/approved/p1.json"
        self.assertTrue(pend.exists())
        moved = self.sm.decide_proposal("p1", "approve")
        self.assertEqual(moved["status"], "approved")
        self.assertFalse(pend.exists())
        self.assertTrue(appr.exists())
        self.assertEqual(json.loads(appr.read_text("utf-8"))["status"], "approved")
        # segunda chamada → None (handler devolve 404) — idempotente
        self.assertIsNone(self.sm.decide_proposal("p1", "approve"))
        # ação desconhecida → None
        self.assertIsNone(self.sm.decide_proposal("p1", "propose"))
        # restaura o fixture pro resto da suíte (ordem-independente)
        appr.rename(pend)
        data = json.loads(pend.read_text("utf-8"))
        data["status"] = "pending"
        pend.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")

    def test_decide_proposal_missing_returns_none(self):
        self.assertIsNone(self.sm.decide_proposal("nao-existe", "approve"))
        self.assertIsNone(self.sm.decide_proposal("nao-existe", "reject"))


class EmptyEngineRootTest(unittest.TestCase):
    """Degradação honesta: ENGINE_ROOT vazio/inexistente NUNCA levanta, NUNCA fabrica."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="studio_mirror_empty_"))
        os.environ["BFF_ENGINE_ROOT"] = str(cls.tmp / "nao_existe")
        import file_activity
        importlib.reload(file_activity)
        import studio_mirror
        cls.sm = importlib.reload(studio_mirror)

    @classmethod
    def tearDownClass(cls):
        os.environ.pop("BFF_ENGINE_ROOT", None)
        shutil.rmtree(cls.tmp, ignore_errors=True)
        import file_activity
        importlib.reload(file_activity)
        import studio_mirror
        importlib.reload(studio_mirror)

    def test_empty_engine_root_degrades_honest_never_raises(self):
        self.sm._REF_CACHE.update(t=0.0, v=None)
        st = self.sm.state_view()   # não pode levantar
        self.assertEqual(st["renders"], [])
        self.assertEqual(st["inbox"], [])
        self.assertEqual(st["cycles"], [])
        self.assertEqual(st["proposals"], {"pending": [], "approved": [], "rejected": []})
        self.assertIn("error", st["references"])
        self.assertFalse(st["factory"]["has_cycle"])
        self.assertEqual(st["backlog"]["total"], 0)
        self.assertEqual(st["knowledge"]["entries"], [])
        self.assertIsNone(st["consult"]["latest_question"])
        self.assertEqual(st["sessions"]["claims"], [])
        # kgraph degrada com live:false + reason (nunca mock)
        kg = self.sm.kgraph_view()
        self.assertFalse(kg["live"])
        self.assertIn("reason", kg)
        # imagens → None (404 no handler)
        self.assertIsNone(self.sm.render_image("a.png"))
        self.assertIsNone(self.sm.inbox_image("x.png"))
        # decide sem dir pending → None (proposta inexistente)
        self.assertIsNone(self.sm.decide_proposal("p1", "approve"))


class ReviewFixRegressionTest(unittest.TestCase):
    """Pina os fixes do review adversarial: byte inválido não derruba view (UnicodeDecodeError
    não é OSError), renders inferem theme/sub reais, pack malformado não explode o state."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="studio_mirror_fix_"))
        root = cls.tmp / "engine"
        cls.root = root
        # architect.md com header KB válido + byte 0xE9 solto (UTF-8 inválido — flush no meio
        # de char multibyte do append ao vivo do motor)
        kb = root / ".ai_bridge/knowledge/architect.md"
        kb.parent.mkdir(parents=True, exist_ok=True)
        kb.write_bytes(b"<!--KB id=1 | title=Regra viva-->\ncorpo caf\xe9 truncado\n")
        # answer .md colado em cp1252 (0xE3 = 'ã' fora de UTF-8)
        inbox = root / ".ai_bridge/interior_consult/inbox"
        inbox.mkdir(parents=True, exist_ok=True)
        (inbox / "20260703T000000Z_answer.md").write_bytes(b"resposta n\xe3o-utf8\n")
        # renders com keywords reais + um sem keyword
        ang = root / "artifacts/planta_74/furnished/kitchen_angles"
        ang.mkdir(parents=True, exist_ok=True)
        (ang / "black_wood_gold_hero.png").write_bytes(_PNG)
        (ang / "sem_keyword.png").write_bytes(_PNG)
        # pack com reference string (malformada) no meio das dicts
        _wj(root / ".ai_bridge/reference_packs/pack_bad.json",
            {"asset": "sofa", "references": ["string_perdida", {"status": "approved"}]})
        os.environ["BFF_ENGINE_ROOT"] = str(root)
        import file_activity
        importlib.reload(file_activity)
        import studio_mirror
        cls.sm = importlib.reload(studio_mirror)

    @classmethod
    def tearDownClass(cls):
        os.environ.pop("BFF_ENGINE_ROOT", None)
        shutil.rmtree(cls.tmp, ignore_errors=True)
        import file_activity
        importlib.reload(file_activity)
        import studio_mirror
        importlib.reload(studio_mirror)

    def test_invalid_utf8_never_raises_kb_and_answer_degrade_com_replace(self):
        entries = self.sm._kb_read()          # não pode levantar UnicodeDecodeError
        self.assertEqual(entries[0]["id"], 1)
        self.assertIn("caf", entries[0]["body"])
        kv = self.sm.knowledge_view()
        self.assertGreater(kv["chars"], 0)
        la = self.sm._latest_answer()
        self.assertIsNotNone(la)
        self.assertIn("resposta", la["raw"])
        cv = self.sm.consult_view()           # a view inteira segue respondendo
        self.assertIn("latest_answer", cv)

    def test_renders_infer_theme_and_sub_from_filename(self):
        by_name = {r["name"]: r for r in self.sm.renders_view()}
        hero = by_name["black_wood_gold_hero.png"]
        self.assertEqual(hero["theme"], "black_wood_gold")
        self.assertEqual(hero["sub"], "hero_render")
        plain = by_name["sem_keyword.png"]
        self.assertEqual(plain["theme"], "-")
        self.assertEqual(plain["sub"], "render")

    def test_pack_counts_skips_non_dict_references(self):
        counts = self.sm._pack_counts({"references": ["string_perdida", {"status": "approved"}]})
        self.assertEqual(counts["total"], 2)
        self.assertEqual(counts["approved"], 1)
        st = self.sm.state_view()             # pack malformado presente → não pode levantar
        self.assertIn("refpack", st)


if __name__ == "__main__":
    unittest.main()
