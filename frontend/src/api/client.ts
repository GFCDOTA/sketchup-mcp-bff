// client.ts — cliente HTTP tipado do BFF.
// Regra de arquitetura: o frontend fala SÓ com /api/* (o BFF integra Ollama/agents).
// Em dev, o Vite faz proxy de /api → BFF (:8782). VITE_MOCKS=1 usa fixtures tipadas.
import type {
  StatusResponse, ModelsResponse, ChatRequest, ChatResponse,
  AgentsResponse, RunsResponse, RunDetailResponse, RunLogsResponse,
  ArtifactsResponse, DecisionsResponse, DecisionRespondRequest, DecisionRespondResponse,
  WorkflowsResponse, RunTriggerResponse, LogLine, StudioState,
  FileEventsResponse, FileActivityEvent,
  NocLedgerResponse, NocStatusResponse,
  BridgeHealth, BridgeGate, BridgeSessions, BridgeGit, BridgeSkp,
  GateAccessEvent, GateStreamSeed,
  CurationResponse, CurationPlantsResponse, CurationVerdictRequest, CurationVerdictResponse,
  CurationVerdictBatchItem, CurationVerdictBatchResponse,
  DecisionHistoryResponse, CarteiroRunsResponse, CarteiroRunResponse,
  HojeResponse,
} from "./types";
import { mocks } from "./mocks";

export const USE_MOCKS = import.meta.env.VITE_MOCKS === "1";

