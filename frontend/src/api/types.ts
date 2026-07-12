// src/api/types.ts
// Tipos canônicos para o BFF do Interior Studio (AI Cockpit).
// O frontend consome SÓ /api/* — estes tipos espelham o contrato do BFF.

/* ───────────────────────────── Primitivos / utilitários ───────────────────────────── */

/** Timestamp ISO-8601 (ex.: "2026-06-28T12:34:56.000Z"). */
export type IsoString = string;

/** Envelope comum: a maioria das respostas carrega um flag de sucesso. */
export interface OkResponse {
  ok: boolean;
}

/* ───────────────────────────── GET /api/status ───────────────────────────── */

/** Saúde de uma dependência (chave `upstream` = motor legível por ARQUIVO, ollama, etc.). */
export interface ServiceHealth {
  ok: boolean;
  url: string;
}

/** Saúde específica do Ollama, com contagem de modelos disponíveis. */
export interface OllamaHealth extends ServiceHealth {
  models: number;
}

/** GET /api/status — visão geral de conectividade. */
export interface StatusResponse {
  upstream: ServiceHealth;
  ollama: OllamaHealth;
  time: IsoString;
}

/* ───────────────────────────── GET /api/models ───────────────────────────── */

/** Metadados de um modelo Ollama (campos opcionais quando indisponíveis). */
export interface ModelInfo {
  name: string;
  family?: string;
  sizeBytes?: number;
  parameterSize?: string;
  quantization?: string;
  modifiedAt?: IsoString;
  /** false = modelo de embedding (vetoriza pro RAG) — /api/chat do Ollama dá 400 nele. */
  chat?: boolean;
}

/** GET /api/models — lista de modelos; `source` indica origem da listagem. */
export interface ModelsResponse {
  ok: boolean;
  source: "ollama" | "none";
  models: ModelInfo[];
  hint?: string;
}

/* ───────────────────────────── POST /api/models/chat ───────────────────────────── */

/** Papel de uma mensagem de chat. */
export type ChatRole = "system" | "user" | "assistant";

/** Uma mensagem na conversa enviada ao modelo. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Resposta do assistente (papel fixo). */
export interface AssistantMessage {
  role: "assistant";
  content: string;
}

/** POST /api/models/chat — requisição. */
export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
}

/** POST /api/models/chat — resposta. */
export interface ChatResponse {
  ok: boolean;
  model: string;
  message: AssistantMessage;
  tookMs: number;
}

/* ───────────────────────────── GET /api/agents ───────────────────────────── */

/** Estado de execução de um agente. */
export type AgentStatus = "idle" | "working" | "error" | "online";

/** Um agente do cockpit multi-agente. */
export interface Agent {
  id: string;
  name: string;
  role: string;
  umbrella: string;
  status: AgentStatus;
  model?: string;
  online: boolean;
  tools: string[];
  lastRunId?: string;
  message?: string;
}

/** GET /api/agents — lista de agentes. */
export interface AgentsResponse {
  agents: Agent[];
}

/* ───────────────────────────── POST /api/agents/:id/run ───────────────────────────── */

/** POST /api/agents/:id/run — requisição. */
export interface AgentRunRequest {
  input?: string;
}

/** Resposta padrão de disparo: confirma e devolve o id da run criada. */
export interface RunTriggerResponse {
  ok: boolean;
  runId: string;
}

/* ───────────────────────────── GET /api/runs ───────────────────────────── */

/** Natureza da run: disparo de um agente isolado ou de um workflow. */
export type RunKind = "agent" | "workflow";

/** Estado de uma run. */
export type RunStatus = "queued" | "running" | "succeeded" | "failed";

/** Uma execução (agente ou workflow), forma de lista. */
export interface Run {
  id: string;
  kind: RunKind;
  agentId?: string;
  agentName?: string;
  workflowId?: string;
  title: string;
  status: RunStatus;
  model?: string;
  startedAt: IsoString;
  finishedAt?: IsoString;
  durationMs?: number;
}

/** GET /api/runs — lista de runs. */
export interface RunsResponse {
  runs: Run[];
}

/* ───────────────────────────── GET /api/runs/:id ───────────────────────────── */

/** Estado de um passo dentro de uma run. */
export type RunStepStatus = "pending" | "running" | "done" | "failed";

