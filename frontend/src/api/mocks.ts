// src/api/mocks.ts
//
// Fixtures TIPADAS e REALISTAS para o AI Cockpit do "Interior Studio".
// Cada chave de `mocks` corresponde a um endpoint do BFF (/api/*).
// Os tipos vêm de ./types (contrato canônico). Nada aqui fala com modelos
// locais — são apenas dados de mock para dev/Storybook/MSW e fallback de UI.

import type {
  StatusResponse,
  ModelsResponse,
  ChatResponse,
  AgentsResponse,
  Agent,
  RunsResponse,
  Run,
  RunDetail,
  RunDetailResponse,
  LogLine,
  RunLogsResponse,
  ArtifactsResponse,
  Artifact,
  DecisionsResponse,
  Decision,
  WorkflowsResponse,
  Workflow,
  RunResponse,
  FileEventsResponse,
} from "./types";

// ────────────────────────────────────────────────────────────────────────────
// Helpers de tempo — base fixa para fixtures determinísticas/estáveis em testes.
// ────────────────────────────────────────────────────────────────────────────
const NOW = new Date("2026-06-28T17:42:00.000Z");
const iso = (offsetMs = 0): string => new Date(NOW.getTime() + offsetMs).toISOString();
const min = (m: number): number => m * 60_000;
const sec = (s: number): number => s * 1_000;