/** Planta default da curadoria — hoje só a planta_74 tem corpus julgado. */
export const DEFAULT_PLANT = "planta_74";

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    ...init,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      detail = j.error ?? j.detail ?? j.hint ?? detail; // envelope de erro do BFF usa `error`
    } catch {
      /* corpo não-JSON */
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

/* ── endpoints ─────────────────────────────────────────────────────────────*/
export const api = {
  async status(): Promise<StatusResponse> {
    if (USE_MOCKS) return delay(120).then(() => mocks.status);
    return http("/api/status");
  },
  async models(): Promise<ModelsResponse> {
    if (USE_MOCKS) return delay().then(() => mocks.models);
    return http("/api/models");
  },
  async chat(body: ChatRequest): Promise<ChatResponse> {
    if (USE_MOCKS) return delay(700).then(() => ({ ...mocks.chat, model: body.model }));
    // timeout no cliente para a UI não pendurar se o modelo local travar
    return http("/api/models/chat", {
      method: "POST", body: JSON.stringify(body), signal: AbortSignal.timeout(125_000),
    });
  },
  async agents(): Promise<AgentsResponse> {
    if (USE_MOCKS) return delay().then(() => mocks.agents);
    return http("/api/agents");
  },
  async runAgent(id: string, input?: string): Promise<RunTriggerResponse> {
    if (USE_MOCKS) return delay().then(() => mocks.runStarted);
    return http(`/api/agents/${encodeURIComponent(id)}/run`, {
      method: "POST", body: JSON.stringify({ input }),
    });
  },
  async runs(): Promise<RunsResponse> {
    if (USE_MOCKS) return delay().then(() => mocks.runs);
    return http("/api/runs");
  },
  async run(id: string): Promise<RunDetailResponse> {
    if (USE_MOCKS) return delay().then(() => ({ run: mocks.getRun(id) }));
    return http(`/api/runs/${encodeURIComponent(id)}`);
  },
  async runLogs(id: string): Promise<RunLogsResponse> {
    if (USE_MOCKS) return delay().then(() => ({ logs: mocks.getRunLogs(id) }));
    return http(`/api/runs/${encodeURIComponent(id)}/logs?format=json`);
  },
  async artifacts(): Promise<ArtifactsResponse> {
    if (USE_MOCKS) return delay().then(() => mocks.artifacts);
    return http("/api/artifacts");
  },
  async decisions(): Promise<DecisionsResponse> {
    if (USE_MOCKS) return delay().then(() => mocks.decisions);
    return http("/api/decisions");
  },
  // HISTÓRICO do CARTEIRO (auto_decider) — vidro read-only do audit.jsonl por ARQUIVO
  async decisionHistory(limit = 100): Promise<DecisionHistoryResponse> {
    if (USE_MOCKS) return delay().then(() => ({
      live: true, total: 3,
      counts: { auto_approve: 1, auto_reject: 1, escalated_gate: 1, refused_taste: 0, left_pending: 0 },
      records: [
        {
          decision_id: "furniture_program_r004", decision_type: "furniture_program",
          classification: "OBJECTIVE_STRONG_PASS", action: "auto_approve", confidence: 1.0,
          evidence: ["interns=PASS", "geometry_sanity=PASS", "furniture_overlap=PASS"],
          judge_verdicts: { interns: "PASS", geometry_sanity: "PASS", furniture_overlap: "PASS" },
          gate: null, decided_by: "auto_decider", corpus_version: "unknown",
          created_at: "2026-07-04T06:00:00Z", dry_run: false,
        },
        {
          decision_id: "gap_capacidade_r004", decision_type: "consistency_gap",
          classification: "BORDERLINE", action: "escalated_gate", confidence: 0.5,
          evidence: ["gate: BORDERLINE — decisão objetiva delegada ao oráculo (mode B)"],
          judge_verdicts: { interns: "WARN", geometry_sanity: "PASS", furniture_overlap: "WARN" },
          gate: { trigger: "objective_gate_borderline", status: "ok", verdict: "VISUAL_REVIEW", confidence: "medium", applied: null },
          decided_by: "gate_mode_b", corpus_version: "unknown",
          created_at: "2026-07-04T05:30:00Z", dry_run: false,
        },
        {
          decision_id: "furniture_program_r005", decision_type: "furniture_program",
          classification: "OBJECTIVE_STRONG_FAIL", action: "auto_reject", confidence: 0.33,
          evidence: ["completude:high BANHO 01 — falta CORE: vaso", "interns=FAIL"],
          judge_verdicts: { interns: "FAIL", geometry_sanity: "PASS", furniture_overlap: "PASS" },
          gate: null, decided_by: "auto_decider", corpus_version: "unknown",
          created_at: "2026-07-04T05:00:00Z", dry_run: false,
        },
      ],
    }) as DecisionHistoryResponse);
    return http(`/api/decisions/history?limit=${encodeURIComponent(limit)}`);
  },
  // ACIONAMENTOS do CARTEIRO (auto_decider) — vidro read-only dos runs por ARQUIVO
  async carteiroRuns(limit = 50): Promise<CarteiroRunsResponse> {
    if (USE_MOCKS) return delay().then(() => ({
      live: true, total: 2, last_run: "2026-07-04T06:00:00Z",
      runs: [
        { t: "2026-07-04T06:00:00Z", trigger: "manual", decided: 3, auto_approve: 2,
          auto_reject: 1, escalated: 0, left_pending: 1, dry_run: false },
        { t: "2026-07-04T05:00:00Z", trigger: "auto", decided: 1, auto_approve: 0,
          auto_reject: 1, escalated: 1, left_pending: 2, dry_run: false },
      ],
    }) as CarteiroRunsResponse);
    return http(`/api/carteiro/runs?limit=${encodeURIComponent(limit)}`);
  },
  // o GATILHO — "Rodar carteiro agora": o BFF toca o arquivo, o atuador (host) roda no sweep
  async runCarteiro(source = "manual"): Promise<CarteiroRunResponse> {
    if (USE_MOCKS) return delay().then(() => ({
      ok: true, queued_at: new Date().toISOString(),
      note: "o atuador roda no proximo sweep (ate ~60s)",
    }));
    return http("/api/carteiro/run", { method: "POST", body: JSON.stringify({ source }) });
  },
  async respondDecision(id: string, body: DecisionRespondRequest): Promise<DecisionRespondResponse> {
    if (USE_MOCKS) return delay().then(() => ({ ok: true }));
    return http(`/api/decisions/${encodeURIComponent(id)}/respond`, {
      method: "POST", body: JSON.stringify(body),
    });
  },
  async workflows(): Promise<WorkflowsResponse> {
    if (USE_MOCKS) return delay().then(() => mocks.workflows);
    return http("/api/workflows");
  },
  async runWorkflow(id: string): Promise<RunTriggerResponse> {
    if (USE_MOCKS) return delay().then(() => mocks.runStarted);
    return http(`/api/workflows/${encodeURIComponent(id)}/run`, { method: "POST", body: "{}" });
  },
  async state(): Promise<StudioState> {
    if (USE_MOCKS) return delay().then(() => ({}) as StudioState);
    return http("/api/state");
  },
  async fileEvents(since = 0): Promise<FileEventsResponse> {
    if (USE_MOCKS) return delay(120).then(() => mocks.fileEvents);
    return http(`/api/file-map/events?since=${since}`);
  },
  async nocLedger(): Promise<NocLedgerResponse> {
    if (USE_MOCKS) return delay().then(() => ({
      live: true, visualReview: [],
      tasks: [{ taskId: "T1", title: "exemplo (mock)", status: "COMMITTED", branch: "chore/noc-t1",
        worktree: "", dryRun: false, rc: 0, verifyChecked: ["x.md"], verifyMissing: [], outTail: "mock" }],
    }) as NocLedgerResponse);
    return http("/api/noc/ledger");
  },
  async nocStatus(): Promise<NocStatusResponse> {
    if (USE_MOCKS) return delay().then(() => ({
      nocRoot: "(mock)", present: true, live: true, queueCount: 1, taskCount: 1,
      lock: { state: "free", alive: false, label: "ocioso (mock)" },
    }) as NocStatusResponse);
    return http("/api/noc/status");
  },
  // ── Oráculo/:8765 espelhado por ARQUIVO (bridge_mirror) ──────────────────────
  async bridgeHealth(): Promise<BridgeHealth> {
    if (USE_MOCKS) return delay().then(() => ({
      level: "YELLOW", reasons: ["2 repos com mudança não-commitada (mock)"],
      signals: { visualReviewPending: 0, dirtyRepos: 2, activeSessions: 3, gateLastActivityS: 42, nocLock: "free" },
    }) as BridgeHealth);
    return http("/api/bridge/health");
  },
  async bridgeGate(): Promise<BridgeGate> {
    if (USE_MOCKS) return delay().then(() => ({
      live: true, consultCount: 12, lastActivityAgeS: 42,
      consults: [{ ts: Date.now() / 1000, model: "claude-opus-4-8", tier: "deep", effort: "xhigh", mode: "default", qChars: 424, aChars: 1907, durSec: 72.6 }],
    }) as BridgeGate);
    return http("/api/bridge/gate");
  },
  async bridgeSessions(): Promise<BridgeSessions> {
    if (USE_MOCKS) return delay().then(() => ({
      live: true, total: 84, active: 3,
      sessions: [{ id: "74e148f0", project: "E--Claude", idleSec: 2, state: "ACTIVE" }],
    }) as BridgeSessions);
    return http("/api/bridge/sessions");
  },
  async bridgeGit(): Promise<BridgeGit> {
    if (USE_MOCKS) return delay().then(() => ({
      live: true, worktrees: 5, dirtyRepos: ["sketchup-mcp"],
      repos: [{ name: "sketchup-mcp", branch: "chore/ci-gate", dirty: 11, lastCommit: "b0f11e4 chore(ci)" }],
    }) as BridgeGit);
    return http("/api/bridge/git");
  },
  async bridgeSkp(): Promise<BridgeSkp> {
    if (USE_MOCKS) return delay().then(() => ({
      live: true, plants: [{ plant: "planta_74", skpCount: 7, latestSkp: "planta_74_furnished.skp", latestMtime: Date.now() / 1000, renders: 217 }],
    }) as BridgeSkp);
    return http("/api/bridge/skp");
  },
  // ── Curadoria (KICKOFF_CURADORIA): corpus julgado por ARQUIVO + clique do humano ──
  async curation(plant: string): Promise<CurationResponse> {
    if (USE_MOCKS) return delay().then(() => ({
      live: true, plant, counts: { CANDIDATE: 1 }, awaiting_human: 1, themes: ["warm_compact"],
      variants: [{
        variant_id: `${plant}__baseline__warm_compact__L0`, created_at: "2026-07-04T05:00:14Z",
        plant, verdict: "CANDIDATE", machine_score: { value: 0.6, label: "machine_provisional" },
        params: { style: null, theme: "", layout_seed: 0 }, theme: "warm_compact",
        gates: { geometry_sanity: "PASS" }, n_boxes: 200, img: null, renderer: "su-free",
        top_level_verdict: "WARN", discriminated: false,
        axes: { wall_fidelity: { verdict: "FAIL", evidence: "sem shell (mock)" } },
        findings_count: 5,
        patterns: [{ pattern: "paleta warm compacta (mock)", verdict: "works", why: "coesa" }],
        promotion_note: null, revisions: 3, human_verdict: null,
      }],
      patterns: { total: 1, works: 1, fails: 0, neutral: 0, patterns: [
        { pattern: "paleta warm compacta (mock)", works: 1, fails: 0, neutral: 0,
          themes: ["warm_compact"], variants: [`${plant}__baseline__warm_compact__L0`], why: ["coesa"] },
      ] },
    }) as CurationResponse);
    return http(`/api/curation/${encodeURIComponent(plant)}`);
  },
  async curationPlants(): Promise<CurationPlantsResponse> {
    if (USE_MOCKS) return delay().then(() => ({ plants: ["planta_74"], root: "(mock)" }));
    return http("/api/curation/plants");
  },
  // HOJE — home orientada a exceções (autonomia + missões + inbox)
  async hoje(): Promise<HojeResponse> {
    if (USE_MOCKS) return delay().then(() => ({
      live: true, plant: DEFAULT_PLANT,
      autonomy: { estado: "RODANDO", estado_banner: "NORMAL", ultima_atividade: Date.now() / 1000 - 300,
                  proximo_ciclo_s: 600, atuador_vivo: true, bloqueios: [], n_bloqueios: 0,
                  n_esperando_voce: 2 },
      missions: [{ plant: DEFAULT_PLANT, tema: "warm_compact", titulo: `${DEFAULT_PLANT} · warm_compact`,
                   etiqueta: "ESPERA_VOCE", n_variantes: 2, melhor_nota: 4, n_esperando_voce: 2,
                   n_em_revisao: 0, proxima_acao: "você dá o veredito em 2 variante(s)" }],
      inbox: [{ tipo: "gosto", titulo: "Dar seu veredito em 2 variante(s) — warm_compact",
                detalhe: "IMPROVED / SAME / WORSE", n: 2, rota: "/curation" }],
      generated_at: Date.now() / 1000,
    }) as HojeResponse);
    return http("/api/hoje");
  },
  // o CLIQUE — única origem legítima de human_verdict (rail do kickoff)
  async respondCurationVerdict(plant: string, body: CurationVerdictRequest): Promise<CurationVerdictResponse> {
    if (USE_MOCKS) return delay().then(() => ({ ok: true }));
    return http(`/api/curation/${encodeURIComponent(plant)}/verdict`, {
      method: "POST", body: JSON.stringify(body),
    });
  },
  // o clique em LOTE (plural) — N vereditos num POST, um único batch_id no BFF
  async respondCurationVerdicts(plant: string, items: CurationVerdictBatchItem[]): Promise<CurationVerdictBatchResponse> {
    if (USE_MOCKS) return delay().then(() => ({
      ok: true, batch_id: "hv_mock", t: new Date().toISOString(),
      recorded: items.map((it) => ({
        variant_id: it.variant_id, human_verdict: it.human_verdict,
        liked: it.liked ?? null, note: it.note ?? "", tags: it.tags ?? [],
        batch_id: "hv_mock", t: new Date().toISOString(),
      })), errors: [],
    }));
    return http(`/api/curation/${encodeURIComponent(plant)}/verdicts`, {
      method: "POST", body: JSON.stringify({ items }),
    });
  },
};

/* ── SSE: stream de logs ao vivo de um run ─────────────────────────────────-*/
export function streamRunLogs(
  id: string,
  onLine: (line: LogLine) => void,
  onEnd?: () => void,
): () => void {
  if (USE_MOCKS) {
    // simula streaming a partir das fixtures
    const lines = mocks.getRunLogs(id);
    let i = 0;
    const t = setInterval(() => {
      if (i >= lines.length) {
        clearInterval(t);
        onEnd?.();
        return;
      }
      onLine(lines[i++]);
    }, 500);
    return () => clearInterval(t);
  }
  const es = new EventSource(`/api/runs/${encodeURIComponent(id)}/logs`);
  es.onmessage = (ev) => {
    try {
      onLine(JSON.parse(ev.data) as LogLine);
    } catch {
      /* ignora linha malformada */
    }
  };
  es.addEventListener("end", () => {
    es.close();
    onEnd?.();
  });
  es.onerror = () => {
    // EventSource reconecta sozinho em erro transitório; só encerra se fechou de vez
    if (es.readyState === EventSource.CLOSED) {
      es.close();
      onEnd?.();
    }
  };
  return () => es.close();
}

/* ── SSE: feed "acontecendo agora" — eventos de atividade do BFF ─────────────-*/
export function streamFileEvents(
  onEvent: (e: FileActivityEvent) => void,
  onError?: () => void,
): () => void {
  if (USE_MOCKS) {
    let i = 0;
    const seed = mocks.fileEvents.events;
    const t = setInterval(() => {
      onEvent({ ...seed[i % seed.length], id: `mock-${i}`, seq: 1000 + i, ts: new Date().toISOString() });
      i++;
    }, 1800);
    return () => clearInterval(t);
  }
  const es = new EventSource(`/api/file-map/events/stream`);
  es.onmessage = (ev) => {
    try {
      onEvent(JSON.parse(ev.data) as FileActivityEvent);
    } catch {
      /* ignora linha malformada / heartbeat */
    }
  };
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      es.close();
      onError?.();
    }
  };
  return () => es.close();
}