/** Um passo (etapa) de uma run. */
export interface RunStep {
  name: string;
  status: RunStepStatus;
  tone?: string;
  startedAt?: IsoString;
  finishedAt?: IsoString;
}

/** Run detalhada: a Run de lista + passos, entradas/saídas e artefatos. */
export interface RunDetail extends Run {
  steps: RunStep[];
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  artifactIds: string[];
}

/** GET /api/runs/:id — run detalhada. */
export interface RunDetailResponse {
  run: RunDetail;
}

/* ───────────────────────────── GET /api/runs/:id/logs ───────────────────────────── */

/** Severidade de uma linha de log. */
export type LogLevel = "debug" | "info" | "warn" | "error" | "success";

/** Uma linha de log (item do SSE ou do dump final). */
export interface LogLine {
  ts: IsoString;
  level: LogLevel;
  agent?: string;
  message: string;
}

/**
 * GET /api/runs/:id/logs (modo normal, run concluída) — dump de logs.
 * No modo SSE, o stream emite eventos `LogLine` individuais.
 */
export interface RunLogsResponse {
  logs: LogLine[];
}

/* ───────────────────────────── GET /api/artifacts ───────────────────────────── */

/** Tipo de artefato gerado por uma run. */
export type ArtifactType = "render" | "skp" | "report" | "json" | "image";

/** Um artefato produzido pelo pipeline. */
export interface Artifact {
  id: string;
  type: ArtifactType;
  name: string;
  path: string;
  runId?: string;
  sizeKb?: number;
  createdAt?: IsoString;
  url?: string;
}

/** GET /api/artifacts — lista de artefatos. */
export interface ArtifactsResponse {
  artifacts: Artifact[];
}

/* ───────────────────────────── GET /api/decisions ───────────────────────────── */

/** Estado de uma decisão pendente de input humano. */
export type DecisionStatus = "pending" | "answered" | "skipped";

/** Uma decisão/gate que aguarda escolha do operador. */
export interface Decision {
  id: string;
  type: string;
  title: string;
  question: string;
  options?: string[];
  status: DecisionStatus;
  source: string;
  createdAt?: IsoString;
}

/** GET /api/decisions — lista de decisões. */
export interface DecisionsResponse {
  decisions: Decision[];
}

/** POST /api/decisions/:id/respond — requisição (escolha ou texto livre). */
export interface DecisionRespondRequest {
  choice?: string;
  answer?: string;
}

/** POST /api/decisions/:id/respond — resposta. */
export type DecisionRespondResponse = OkResponse;

/* ───────────────────────────── GET /api/workflows ───────────────────────────── */

/** Estado geral de um workflow. */
export type WorkflowStatus = "idle" | "running" | "done";

/** Estado de um passo de workflow (vocabulário próprio: doing≠running). */
export type WorkflowStepStatus = "done" | "doing" | "pending";

/** Um passo declarado de um workflow. */
export interface WorkflowStep {
  key: string;
  label: string;
  status: WorkflowStepStatus;
  icon?: string;
}

/** Um workflow (pipeline) disponível no cockpit. */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  whenToUse: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  tools: string[];
  inputs: string[];
  outputs: string[];
  risks?: string[];
  lastRunId?: string;
}

/** GET /api/workflows — lista de workflows. */
export interface WorkflowsResponse {
  workflows: Workflow[];
}

/** POST /api/workflows/:id/run — requisição (sem corpo relevante). */
export type WorkflowRunRequest = Record<string, never>;

/** POST /api/workflows/:id/run — resposta (mesmo envelope de disparo). */
export type WorkflowRunResponse = RunTriggerResponse;

/* ═════════════════════════════ GET /api/state (payload legado) ═════════════════════════════ */
/* Mantido para as telas existentes; nomes em snake_case espelham o dashboard legado. */

/** Status de um item de pipeline dentro de um foco ativo. */
export interface PipelineStep {
  icon: string;
  label: string;
  status: string;
}

/** Um foco ativo no overview (ambiente em andamento). */
export interface ActiveFocus {
  env_label: string;
  env_icon: string;
  label: string;
  state_label: string;
  reason: string;
  next: string;
  pipeline: PipelineStep[];
}

/** Progresso de um ambiente (room) no overview. */
export interface OverviewRoom {
  key: string;
  label: string;
  icon: string;
  done: number;
  total: number;
  assets: unknown[];
}

