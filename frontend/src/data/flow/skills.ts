import type { SkillDoc, SpecDoc } from "./types";

// As 18 skills agênticas do motor (sketchup-mcp/.claude/skills) — a "esteira por responsabilidade".
export const skillDocs: SkillDoc[] = [
  { name: "pdf-to-skp-pipeline", track: "pipeline", summary: "PDF → consensus.json → .skp: o núcleo da extração e do build." },
  { name: "generate-and-compare-skp-after-change", track: "pipeline", summary: "Gera .skp + renders e compara before/after após mudança de fidelidade." },
  { name: "skp-artifact-management", track: "pipeline", summary: "Promove/versiona o .skp (runs/ → artifacts/) — protege o deliverable." },

  { name: "fidelity-review", track: "gates", summary: "Revisa se o .skp é fiel ao PDF (room/wall fidelity, side-by-side)." },
  { name: "skp-visual-self-correction", track: "gates", summary: "Visual Oracle (FP-030): porta flutuante, vidro órfão, vazamento de piso; loop até 3x." },
  { name: "gpt-review-gate", track: "gates", summary: "Gate de GPT_REVIEW: o GPT valida toda mudança de aparência (nunca auto-julga)." },
  { name: "autonomous-fidelity-loop", track: "gates", summary: "Loop contínuo de fidelidade com log por ciclo; para em RED/patinagem/NEEDS-HUMAN." },

  { name: "interior-architect-planner", track: "interiores", summary: "Planeja como arquiteto+marceneiro: função, móvel-herói, circulação, só então render." },
  { name: "interior-design", track: "interiores", summary: "Mobília a planta com móveis reais do 3D Warehouse (variantes estilizadas vN)." },
  { name: "planned-furniture-designer", track: "interiores", summary: "Móveis planejados com ergonomia, modulação e dimensões reais." },
  { name: "planned-joinery-translator", track: "interiores", summary: "Traduz referência visual (Pinterest) em gramática de planejado, sem copiar a imagem." },
  { name: "reference-to-joinery-translator", track: "interiores", summary: "Compila referência curada em SISTEMA de cozinha (medida + ergonomia + buildability)." },
  { name: "joinery-ergonomics-reference", track: "interiores", summary: "Medidas e clearances de planejado (bancada, aéreo, coifa, geladeira)." },
  { name: "furniture-reference-analyzer", track: "interiores", summary: "Inspeciona um .skp de referência (IKEA etc.) e extrai dims/anatomia/material." },

  { name: "gpt-auto-consult-gate", track: "decisao", summary: "Consulta o GPT automaticamente em decisão real (9 triggers) em vez de travar no humano." },

  { name: "repo-governance", track: "ops", summary: "PR / branch / merge / hygiene — develop-first." },
  { name: "gh-autopilot", track: "ops", summary: "Automatiza commit → PR → merge → cleanup via gh CLI (+ auth)." },
  { name: "multi-agent-handoff", track: "ops", summary: "Coordenação multi-agente / worktrees via .ai_bridge / HANDOFF." },
];

// As specs (sketchup-mcp/.claude/specs) — o contrato vivo do motor.
export const specDocs: SpecDoc[] = [
  { file: "product_goal.md", title: "Product goal", summary: "O norte do produto: gerar um .skp fiel ao PDF da planta." },
  { file: "fidelity_gate.md", title: "Fidelity gate", summary: "Critério de fidelidade SKP × PDF (room/wall, vereditos)." },
  { file: "gate_framework_and_audit.md", title: "Gate Framework + Audit", summary: "Framework dos gates + audit core + worker headless." },
  { file: "skp_proof_of_progress_gate.md", title: "Proof-of-Progress", summary: "Sem .skp novo, não há progresso — o gate de evidência." },
  { file: "skp_artifact_layout.md", title: "Artifact layout", summary: "Onde o .skp e os renders vivem (artifacts/<plant>/)." },
  { file: "generalize_any_plant.md", title: "Generalizar p/ qualquer planta", summary: "Tirar o pipeline do hard-code da planta_74." },
  { file: "generalize_builder_constants.md", title: "Constantes do builder", summary: "Generalizar as constantes do builder por planta." },
  { file: "room_furnishing_method.md", title: "Room Furnishing Method", summary: "O método de mobiliar (golden-sample)." },
  { file: "interior_common_sense.md", title: "Interior Common Sense", summary: "Regras de bom senso de interiores." },
  { file: "perfect_reference_strategy.md", title: "Reference strategy", summary: "Como curar a referência perfeita." },
  { file: "sdd_and_harness_engineering.md", title: "SDD + Harness", summary: "Spec-Driven Development + engenharia de harness." },
  { file: "repository_hygiene.md", title: "Repository hygiene", summary: "Higiene do repo (o que versiona, o que é scratch)." },
];