/* ── SSE: ACESSOS ao gate ao vivo (tail do audit.jsonl) ─────────────────────-*/
export function streamGateAccess(
  onEvent: (e: GateAccessEvent) => void,
  onSeed?: (seed: GateStreamSeed) => void,
  onError?: () => void,
): () => void {
  if (USE_MOCKS) {
    onSeed?.({ consultCount: 12, lastActivityAgeS: 42 });
    let i = 0;
    const t = setInterval(() => {
      onEvent(i % 3 === 0
        ? { kind: "consult", ts: Date.now() / 1000, model: "claude-opus-4-8", tier: "deep", durSec: 30 + i, qChars: 420, aChars: 1500 }
        : { kind: "heartbeat", ts: Date.now() / 1000, session: "74e148f0", cycle: 10 + i });
      i++;
    }, 2200);
    return () => clearInterval(t);
  }
  const es = new EventSource(`/api/bridge/gate/stream`);
  es.addEventListener("seed", (ev) => {
    try { onSeed?.(JSON.parse((ev as MessageEvent).data) as GateStreamSeed); } catch { /* ignora */ }
  });
  es.onmessage = (ev) => {
    try { onEvent(JSON.parse(ev.data) as GateAccessEvent); } catch { /* keep-alive/malformada */ }
  };
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) { es.close(); onError?.(); }
  };
  return () => es.close();
}