/** Bloco `overview` do estado legado. */
export interface StateOverview {
  project: string;
  active_focuses: ActiveFocus[];
  rooms: OverviewRoom[];
}

/** Bloco `factory` — ciclo de produção corrente. */
export interface StateFactory {
  cycle_id: string;
  room: string;
  asset: string;
  title: string;
  status: string;
  next_action: string;
  references: unknown[];
}

/** Lead (ou sub) de uma umbrella de agentes. */
export interface AgentFace {
  id: string;
  face: string;
  label: string;
  status: string;
  message: string;
  online: boolean;
}

/** Uma umbrella de agentes (lead + subordinados). */
export interface AgentUmbrella {
  id: string;
  label: string;
  lead: AgentFace;
  subs: AgentFace[];
}

/** Bloco `agents` do estado legado. */
export interface StateAgents {
  umbrellas: AgentUmbrella[];
  feed: unknown[];
  metrics: Record<string, unknown>;
}

/** Uma tarefa do backlog. */
export interface BacklogTask {
  mt: string;
  what: string;
  status: string;
  geo: boolean;
  done: boolean;
}

/** Bloco `backlog` — contagens + tarefas. */
export interface StateBacklog {
  total: number;
  geo: number;
  pele: number;
  done: number;
  tasks: BacklogTask[];
}

/** Uma reivindicação (claim) de worktree por um owner. */
export interface SessionClaim {
  mt: string;
  desc: string;
  owner: string;
  status: string;
}

/** Bloco `sessions` — worktrees ativos e claims. */
export interface StateSessions {
  worktrees: string[];
  claims: SessionClaim[];
}

/** Um item proposto dentro de uma proposta. */
export interface ProposalItem {
  asset: string;
  priority: string;
  reason: string;
}

/** Uma proposta pendente de um ambiente. */
export interface Proposal {
  id: string;
  type: string;
  room_name: string;
  area_m2: number;
  items: ProposalItem[];
}

/** Bloco `proposals` — propostas aguardando decisão. */
export interface StateProposals {
  pending: Proposal[];
}

/** Uma referência visual do refpack. */
export interface RefpackReference {
  id: string;
  title: string;
  source: string;
  why_good: string;
  status: string;
  og_image: string;
}

/** Bloco `refpack` — tema, direção e referências. */
export interface StateRefpack {
  theme: string;
  direction: string;
  references: RefpackReference[];
  counts: Record<string, number>;
}

/** Um render listado no estado legado. */
export interface RenderEntry {
  name: string;
  theme: string;
  sub: string;
  kb: number;
}

/** Bloco `learning` — regras novas e anti-padrões aprendidos. */
export interface StateLearning {
  new_rules: unknown[];
  anti_patterns: unknown[];
}

/** Uma entrada da base de conhecimento. */
export interface KnowledgeEntry {
  title: string;
  preview: string;
}

/** Bloco `knowledge` — entradas indexadas. */
export interface StateKnowledge {
  entries: KnowledgeEntry[];
}

/** Bloco `consult` — estado da ponte de consulta. */
export interface StateConsult {
  status: string;
  bridge_mode: string;
}

/** GET /api/state — payload legado completo consumido pelas telas. */
export interface StudioState {
  // todos opcionais: o BFF normaliza falha do upstream para {} (use optional chaining)
  overview?: StateOverview;
  factory?: StateFactory;
  agents?: StateAgents;
  backlog?: StateBacklog;
  sessions?: StateSessions;
  proposals?: StateProposals;
  refpack?: StateRefpack;
  renders?: RenderEntry[];
  learning?: StateLearning;
  knowledge?: StateKnowledge;
  consult?: StateConsult;
}

/** Alias de compat: resposta de disparo de run. */
export type RunResponse = RunTriggerResponse;

/* ───────────────────────────── Live activity (file-map) ───────────────────────────── */
/* Feed "acontecendo agora": eventos de atividade emitidos pelo BFF (proxy/ollama/derive/
   serve/runner). Espelha o FileActivityEvent do file_activity.py. */

export type FileOp =
  | "read" | "write" | "execute" | "serve" | "proxy" | "generate" | "modify" | "delete" | "error" | "classify";
