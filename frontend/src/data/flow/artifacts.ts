import type { ArtifactDoc } from "./types";

export const artifactDocs: ArtifactDoc[] = [
  {
    "type": "CYCLE (.ai_bridge/interior_cycles/CYCLE-NNN.json)",
    "description": "Entidade de 1ª classe do ciclo: microtarefa rastreável com a timeline das 8 etapas (PM→Team Lead→Scout→Felipe→Architect→Gates→Consult→Learning), referências curadas, gates, consult e learning. O dashboard lê isto pra mostrar a VERDADE DO PROCESSO.",
    "examplePath": "D:/Claude/sketchup-mcp/.ai_bridge/interior_cycles/CYCLE-003.json",
    "origin": "tools/interior_studio/cycles.py (new_cycle/save_cycle/set_step)",
    "lifecycle": "running → (derive_status: waiting_felipe_curation → ready_for_sofa_build_spec_after_gpt_patch → ready_for_build_spec) → done/frozen/archived",
    "status": "implemented"
  },
  {
    "type": "Reference Pack (.ai_bridge/reference_packs/<asset>_reference_pack_001.json)",
    "description": "Pack de referências visuais como entidade de 1ª classe; cada ref tem status (pending/approved/main/rejected/anti). Regra-trava: sem ⭐ principal o Arquiteto fica bloqueado. Curadoria persiste em references/felipe/<bucket>/<ref_id>.json.",
    "examplePath": "D:/Claude/sketchup-mcp/.ai_bridge/reference_packs/sofa_reference_pack_001.json",
    "origin": "tools/interior_studio/reference_packs.py (curate/save_pack) + Reference Scout",
    "lifecycle": "ingerido pelo Scout → curado pelo Felipe (👍/👎/⭐/🚫) → sincronizado no cycle.references → destrava o Arquiteto",
    "status": "implemented"
  },
  {
    "type": "furniture_program proposal (.ai_bridge/proposals/{pending,approved,rejected}/furniture_program_<room>.json)",
    "description": "Programa de mobiliário proposto pelo Arquiteto (LLM) e normalizado pelo gate determinístico (CORE injetado, cross-cômodo removido). Nada entra direto: requires_approval=True; Felipe aprova. project_state lê o aprovado pra montar o inventário dinâmico.",
    "examplePath": "D:/Claude/sketchup-mcp/.ai_bridge/proposals/approved/furniture_program_r004.json",
    "origin": "tools/interior_studio/architect_program.py (propose_and_save) + proposals.py",
    "lifecycle": "pending → approve()/reject() (move o arquivo entre pastas) → approved_program() alimenta o inventário",
    "status": "implemented"
  },
  {
    "type": "consistency_gap proposal (.ai_bridge/proposals/pending/gap_<intern>_<room>.json)",
    "description": "Achado de um Estagiário do Arquiteto (pertencimento/completude/nomenclatura/capacidade/redundância/estilo) sobre um furniture_program, convertido em proposal pra Felipe aprovar/ignorar. Não muta nada.",
    "examplePath": "D:/Claude/sketchup-mcp/.ai_bridge/proposals/pending/gap_capacidade_r004.json",
    "origin": "tools/interior_studio/interns.py (gaps_for_program) + auditor.py + proposals.py",
    "lifecycle": "gerado pelos estagiários → salvo como pending → aprovado/deletado pelo Felipe (auditor limpa gaps obsoletos)",
    "status": "implemented"
  },
  {
    "type": "gpt_verdict sidecar (artifacts/review/furniture/<asset>/<gate>/gpt_verdict.json)",
    "description": "Veredito GPT estruturado {asset,gate,verdict,environment} de um asset (gate ∈ form/context/vray). project_state.asset_state deriva o estado da máquina de 11 fases a partir disto (sem caçar substring em markdown). Espelho humano opcional em gpt_verdict.md.",
    "examplePath": "D:/Claude/sketchup-mcp/artifacts/review/furniture/sofa/form/gpt_verdict.json",
    "origin": "tools/interior_studio/project_state.py (save_asset_verdict) a partir do veredito do GPT/Felipe",
    "lifecycle": "escrito após veredito visual → lido por asset_state → avança o estado (form_review_needed→context_review_needed→vray_ready→approved)",
    "status": "implemented"
  },
  {
    "type": "render PNG (artifacts/planta_74/furnished/kitchen_angles/*.png)",
    "description": "Renders gerados (ângulos da cozinha/cômodo) que o dashboard lista em /api/state.renders e o cockpit deriva como artifacts type=render (servidos via /img/<name>). Pula .denoiser/.effectsResult.",
    "examplePath": "D:/Claude/sketchup-mcp/artifacts/planta_74/furnished/kitchen_angles/",
    "origin": "pipeline de render (V-Ray) do engine; listados por studio_dashboard._renders()",
    "lifecycle": "gerado pelo render → listado no /api/state → derivado em /api/artifacts → validado por render_judge / Felipe",
    "status": "implemented"
  },
  {
    "type": "render_judge ledger (.ai_bridge/interior_studio/render_judge_verdicts.jsonl)",
    "description": "Append-only de vereditos do juiz de render por tema (ts, image, theme, overall, checks, taste) — progresso render-a-render. Distinto dos estagiários (que validam o programa, não a imagem).",
    "examplePath": "D:/Claude/sketchup-mcp/.ai_bridge/interior_studio/render_judge_verdicts.jsonl",
    "origin": "tools/interior_studio/render_judge.py (log_verdict, com flag --log)",
    "lifecycle": "append a cada validação de render; histórico consultivo (não veredito final)",
    "status": "implemented"
  },
  {
    "type": "GPT_REVIEW_BUNDLE (.ai_bridge/gpt_review/GPT_REVIEW_BUNDLE.{md,json})",
    "description": "Pacote único de revisão pro Consult GPT (que não acessa localhost): repo branch/SHA, links raw dos arquivos-chave, resumo do /api/state, ciclo atual, reference pack curado, mudanças desde a última revisão e a pergunta objetiva.",
    "examplePath": "D:/Claude/sketchup-mcp/.ai_bridge/gpt_review/GPT_REVIEW_BUNDLE.md",
    "origin": "tools/interior_studio/gpt_review_bundle.py (build) a partir do state do dashboard",
    "lifecycle": "regenerado on-demand (sobrescreve md+json); .last_review_sha rastreia o diff entre revisões",
    "status": "implemented"
  },
  {
    "type": "SKP canônico + sidecars (artifacts/<plant>/<plant>.skp + metadata/renders/report)",
    "description": "Deliverable humano mais importante: .skp fiel à planta + metadata (consensus SHA256), renders iso/top, geometry_report.json, side_by_side_pdf_vs_skp.png e README de provenance. Path fixo sem timestamp aponta pro último build correto.",
    "examplePath": "D:/Claude/sketchup-mcp/artifacts/planta_74/planta_74.skp",
    "origin": "tools/build_plan_shell_skp.{py,rb} --promote / tools/promote_canonical.py (runs/ → artifacts/)",
    "lifecycle": "build em runs/<plant>/ (scratch, gitignored) → gates verdes + VISUAL_REVIEW → promovido pra artifacts/<plant>/ (tracked, vai pra develop/main)",
    "status": "implemented"
  },
  {
    "type": "runs do cockpit (in-memory RUNS via /api/runs)",
    "description": "Histórico de runs de agente/workflow exibido no cockpit, com steps (plan/execute/verify) e logs ao vivo (SSE). Semeado de sessions.claims do state espelhado por arquivo; novos runs são disparados pelo runner STUB (_runner simula steps + uma falha pseudo-determinística no 'verify').",
    "examplePath": "D:/Claude/sketchup-mcp-bff/cockpit_api.py (RUNS dict, _start_run/_runner)",
    "origin": "cockpit_api.py (_seed_runs a partir de /api/state; _start_run via POST /api/{agents,workflows}/<id>/run)",
    "lifecycle": "queued → running → succeeded/failed; volátil (em memória, perde no restart). É o ponto de plugue pra um runner real",
    "status": "mock"
  }
];
