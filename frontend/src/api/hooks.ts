// hooks.ts — camada de dados (TanStack Query) sobre o client tipado.
import { useEffect, useRef, useState } from "react";
import {
  useMutation, useQuery, useQueryClient, type UseQueryOptions,
} from "@tanstack/react-query";
import { api, streamRunLogs, streamFileEvents, streamGateAccess } from "./client";
import type {
  ChatRequest, LogLine, FileActivityEvent, GateAccessEvent, CurationVerdictRequest,
} from "./types";

export const qk = {
  status: ["status"] as const,
  models: ["models"] as const,
  agents: ["agents"] as const,
  runs: ["runs"] as const,
  run: (id: string) => ["run", id] as const,
  runLogs: (id: string) => ["run", id, "logs"] as const,
  artifacts: ["artifacts"] as const,
  decisions: ["decisions"] as const,
  workflows: ["workflows"] as const,
  state: ["state"] as const,
  nocLedger: ["noc", "ledger"] as const,
  nocStatus: ["noc", "status"] as const,
  bridgeHealth: ["bridge", "health"] as const,
  bridgeGate: ["bridge", "gate"] as const,
  bridgeSessions: ["bridge", "sessions"] as const,
  bridgeGit: ["bridge", "git"] as const,
  bridgeSkp: ["bridge", "skp"] as const,
  curation: (plant: string) => ["curation", plant] as const,
};

type QOpts<T> = Omit<UseQueryOptions<T, Error, T>, "queryKey" | "queryFn">;

export const useStatus = (o?: QOpts<Awaited<ReturnType<typeof api.status>>>) =>
  useQuery({ queryKey: qk.status, queryFn: api.status, refetchInterval: 6000, ...o });

export const useModels = () => useQuery({ queryKey: qk.models, queryFn: api.models });

export const useAgents = () =>
  useQuery({ queryKey: qk.agents, queryFn: api.agents, refetchInterval: 4000 });

export const useRuns = () =>
  useQuery({ queryKey: qk.runs, queryFn: api.runs, refetchInterval: 3000 });

export const useRun = (id: string) =>
  useQuery({ queryKey: qk.run(id), queryFn: () => api.run(id), enabled: !!id, refetchInterval: 2500 });

export const useRunLogs = (id: string, enabled = true) =>
  useQuery({ queryKey: qk.runLogs(id), queryFn: () => api.runLogs(id), enabled: !!id && enabled });

export const useArtifacts = () => useQuery({ queryKey: qk.artifacts, queryFn: api.artifacts });

export const useDecisions = () =>
  useQuery({ queryKey: qk.decisions, queryFn: api.decisions, refetchInterval: 6000 });

export const useWorkflows = () => useQuery({ queryKey: qk.workflows, queryFn: api.workflows });

export const useStudioState = () =>
  useQuery({ queryKey: qk.state, queryFn: api.state, refetchInterval: 5000 });

export const useNocLedger = () =>
  useQuery({ queryKey: qk.nocLedger, queryFn: api.nocLedger, refetchInterval: 4000 });

export const useNocStatus = () =>
  useQuery({ queryKey: qk.nocStatus, queryFn: api.nocStatus, refetchInterval: 6000 });

/* ── Oráculo/:8765 espelhado por arquivo ────────────────────────────────────-*/
export const useBridgeHealth = () =>
  useQuery({ queryKey: qk.bridgeHealth, queryFn: api.bridgeHealth, refetchInterval: 6000 });
export const useBridgeGate = () =>
  useQuery({ queryKey: qk.bridgeGate, queryFn: api.bridgeGate, refetchInterval: 8000 });
export const useBridgeSessions = () =>
  useQuery({ queryKey: qk.bridgeSessions, queryFn: api.bridgeSessions, refetchInterval: 6000 });
export const useBridgeGit = () =>
  useQuery({ queryKey: qk.bridgeGit, queryFn: api.bridgeGit, refetchInterval: 10000 });
export const useBridgeSkp = () =>
  useQuery({ queryKey: qk.bridgeSkp, queryFn: api.bridgeSkp, refetchInterval: 15000 });

/* ── Curadoria: corpus julgado por arquivo + o clique do Felipe ─────────────-*/
export const useCuration = (plant: string) =>
  useQuery({ queryKey: qk.curation(plant), queryFn: () => api.curation(plant),
             enabled: !!plant, refetchInterval: 6000 });

export function useCurationVerdict(plant: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CurationVerdictRequest) => api.respondCurationVerdict(plant, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.curation(plant) }),
  });
}

/* ── SSE: ACESSOS ao gate AO VIVO (tail do audit.jsonl) — como o "Acontecendo agora", mas do gate ─*/
export function useGateLive(max = 24) {
  const [events, setEvents] = useState<GateAccessEvent[]>([]);
  const [count, setCount] = useState(0);       // acessos observados nesta conexão (consult + heartbeat)
  const [consults, setConsults] = useState(0); // consults (seed do ledger + os que chegam ao vivo)
  const [live, setLive] = useState(false);
  const startRef = useRef<number>(Date.now());
  const [, tick] = useState(0);

  useEffect(() => {
    startRef.current = Date.now();
    setEvents([]); setCount(0); setConsults(0);
    const stop = streamGateAccess(
      (e) => {
        setLive(true);
        setCount((c) => c + 1);
        if (e.kind === "consult") setConsults((c) => c + 1);
        setEvents((prev) => [e, ...prev].slice(0, max));
      },
      (seed) => { setLive(true); setConsults(seed.consultCount); },  // seed chega na conexão → já é "ao vivo"
      () => setLive(false),
    );
    return stop;
  }, [max]);

  // re-render a cada 5s pra a taxa (acessos/min) andar mesmo sem evento novo
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const elapsedMin = Math.max((Date.now() - startRef.current) / 60000, 0.05);
  const ratePerMin = count / elapsedMin;
  return { events, count, consults, live, ratePerMin };
}

/* ── mutations ─────────────────────────────────────────────────────────────*/
export function useRunAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input?: string }) => api.runAgent(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.runs });
      qc.invalidateQueries({ queryKey: qk.agents });
    },
  });
}

export function useRunWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.runWorkflow(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.runs }),
  });
}

export function useChat() {
  return useMutation({ mutationFn: (body: ChatRequest) => api.chat(body) });
}

export function useRespondDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, choice }: { id: string; choice: string }) =>
      api.respondDecision(id, { choice }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.decisions }),
  });
}

/* ── SSE: feed "acontecendo agora" (atividade do BFF ao vivo) ───────────────-*/
export function useLiveActivity(max = 24) {
  const [events, setEvents] = useState<FileActivityEvent[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let mounted = true;
    // semeia com o backlog recente, depois faz tail via SSE
    api.fileEvents(0)
      .then((r) => mounted && setEvents(r.events.slice(-max)))
      .catch(() => {});
    const stop = streamFileEvents(
      (e) => {
        if (!mounted) return;
        setLive(true);
        setEvents((prev) => (prev.some((p) => p.id === e.id) ? prev : [...prev, e].slice(-max)));
      },
      () => mounted && setLive(false),
    );
    return () => {
      mounted = false;
      stop();
    };
  }, [max]);

  return { events, live };
}

/* ── SSE: logs ao vivo de um run ───────────────────────────────────────────-*/
export function useRunLogStream(id: string | undefined, live: boolean) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setLines([]);
    setDone(false);
    if (!id || !live) return;
    const stop = streamRunLogs(
      id,
      (line) => setLines((prev) => [...prev, line]),
      () => setDone(true),
    );
    return stop;
  }, [id, live]);

  return { lines, done };
}