export type FileSource = "frontend" | "bff" | "upstream" | "runner" | "agent" | "ollama" | "watcher" | "manual";
export type FileEventStatus = "started" | "ok" | "warn" | "error";

/** Um evento de atividade ao vivo (item do SSE /api/file-map/events/stream). */
export interface FileActivityEvent {
  id: string;
  seq: number;
  ts: IsoString;
  repo: "sketchup-mcp-bff" | "sketchup-mcp" | "external";
  path: string;
  op: FileOp;
  source: FileSource;
  status: FileEventStatus;
  endpoint?: string;
  runId?: string;
  workflowId?: string;
  agentId?: string;
  label?: string;
  confidence?: "high" | "medium" | "low";
  details?: Record<string, unknown>;
}

/** GET /api/file-map/events — backlog recente + cursor. */
export interface FileEventsResponse {
  events: FileActivityEvent[];
  cursor: number;
}

/* ── NOC mirror (vidro read-only do atuador autônomo) ───────────────────────*/
export interface NocLockState {
  state: "held" | "stale" | "free";
  alive: boolean;
  label: string;
  owner?: string;
  pid?: number;
  ageS?: number;
  staleForS?: number;
}
export interface NocTask {
  taskId: string;
  title: string;
  status: string; // COMMITTED / VERIFY_FAILED / VISUAL_REVIEW_QUEUED / NOOP / DRY_RUN / ...
  branch?: string | null;
  worktree?: string | null;
  dryRun: boolean;
  rc?: number | null;
  verifyChecked: string[];
  verifyMissing: string[];
  outTail: string;
  ts?: number | null;
}
export interface NocLedgerResponse {
  live: boolean;
  reason?: string;
  tasks: NocTask[];
  visualReview: NocTask[];
  rawLines?: number;
  source?: string;
}
export interface NocStatusResponse {
  nocRoot: string;
  present: boolean;
  lock: NocLockState;
  queueCount: number;
  taskCount: number;
  live: boolean;
}

/* ── Oráculo/:8765 espelhado por ARQUIVO (bridge_mirror — vidro read-only) ──────────────*/
export interface BridgeHealth {
  level: "GREEN" | "YELLOW" | "RED";
  reasons: string[];
  signals: {
    visualReviewPending: number;
    dirtyRepos: number;
    activeSessions: number | null;
    gateLastActivityS: number | null;
    nocLock: string | null;
  };
}
export interface GateConsult {
  ts: number;
  model?: string | null;
  tier?: string | null;
  effort?: string | null;
  mode?: string | null;
  qChars?: number | null;
  aChars?: number | null;
  durSec?: number | null;
}
export interface BridgeGate {
  live: boolean;
  reason?: string;
  consults: GateConsult[];
  consultCount: number;
  lastActivityAgeS: number | null;
}
/** um ACESSO ao gate ao vivo (linha nova do audit.jsonl, via SSE). */
export interface GateAccessEvent {
  kind: "consult" | "heartbeat" | string;
  ts: number;
  model?: string | null;
  tier?: string | null;
  durSec?: number | null;
  qChars?: number | null;
  aChars?: number | null;
  session?: string | null;
  cycle?: number | null;
}
export interface GateStreamSeed {
  consultCount: number;
  lastActivityAgeS: number | null;
}
export interface ClaudeSession {
  id: string;
  project: string;
  idleSec: number;
  state: "ACTIVE" | "IDLE" | "STOPPED";
}
export interface BridgeSessions {
  live: boolean;
  reason?: string;
  sessions: ClaudeSession[];
  total: number;
  active: number;
}
export interface GitRepo {
  name: string;
  branch: string;
  dirty: number;
  lastCommit: string;
}
export interface BridgeGit {
  live: boolean;
  repos: GitRepo[];
  worktrees: number;
  dirtyRepos: string[];
}
export interface SkpPlant {
  plant: string;
  skpCount: number;
  latestSkp: string;
  latestMtime: number;
  renders: number;
}
export interface BridgeSkp {
  live: boolean;
  reason?: string;
  plants: SkpPlant[];
}

/* ─────────────── Curadoria (KICKOFF_CURADORIA) — corpus julgado + clique do humano ─────────────── */

/** Verdict da MÁQUINA sobre uma variante — NUNCA IMPROVED/SAME/WORSE (esses são exclusivos do humano). */
export type MachineVerdict = "CANDIDATE" | "FAIL" | "PENDING_VISION";