// ────────────────────────────────────────────────────────────────────────────
// GET /api/status
// ────────────────────────────────────────────────────────────────────────────
export const status: StatusResponse = {
  upstream: { ok: true, url: "E:/Claude/apps/sketchup-mcp" },   // motor legível por ARQUIVO (semântica nova)
  ollama: { ok: true, url: "http://localhost:11434", models: 3 },
  time: iso(),
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/models  (espelha `ollama list` normalizado pelo BFF)
// ────────────────────────────────────────────────────────────────────────────
export const models: ModelsResponse = {
  ok: true,
  source: "ollama",
  models: [
    {
      name: "llama3.1:8b",
      family: "llama",
      sizeBytes: 4_920_753_328,
      parameterSize: "8.0B",
      quantization: "Q4_K_M",
      modifiedAt: iso(-min(60 * 24 * 9)),
    },
    {
      name: "qwen2.5-coder:7b",
      family: "qwen2",
      sizeBytes: 4_683_073_184,
      parameterSize: "7.6B",
      quantization: "Q4_K_M",
      modifiedAt: iso(-min(60 * 24 * 4)),
    },
    {
      name: "deepseek-r1:14b",
      family: "qwen2",
      sizeBytes: 8_988_112_040,
      parameterSize: "14.8B",
      quantization: "Q4_K_M",
      modifiedAt: iso(-min(60 * 24 * 2)),
    },
  ],
  hint: "3 modelos locais via Ollama. Defina OLLAMA_HOST para apontar outro host.",
};

// ────────────────────────────────────────────────────────────────────────────
// POST /api/models/chat  (resposta de exemplo — usada por previews/mocks de UI)
// ────────────────────────────────────────────────────────────────────────────
export const chat: ChatResponse = {
  ok: true,
  model: "qwen2.5-coder:7b",
  message: {
    role: "assistant",
    content:
      "Para a sala de estar 4.2×3.6 m sugiro: sofá de 3 lugares na parede oeste " +
      "(2.10 m, deixando 0.75 m de circulação), tapete 2.0×1.4 m centralizado no " +
      "eixo do sofá e mesa de centro recuada 0.40 m. Mantém o foco na janela sul e " +
      "respeita o corredor de 0.90 m até a cozinha.",
  },
  tookMs: 1842,
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/agents — 6 agentes coerentes com o domínio multi-agente.
// ────────────────────────────────────────────────────────────────────────────
export const agents: AgentsResponse = {
  agents: [
    {
      id: "pm-orchestrator",
      name: "PM Orquestrador",
      role: "Product Manager",
      umbrella: "direction",
      status: "online",
      model: "llama3.1:8b",
      online: true,
      tools: ["plan", "decompose", "route", "memory.search"],
      lastRunId: "run_2026_0628_pm_42",
      message: "Priorizando o backlog da sala de estar; 2 propostas aguardando aprovação.",
    },
    {
      id: "team-lead",
      name: "Team Lead",
      role: "Tech Lead",
      umbrella: "direction",
      status: "working",
      model: "deepseek-r1:14b",
      online: true,
      tools: ["claim", "assign", "review", "worktree.sync"],
      lastRunId: "run_2026_0628_lead_39",
      message: "Coordenando worktrees: sofá (geo) e cozinha (pele) em paralelo.",
    },
    {
      id: "architect",
      name: "Arquiteto de Interiores",
      role: "Architect",
      umbrella: "design",
      status: "working",
      model: "deepseek-r1:14b",
      online: true,
      tools: ["program.derive", "layout.solve", "constraints.check", "sketchup.plan2d"],
      lastRunId: "run_2026_0628_arch_37",
      message: "Resolvendo layout 2D da cozinha; checando circulação mínima de 0.90 m.",
    },
    {
      id: "builder-qwen",
      name: "Builder (Qwen Coder)",
      role: "Geometry Builder",
      umbrella: "build",
      status: "working",
      model: "qwen2.5-coder:7b",
      online: true,
      tools: ["ruby.emit", "sketchup.build3d", "fidelity.gate", "skp.export"],
      lastRunId: "run_2026_0628_build_35",
      message: "Gerando Ruby do sofá de 3 lugares; gate de fidelidade em 0.94.",
    },
    {
      id: "curator-llama",
      name: "Curador de Referências",
      role: "Reference Curator",
      umbrella: "design",
      status: "idle",
      model: "llama3.1:8b",
      online: true,
      tools: ["refpack.search", "moodboard.rank", "memory.write"],
      lastRunId: "run_2026_0628_ref_31",
      message: "Refpack 'mid-century quente' pronto; aguardando próximo ciclo.",
    },
    {
      id: "visual-oracle-gpt",
      name: "Oráculo Visual (GPT)",
      role: "Visual Reviewer",
      umbrella: "verify",
      status: "error",
      model: "gpt-4o-vision",
      online: false,
      tools: ["render.inspect", "diff.visual", "decision.raise"],
      lastRunId: "run_2026_0628_vis_28",
      message: "Sem chave de API: revisão visual do render da cozinha falhou (offline).",
    },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/runs — 8 runs (mix de status, agent + workflow).
// ────────────────────────────────────────────────────────────────────────────
export const runs: RunsResponse = {
  runs: [
    {
      id: "run_2026_0628_build_35",
      kind: "agent",
      agentId: "builder-qwen",
      agentName: "Builder (Qwen Coder)",
      title: "Construir sofá 3 lugares — geometria Ruby",
      status: "running",
      model: "qwen2.5-coder:7b",
      startedAt: iso(-min(3)),
    },
    {
      id: "run_2026_0628_arch_37",
      kind: "agent",
      agentId: "architect",
      agentName: "Arquiteto de Interiores",
      title: "Resolver layout 2D — cozinha 3.1×2.8 m",
      status: "running",
      model: "deepseek-r1:14b",
      startedAt: iso(-min(6)),
    },
    {
      id: "run_2026_0628_wf_build_36",
      kind: "workflow",
      workflowId: "wf-build-room",
      title: "Pipeline de construção — Sala de estar",
      status: "running",
      model: "deepseek-r1:14b",
      startedAt: iso(-min(8)),
    },
    {
      id: "run_2026_0628_vis_28",
      kind: "agent",
      agentId: "visual-oracle-gpt",
      agentName: "Oráculo Visual (GPT)",
      title: "Revisão visual — render cozinha v3",
      status: "failed",
      model: "gpt-4o-vision",
      startedAt: iso(-min(34)),
      finishedAt: iso(-min(33)),
      durationMs: sec(48),
    },
    {
      id: "run_2026_0628_wf_ref_30",
      kind: "workflow",
      workflowId: "wf-reference-curation",
      title: "Reference → Curadoria — tema mid-century",
      status: "succeeded",
      startedAt: iso(-min(52)),
      finishedAt: iso(-min(49)),
      durationMs: min(2) + sec(54),
    },
    {
      id: "run_2026_0628_build_24",
      kind: "agent",
      agentId: "builder-qwen",
      agentName: "Builder (Qwen Coder)",
      title: "Construir bancada da cozinha — gate de fidelidade",
      status: "succeeded",
      model: "qwen2.5-coder:7b",
      startedAt: iso(-min(78)),
      finishedAt: iso(-min(74)),
      durationMs: min(3) + sec(41),
    },
    {
      id: "run_2026_0628_wf_vray_22",
      kind: "workflow",
      workflowId: "wf-vray-render",
      title: "Render V-Ray — sala de estar (4K)",
      status: "succeeded",
      startedAt: iso(-min(96)),
      finishedAt: iso(-min(88)),
      durationMs: min(7) + sec(12),
    },
    {
      id: "run_2026_0628_arch_18",
      kind: "agent",
      agentId: "architect",
      agentName: "Arquiteto de Interiores",
      title: "Derivar programa — apartamento 58 m²",
      status: "failed",
      model: "deepseek-r1:14b",
      startedAt: iso(-min(132)),
      finishedAt: iso(-min(131)),
      durationMs: sec(57),
    },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/runs/:id — detalhes com steps, inputs/outputs e artefatos.
// ────────────────────────────────────────────────────────────────────────────
const runDetails: Record<string, RunDetail> = {
  run_2026_0628_build_35: {
    id: "run_2026_0628_build_35",
    kind: "agent",
    agentId: "builder-qwen",
    agentName: "Builder (Qwen Coder)",
    title: "Construir sofá 3 lugares — geometria Ruby",
    status: "running",
    model: "qwen2.5-coder:7b",
    startedAt: iso(-min(3)),
    steps: [
      { name: "Carregar especificação do asset", status: "done", tone: "ok", startedAt: iso(-min(3)), finishedAt: iso(-min(3) + sec(4)) },
      { name: "Emitir Ruby (SketchUp API)", status: "done", tone: "ok", startedAt: iso(-min(3) + sec(4)), finishedAt: iso(-min(2) + sec(18)) },
      { name: "Build 3D headless", status: "running", tone: "info", startedAt: iso(-min(2) + sec(18)) },
      { name: "Gate de fidelidade", status: "pending" },
      { name: "Exportar .skp", status: "pending" },
    ],
    inputs: {
      room: "sala-de-estar",
      asset: "sofa-3-lugares",
      width_m: 2.1,
      depth_m: 0.92,
      seat_height_m: 0.45,
      style: "mid-century",
    },
    outputs: {
      fidelity: 0.94,
      polycount: 18432,
      warnings: ["braço esquerdo 2 mm fora de alinhamento com o assento"],
    },
    artifactIds: ["art_skp_sofa_v4", "art_render_sofa_v4"],
  },
  run_2026_0628_vis_28: {
    id: "run_2026_0628_vis_28",
    kind: "agent",
    agentId: "visual-oracle-gpt",
    agentName: "Oráculo Visual (GPT)",
    title: "Revisão visual — render cozinha v3",
    status: "failed",
    model: "gpt-4o-vision",
    startedAt: iso(-min(34)),
    finishedAt: iso(-min(33)),
    durationMs: sec(48),
    steps: [
      { name: "Carregar render alvo", status: "done", tone: "ok", startedAt: iso(-min(34)), finishedAt: iso(-min(34) + sec(2)) },
      { name: "Conectar provider de visão", status: "failed", tone: "danger", startedAt: iso(-min(34) + sec(2)), finishedAt: iso(-min(33) + sec(12)) },
      { name: "Diff visual vs. referência", status: "pending" },
      { name: "Levantar decisão", status: "pending" },
    ],
    inputs: { artifact: "art_render_kitchen_v3", reference: "ref_kitchen_warm_01" },
    outputs: { error: "OPENAI_API_KEY ausente; provider de visão indisponível" },
    artifactIds: ["art_render_kitchen_v3"],
  },
  run_2026_0628_wf_vray_22: {
    id: "run_2026_0628_wf_vray_22",
    kind: "workflow",
    workflowId: "wf-vray-render",
    title: "Render V-Ray — sala de estar (4K)",
    status: "succeeded",
    startedAt: iso(-min(96)),
    finishedAt: iso(-min(88)),
    durationMs: min(7) + sec(12),
    steps: [
      { name: "Importar .skp", status: "done", tone: "ok", startedAt: iso(-min(96)), finishedAt: iso(-min(95)) },
      { name: "Aplicar materiais V-Ray", status: "done", tone: "ok", startedAt: iso(-min(95)), finishedAt: iso(-min(93)) },
      { name: "Setup de câmera + iluminação", status: "done", tone: "ok", startedAt: iso(-min(93)), finishedAt: iso(-min(92)) },
      { name: "Render 4K", status: "done", tone: "ok", startedAt: iso(-min(92)), finishedAt: iso(-min(88) - sec(20)) },
      { name: "Pós + export PNG", status: "done", tone: "ok", startedAt: iso(-min(88) - sec(20)), finishedAt: iso(-min(88)) },
    ],
    inputs: { skp: "art_skp_living_v2", resolution: "3840x2160", engine: "vray-6" },
    outputs: { render: "art_render_living_v2", render_time_s: 412, denoiser: "nvidia-ai" },
    artifactIds: ["art_render_living_v2", "art_report_living"],
  },
};

export const runDetail: RunDetailResponse = { run: runDetails.run_2026_0628_build_35 };

// ────────────────────────────────────────────────────────────────────────────
// GET /api/runs/:id/logs — logs realistas (>=12 linhas, níveis variados, 1 error).
// ────────────────────────────────────────────────────────────────────────────
const buildLogs: LogLine[] = [
  { ts: iso(-min(3)), level: "info", agent: "Builder (Qwen Coder)", message: "Run iniciada: construir sofa-3-lugares (sala-de-estar)." },
  { ts: iso(-min(3) + sec(1)), level: "debug", agent: "Builder (Qwen Coder)", message: "Spec carregada: 2.10×0.92 m, assento 0.45 m, estilo mid-century." },
  { ts: iso(-min(3) + sec(3)), level: "debug", agent: "Builder (Qwen Coder)", message: "Modelo qwen2.5-coder:7b carregado (Q4_K_M, 4.36 GB) em 1.2 s." },
  { ts: iso(-min(3) + sec(5)), level: "info", agent: "Builder (Qwen Coder)", message: "Emitindo Ruby via SketchUp API…" },
  { ts: iso(-min(2) + sec(40)), level: "success", agent: "Builder (Qwen Coder)", message: "Ruby emitido: 214 linhas, 7 grupos, 3 componentes." },
  { ts: iso(-min(2) + sec(42)), level: "info", agent: "Builder (Qwen Coder)", message: "Build 3D headless iniciado (sketchup --headless)." },
  { ts: iso(-min(2) + sec(50)), level: "debug", agent: "Builder (Qwen Coder)", message: "Geometria: 18 432 faces, 0 faces degeneradas." },
  { ts: iso(-min(2) + sec(58)), level: "warn", agent: "Builder (Qwen Coder)", message: "Braço esquerdo 2 mm fora de alinhamento com o assento — dentro da tolerância." },
  { ts: iso(-min(1) + sec(20)), level: "warn", agent: "Builder (Qwen Coder)", message: "Textura 'linho-cru' sem UV explícito; aplicando projeção planar padrão." },
  { ts: iso(-min(1) + sec(35)), level: "error", agent: "Builder (Qwen Coder)", message: "Falha ao resolver material 'pé-latão-escovado'; usando fallback 'latão-fosco'." },
  { ts: iso(-min(1) + sec(48)), level: "info", agent: "Builder (Qwen Coder)", message: "Recuperado do fallback de material; build prossegue." },
  { ts: iso(-sec(40)), level: "info", agent: "Builder (Qwen Coder)", message: "Calculando gate de fidelidade contra a referência…" },
  { ts: iso(-sec(12)), level: "success", agent: "Builder (Qwen Coder)", message: "Gate de fidelidade preliminar: 0.94 (limite 0.90). Aguardando export." },
];

const runLogs: Record<string, LogLine[]> = {
  run_2026_0628_build_35: buildLogs,
  run_2026_0628_vis_28: [
    { ts: iso(-min(34)), level: "info", agent: "Oráculo Visual (GPT)", message: "Run iniciada: revisão visual do render cozinha v3." },
    { ts: iso(-min(34) + sec(2)), level: "debug", agent: "Oráculo Visual (GPT)", message: "Render alvo carregado: art_render_kitchen_v3 (1920×1080)." },
    { ts: iso(-min(34) + sec(4)), level: "info", agent: "Oráculo Visual (GPT)", message: "Conectando provider de visão gpt-4o-vision…" },
    { ts: iso(-min(33) + sec(10)), level: "error", agent: "Oráculo Visual (GPT)", message: "OPENAI_API_KEY ausente; provider de visão indisponível. Abortando." },
    { ts: iso(-min(33) + sec(12)), level: "warn", agent: "Oráculo Visual (GPT)", message: "Run marcada como failed; nenhuma decisão visual levantada." },
  ],
};

export const runLogsResponse: RunLogsResponse = { logs: buildLogs };

// ────────────────────────────────────────────────────────────────────────────
// GET /api/artifacts — renders do sofá/cozinha + report + skp.
// ────────────────────────────────────────────────────────────────────────────
export const artifacts: ArtifactsResponse = {
  artifacts: [
    {
      id: "art_render_sofa_v4",
      type: "render",
      name: "sofa-3-lugares_v4.png",
      path: "/data/renders/sala-de-estar/sofa-3-lugares_v4.png",
      runId: "run_2026_0628_build_35",
      sizeKb: 2148,
      createdAt: iso(-min(1)),
      url: "/img/renders/sala-de-estar/sofa-3-lugares_v4.png",
    },
    {
      id: "art_render_kitchen_v3",
      type: "render",
      name: "cozinha_v3.png",
      path: "/data/renders/cozinha/cozinha_v3.png",
      runId: "run_2026_0628_vis_28",
      sizeKb: 3072,
      createdAt: iso(-min(36)),
      url: "/img/renders/cozinha/cozinha_v3.png",
    },
    {
      id: "art_render_living_v2",
      type: "render",
      name: "sala-de-estar_vray_4k.png",
      path: "/data/renders/sala-de-estar/sala-de-estar_vray_4k.png",
      runId: "run_2026_0628_wf_vray_22",
      sizeKb: 9840,
      createdAt: iso(-min(88)),
      url: "/img/renders/sala-de-estar/sala-de-estar_vray_4k.png",
    },
    {
      id: "art_skp_sofa_v4",
      type: "skp",
      name: "sofa-3-lugares_v4.skp",
      path: "/data/skp/sala-de-estar/sofa-3-lugares_v4.skp",
      runId: "run_2026_0628_build_35",
      sizeKb: 5126,
      createdAt: iso(-sec(30)),
    },
    {
      id: "art_skp_living_v2",
      type: "skp",
      name: "sala-de-estar_v2.skp",
      path: "/data/skp/sala-de-estar/sala-de-estar_v2.skp",
      runId: "run_2026_0628_wf_vray_22",
      sizeKb: 11420,
      createdAt: iso(-min(98)),
    },
    {
      id: "art_report_living",
      type: "report",
      name: "relatorio-fidelidade_sala-de-estar.md",
      path: "/data/reports/sala-de-estar/relatorio-fidelidade.md",
      runId: "run_2026_0628_wf_vray_22",
      sizeKb: 38,
      createdAt: iso(-min(87)),
      url: "/img/reports/sala-de-estar/relatorio-fidelidade.md",
    },
    {
      id: "art_observed_model",
      type: "json",
      name: "observed_model.json",
      path: "/data/cozinha/observed_model.json",
      runId: "run_2026_0628_arch_37",
      sizeKb: 64,
      createdAt: iso(-min(5)),
    },
    {
      id: "art_moodboard_warm",
      type: "image",
      name: "moodboard_mid-century-quente.jpg",
      path: "/data/refpack/moodboard_mid-century-quente.jpg",
      runId: "run_2026_0628_wf_ref_30",
      sizeKb: 1280,
      createdAt: iso(-min(49)),
      url: "/img/refpack/moodboard_mid-century-quente.jpg",
    },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/decisions — 4 decisões (3 programa/proposta + 1 visual review).
// ────────────────────────────────────────────────────────────────────────────
export const decisions: DecisionsResponse = {
  decisions: [
    {
      id: "dec_program_living_01",
      type: "program",
      title: "Programa da sala de estar",
      question: "Incluir uma poltrona de leitura além do sofá de 3 lugares?",
      options: ["Sim — poltrona + luminária de piso", "Não — manter só o sofá", "Substituir por chaise"],
      status: "pending",
      source: "pm-orchestrator",
      createdAt: iso(-min(12)),
    },
    {
      id: "dec_program_kitchen_02",
      type: "program",
      title: "Bancada da cozinha",
      question: "Bancada em L ou em linha reta para a cozinha de 3.1×2.8 m?",
      options: ["Em L (mais superfície)", "Reta (mais circulação)"],
      status: "pending",
      source: "architect",
      createdAt: iso(-min(9)),
    },
    {
      id: "dec_visual_kitchen_03",
      type: "visual-review",
      title: "Revisão visual — render cozinha v3",
      question: "O tom da madeira do armário está coerente com o refpack 'mid-century quente'?",
      options: ["Aprovar", "Esquentar 1 passo", "Reprovar e re-renderizar"],
      status: "pending",
      source: "visual-oracle-gpt",
      createdAt: iso(-min(33)),
    },
    {
      id: "dec_program_layout_04",
      type: "layout",
      title: "Orientação do sofá",
      question: "Voltar o sofá para a janela sul ou para a TV na parede leste?",
      options: ["Janela sul", "TV (parede leste)"],
      status: "answered",
      source: "architect",
      createdAt: iso(-min(64)),
    },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/workflows — 4 workflows (etapas: Reference → Curadoria → Build →
// Construção → GPT → V-Ray → Aprendido).
// ────────────────────────────────────────────────────────────────────────────
export const workflows: WorkflowsResponse = {
  workflows: [
    {
      id: "wf-reference-curation",
      name: "Reference & Curadoria",
      description: "Busca, ranqueia e congela um refpack temático para guiar o ciclo de design.",
      whenToUse: "No início de um ambiente novo, ou quando a direção visual precisa ser refeita.",
      status: "done",
      steps: [
        { key: "reference", label: "Reference", status: "done", icon: "search" },
        { key: "curation", label: "Curadoria", status: "done", icon: "sparkles" },
        { key: "learned", label: "Aprendido", status: "done", icon: "brain" },
      ],
      tools: ["refpack.search", "moodboard.rank", "memory.write"],
      inputs: ["tema", "ambiente"],
      outputs: ["refpack congelado", "moodboard", "regras de estilo"],
      risks: ["referências com licença ambígua", "tema amplo demais gera dispersão"],
      lastRunId: "run_2026_0628_wf_ref_30",
    },
    {
      id: "wf-build-room",
      name: "Pipeline de Construção do Ambiente",
      description:
        "Do programa derivado ao .skp: layout 2D, emissão de Ruby, build 3D headless e gate de fidelidade.",
      whenToUse: "Quando o programa e o refpack do ambiente já estão aprovados e é hora de modelar.",
      status: "running",
      steps: [
        { key: "reference", label: "Reference", status: "done", icon: "search" },
        { key: "curation", label: "Curadoria", status: "done", icon: "sparkles" },
        { key: "build", label: "Build", status: "doing", icon: "code" },
        { key: "construct", label: "Construção", status: "pending", icon: "boxes" },
        { key: "learned", label: "Aprendido", status: "pending", icon: "brain" },
      ],
      tools: ["program.derive", "layout.solve", "ruby.emit", "sketchup.build3d", "fidelity.gate", "skp.export"],
      inputs: ["programa", "refpack", "dimensões do ambiente"],
      outputs: [".skp do ambiente", "relatório de fidelidade"],
      risks: ["gate de fidelidade abaixo do limite", "circulação mínima violada", "polycount excessivo"],
      lastRunId: "run_2026_0628_wf_build_36",
    },
    {
      id: "wf-vray-render",
      name: "Render V-Ray + GPT Review",
      description:
        "Importa o .skp, aplica materiais V-Ray, renderiza em 4K e submete ao Oráculo Visual (GPT) para revisão.",
      whenToUse: "Após o build passar no gate de fidelidade, para produzir a imagem final e validá-la.",
      status: "idle",
      steps: [
        { key: "construct", label: "Construção", status: "done", icon: "boxes" },
        { key: "vray", label: "V-Ray", status: "done", icon: "image" },
        { key: "gpt", label: "GPT", status: "pending", icon: "eye" },
        { key: "learned", label: "Aprendido", status: "pending", icon: "brain" },
      ],
      tools: ["skp.import", "vray.materials", "vray.render", "render.inspect", "diff.visual"],
      inputs: [".skp aprovado", "refpack", "câmera"],
      outputs: ["render 4K", "veredito visual", "decisão de revisão"],
      risks: ["provider de visão offline (sem API key)", "tempo de render alto", "ruído residual no denoiser"],
      lastRunId: "run_2026_0628_wf_vray_22",
    },
    {
      id: "wf-full-cycle",
      name: "Ciclo Completo do Ambiente",
      description:
        "Orquestra ponta-a-ponta: Reference → Curadoria → Build → Construção → GPT → V-Ray → Aprendido.",
      whenToUse: "Para rodar um ambiente do zero ao render final num único disparo supervisionado.",
      status: "idle",
      steps: [
        { key: "reference", label: "Reference", status: "pending", icon: "search" },
        { key: "curation", label: "Curadoria", status: "pending", icon: "sparkles" },
        { key: "build", label: "Build", status: "pending", icon: "code" },
        { key: "construct", label: "Construção", status: "pending", icon: "boxes" },
        { key: "gpt", label: "GPT", status: "pending", icon: "eye" },
        { key: "vray", label: "V-Ray", status: "pending", icon: "image" },
        { key: "learned", label: "Aprendido", status: "pending", icon: "brain" },
      ],
      tools: [
        "refpack.search",
        "program.derive",
        "layout.solve",
        "ruby.emit",
        "sketchup.build3d",
        "fidelity.gate",
        "vray.render",
        "render.inspect",
        "memory.write",
      ],
      inputs: ["tema", "ambiente", "dimensões"],
      outputs: ["refpack", ".skp", "render 4K", "regras aprendidas"],
      risks: ["acúmulo de erro entre etapas", "decisão pendente trava o pipeline", "custo de compute alto"],
    },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// GET /api/file-map/events — feed "acontecendo agora" (atividade do BFF).
// ────────────────────────────────────────────────────────────────────────────
export const fileEvents: FileEventsResponse = {
  cursor: 6,
  events: [
    { id: "ev-1", seq: 1, ts: iso(-sec(11)), repo: "sketchup-mcp-bff", path: "sketchup-mcp-bff/cockpit_api.py", op: "execute", source: "bff", status: "ok", endpoint: "/api/agents", label: "GET /api/agents" },
    { id: "ev-2", seq: 2, ts: iso(-sec(10)), repo: "sketchup-mcp-bff", path: "sketchup-mcp-bff/cockpit_api.py", op: "execute", source: "bff", status: "ok", endpoint: "/api/agents", label: "deriva agents (de /api/state)" },
    { id: "ev-3", seq: 3, ts: iso(-sec(8)), repo: "sketchup-mcp", path: "sketchup-mcp/.ai_bridge/", op: "read", source: "bff", status: "ok", endpoint: "/api/state", label: "read state (studio_mirror, por arquivo)" },
    { id: "ev-4", seq: 4, ts: iso(-sec(6)), repo: "external", path: "ollama:/api/tags", op: "proxy", source: "ollama", status: "ok", endpoint: "/api/tags", label: "Ollama /api/tags (online)" },
    { id: "ev-5", seq: 5, ts: iso(-sec(3)), repo: "sketchup-mcp-bff", path: "sketchup-mcp-bff/cockpit_api.py", op: "execute", source: "runner", status: "ok", runId: "run_2026_0628_build_35", label: "run agent criado (runner STUB)", confidence: "low" },
    { id: "ev-6", seq: 6, ts: iso(-sec(1)), repo: "sketchup-mcp", path: "sketchup-mcp/artifacts/planta_74/furnished/sofa_v4.png", op: "read", source: "bff", status: "ok", label: "artifact render listado" },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// Respostas de POST genéricas (run disparada) — úteis em handlers de mock.
// ────────────────────────────────────────────────────────────────────────────
export const runStarted: RunResponse = { ok: true, runId: "run_2026_0628_new_99" };

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Detalhe de uma run por id; cai no build em andamento se o id não tiver fixture. */
export function getRun(id: string): RunDetail {
  return runDetails[id] ?? runDetails.run_2026_0628_build_35;
}

/** Linhas de log de uma run por id; lista vazia se a run não tiver logs. */
export function getRunLogs(id: string): LogLine[] {
  return runLogs[id] ?? [];
}

// ────────────────────────────────────────────────────────────────────────────
// Objeto agregador — chaves por endpoint + helpers.
// ────────────────────────────────────────────────────────────────────────────
export const mocks = {
  // GET /api/status
  status,
  // GET /api/models
  models,
  // POST /api/models/chat
  chat,
  // GET /api/agents
  agents,
  // GET /api/runs
  runs,
  // GET /api/runs/:id
  runDetail,
  runDetails,
  // GET /api/runs/:id/logs
  runLogs: runLogsResponse,
  runLogsById: runLogs,
  // GET /api/artifacts
  artifacts,
  // GET /api/decisions
  decisions,
  // GET /api/workflows
  workflows,
  // GET /api/file-map/events
  fileEvents,
  // POST /api/{agents|workflows}/:id/run
  runStarted,
  // helpers
  getRun,
  getRunLogs,
} as const;

export default mocks;