/** Status VIVO do laço autônomo de revisão (curation_review no motor). */
export type CurationAnalysisStatus =
  | "na_fila" | "em_analise" | "revisado" | "corrigindo"
  | "concluido" | "aguardando_felipe" | "oraculo_offline";
/** Verdict do HUMANO (Felipe) — só nasce de clique na tela de curadoria. */
export type HumanVerdictValue = "IMPROVED" | "SAME" | "WORSE";
export type GateVerdict = "PASS" | "WARN" | "FAIL";

/** Um dos 7 eixos do visual_findings.v1 (FP-032). */
export interface CurationAxis {
  verdict: GateVerdict;
  evidence: string;
}

/** Um padrão de design observado pelo painel de juízes (memória pré-FP-035). */
export interface DesignPattern {
  pattern: string;
  verdict: "works" | "fails" | "neutral";
  why: string;
}

/** Veredito humano fundido de human_verdicts.jsonl (last-wins por variant_id). */
export interface HumanVerdict {
  verdict: HumanVerdictValue | null;
  note: string;
  t: string | null;
  /** gosto do Felipe (thumbs); null = não sinalizado */
  liked?: boolean | null;
  tags?: string[];
  batch_id?: string | null;
}

/** Uma variante julgada do corpus (last-wins do corpus.jsonl). */
export interface CurationVariant {
  variant_id: string;
  created_at: string | null;
  plant: string;
  verdict: MachineVerdict;
  /** objeto inteiro — o label "machine_provisional" é honestidade, não decoração */
  machine_score: { value: number | null; label: string } | null;
  params: { style: string | null; theme: string; layout_seed: number; layout_source?: string };
  theme: string;
  gates: Record<string, GateVerdict>;
  n_boxes: number | null;
  img: string | null;
  renderer: string | null;
  top_level_verdict: string | null;
  discriminated: boolean;
  axes: Record<string, CurationAxis>;
  findings_count: number;
  patterns: DesignPattern[];
  promotion_note: string | null;
  /** nº de appends no corpus (transparência do upgrade PENDING_VISION→CANDIDATE) */
  revisions: number;
  human_verdict: HumanVerdict | null;
  /** laço autônomo de revisão: status VIVO do card + nota/crítica do GPT-no-Docker.
   *  Opcional/null quando o item ainda não passou pelo laço (degrade honesto; o
   *  mirror sempre emite os campos, mocks antigos podem omiti-los). */
  analysis_status?: CurationAnalysisStatus | null;
  analysis_detail?: string | null;
  analysis_t?: number | null;
  gpt_nota?: number | null;
  gpt_porque?: string | null;
  gpt_caminho?: string | null;
  gpt_reviewed_at?: number | null;
}

/** Agregação de um pattern por todo o corpus (Fatia 3 — "o que já aprendemos"). */
export interface PatternAgg {
  pattern: string;
  works: number;
  fails: number;
  neutral: number;
  themes: string[];
  variants: string[];
  why: string[];
}

export interface CurationPatterns {
  total: number;
  works: number;
  fails: number;
  neutral: number;
  patterns: PatternAgg[];
}

/** GET /api/curation/<plant> — galeria + padrões numa leitura só. */
export interface CurationResponse {
  live: boolean;
  plant: string;
  reason?: string;
  counts: Record<string, number>;
  awaiting_human?: number;
  themes: string[];
  variants: CurationVariant[];
  patterns: CurationPatterns;
}

/** GET /api/curation/plants */
export interface CurationPlantsResponse {
  plants: string[];
  root: string;
}

/** POST /api/curation/<plant>/verdict — o clique do Felipe (veredito único). */
export interface CurationVerdictRequest {
  variant_id: string;
  verdict: HumanVerdictValue;
  note?: string;
  liked?: boolean | null;
  tags?: string[];
}

/** Um registro curadoria_verdict.v1 como gravado (o shape que o BFF devolve em `recorded`). */
export interface CurationVerdictRecord {
  variant_id: string;
  human_verdict: HumanVerdictValue;
  liked: boolean | null;
  note: string;
  tags: string[];
  batch_id: string;
  t: string;
}

export interface CurationVerdictResponse {
  ok: boolean;
  recorded?: CurationVerdictRecord;
  error?: string;
}

/** Um item do POST em LOTE — human_verdict conforme o curadoria_verdict schema. */
export interface CurationVerdictBatchItem {
  variant_id: string;
  human_verdict: HumanVerdictValue;
  liked?: boolean | null;
  note?: string;
  tags?: string[];
}

/** POST /api/curation/<plant>/verdicts — o clique do Felipe em LOTE (plural). */
export interface CurationVerdictBatchResponse {
  ok: boolean;
  batch_id?: string;
  t?: string;
  recorded?: CurationVerdictRecord[];
  errors?: { variant_id: string | null; error: string }[];
  error?: string;
}

/* ─────────────── Histórico de decisões (CARTEIRO / auto_decider) — vidro do audit ─────────────── */

/** Superfície da decisão — os dois tipos de proposta que o carteiro dreta. */
export type DecisionType = "furniture_program" | "consistency_gap";
/** Veredito objetivo do juiz (COMO resolveu). TASTE_REFUSED = gosto → a máquina se abstém. */
export type DecisionClassification =
  | "OBJECTIVE_STRONG_PASS" | "OBJECTIVE_STRONG_FAIL" | "BORDERLINE" | "INVALID" | "TASTE_REFUSED";
/** O que de fato aconteceu com a proposta. */
export type DecisionAction =
  | "auto_approve" | "auto_reject" | "escalated_gate" | "left_pending" | "refused_taste";
/** QUEM decidiu — o RAIL: nunca um humano. */
export type DecidedBy = "auto_decider" | "gate_mode_b";

/** Meta do gate (só quando a decisão foi escalada — mode B). */
export interface DecisionGate {
  trigger?: string | null;
  status?: string | null;
  verdict?: string | null;
  confidence?: string | null;
  applied?: string | null;
}

/** Um registro do audit do carteiro (decision_audit_record/1.0.0), projetado pelo mirror. */
export interface DecisionAuditRecord {
  decision_id: string;
  decision_type: DecisionType | null;
  classification: DecisionClassification | null;
  action: DecisionAction | null;
  confidence: number | null;
  /** razão legível (ex.: "completude:high BANHO 01 — falta CORE: vaso") */
  evidence: string[];
  /** {interns, geometry_sanity, furniture_overlap} → PASS|WARN|FAIL|SKIPPED */
  judge_verdicts: Record<string, string>;
  gate: DecisionGate | null;
  decided_by: DecidedBy | null;
  corpus_version: string | null;
  created_at: string | null;
  /** o audit só grava decisões APLICADAS; selo defensivo */
  dry_run: boolean;
}

/** Contagem por ação — as 5 chaves sempre presentes (zero-filled). */
export interface DecisionCounts {
  auto_approve: number;
  auto_reject: number;
  escalated_gate: number;
  refused_taste: number;
  left_pending: number;
}

/** GET /api/decisions/history?limit= — histórico do carteiro, mais-recente-primeiro. */
export interface DecisionHistoryResponse {
  live: boolean;
  reason?: string;
  records: DecisionAuditRecord[];
  counts: DecisionCounts;
  total: number;
  source?: string;
}

/* ─────────────── Acionamentos do CARTEIRO (gatilho + vidro dos runs) ─────────────── */

/** POST /api/carteiro/run — "Rodar carteiro agora": o BFF TOCA o gatilho; o atuador (host)
 *  roda o drain no próximo sweep (≤60s). 503 quando o motor está read-only. */
export interface CarteiroRunResponse {
  ok: boolean;
  queued_at?: string;
  note?: string;
  error?: string;
  hint?: string;
  detail?: string;
}

/** Um acionamento (drain) do carteiro, projetado pelo mirror: quando rodou, o que
 *  disparou, quantas decidiu e como se distribuíram. */
export interface CarteiroRunRecord {
  t: string | null;
  /** "manual" (botão) | "auto" (sweep) — o que disparou o drain. */
  trigger: string | null;
  decided: number;
  auto_approve: number;
  auto_reject: number;
  escalated: number;
  left_pending: number;
  dry_run: boolean;
}

/** GET /api/carteiro/runs?limit= — acionamentos do carteiro, mais-recente-primeiro. */
export interface CarteiroRunsResponse {
  live: boolean;
  reason?: string;
  runs: CarteiroRunRecord[];
  last_run: string | null;
  total: number;
  source?: string;
}
