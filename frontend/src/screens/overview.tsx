import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bot, Activity, Inbox, Cpu, ArrowRight, Workflow as WorkflowIcon,
  CheckCircle2, Network, type LucideIcon,
} from "lucide-react";
import { useStatus, useAgents, useRuns, useDecisions, useWorkflows, useLiveActivity, useRunAgent } from "@/api/hooks";
import type { FileActivityEvent } from "@/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Pipeline } from "@/components/pipeline";
import { LiveActivity } from "@/components/live-activity";
import { GatePulse } from "@/components/gate-pulse";
import { GateRecent } from "@/components/gate-recent";
import { AgentStage } from "@/components/agent-stage";
import { EmptyState } from "@/components/states";
import { AnimatedSection, staggerContainer, staggerItem } from "@/components/flow/animated-section";
import { cn, timeAgo } from "@/lib/utils";
import type { Tone } from "@/lib/status";

const VAL_TONE: Record<Tone, string> = {
  ok: "text-ok", info: "text-blue", warn: "text-warn", danger: "text-danger", neutral: "text-foreground",
};
const ICON_TONE: Record<Tone, string> = {
  ok: "bg-ok/12 text-ok", info: "bg-blue/12 text-blue", warn: "bg-warn/12 text-warn",
  danger: "bg-danger/12 text-danger", neutral: "bg-secondary text-muted-foreground",
};
const AGENT_EMOJI: Record<string, string> = { PM: "🧭", "Team Lead": "🛠️", Arquiteto: "📐" };

/** Mapeia um evento de atividade para a seção da doc "Como Funciona" que o explica. */
function docAnchor(ev: FileActivityEvent): string {
  if (ev.path.includes("artifacts")) return "artifacts";
  if (ev.source === "ollama") return "agentes";
  if (ev.source === "upstream") return "arquitetura";
  if (ev.source === "runner" || ev.runId) return "agentes";
  if (ev.endpoint) return "api";
  return "fluxo";
}

export default function Overview() {
  const navigate = useNavigate();
  const status = useStatus();
  const agents = useAgents();
  const runAgent = useRunAgent();
  const runs = useRuns();
  const decisions = useDecisions();
  const workflows = useWorkflows();
  const activity = useLiveActivity(28);

  const total = agents.data?.agents.length ?? 0;
  const online = (agents.data?.agents ?? []).filter((a) => a.online).length;
  const running = (runs.data?.runs ?? []).filter((r) => r.status === "running").length;
  const pending = (decisions.data?.decisions ?? []).filter((d) => d.status === "pending");
  const recentRuns = (runs.data?.runs ?? []).slice(0, 6);
  const activeWf = (workflows.data?.workflows ?? []).find((w) => w.status === "running");
  const ollamaOk = !!status.data?.ollama.ok;
  const agentList = agents.data?.agents ?? [];

  const agentFaces = (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {agentList.map((a) => (
        <span key={a.id} title={`${a.name} · ${a.online ? "online" : "offline"}`} className={cn("relative text-lg leading-none", !a.online && "opacity-40 grayscale")}>
          {AGENT_EMOJI[a.role] ?? "🤖"}
          <span className={cn("absolute -right-1 -top-0.5 size-1.5 rounded-full ring-1 ring-card", a.online ? "bg-ok" : "bg-muted-foreground/40")} />
        </span>
      ))}
    </div>
  );

  const metrics: { label: string; value: React.ReactNode; icon: LucideIcon; tone: Tone; pulse?: boolean; extra?: React.ReactNode }[] = [
    { label: "Agentes online", value: agents.isLoading ? "—" : `${online}/${total}`, icon: Bot, tone: online ? "ok" : "neutral", pulse: online > 0, extra: agentList.length ? agentFaces : undefined },
    { label: "Runs ativos", value: runs.isLoading ? "—" : running, icon: Activity, tone: running ? "info" : "neutral", pulse: running > 0 },
    { label: "Decisões pendentes", value: decisions.isLoading ? "—" : pending.length, icon: Inbox, tone: pending.length ? "warn" : "neutral", pulse: pending.length > 0 },
    { label: "Modelos locais", value: ollamaOk ? status.data!.ollama.models : "off", icon: Cpu, tone: ollamaOk ? "ok" : "neutral" },
  ];

  return (
    <div className="space-y-6">
      {/* header com pulso do sistema */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
          <p className="mt-1 text-sm text-muted-foreground">Mission control — o estado do estúdio, ao vivo.</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
            activity.live ? "border-ok/25 bg-ok/10 text-ok" : "border-border bg-card text-muted-foreground",
          )}
        >
          <span className={cn("size-1.5 rounded-full", activity.live ? "bg-ok animate-pulse-dot" : "bg-muted-foreground/50")} />
          {activity.live ? "sistema ao vivo" : "conectando"}
        </span>
      </header>

      {/* métricas animadas */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m) => (
          <motion.div
            key={m.label}
            variants={staggerItem}
            whileHover={{ y: -3 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="group relative overflow-hidden rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between">
              <span className={cn("grid size-9 place-items-center rounded-lg", ICON_TONE[m.tone])}>
                <m.icon className="size-5" />
              </span>
              {m.pulse && <span className={cn("mt-1 size-2 rounded-full animate-pulse-dot", VAL_TONE[m.tone].replace("text-", "bg-"))} />}
            </div>
            <div className={cn("mt-3 font-mono text-3xl font-bold leading-none tracking-tight", VAL_TONE[m.tone])}>{m.value}</div>
            <div className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/60">{m.label}</div>
            {m.extra}
          </motion.div>
        ))}
      </motion.div>

      {/* grid principal */}
      <div className="grid grid-cols-12 gap-4">
        {/* acontecendo agora — centro */}
        <AnimatedSection className="col-span-12 lg:col-span-7">
          <Card className="h-full p-4">
            <LiveActivity
              events={activity.events}
              live={activity.live}
              className="h-full"
              onSelect={(ev) => navigate(`/flow#${docAnchor(ev)}`)}
            />
          </Card>
        </AnimatedSection>

        {/* gate + decisões + sistema */}
        <div className="col-span-12 space-y-4 lg:col-span-5">
          <AnimatedSection delay={0.03}>
            <GatePulse />
          </AnimatedSection>

          <AnimatedSection delay={0.04}>
            <GateRecent />
          </AnimatedSection>

          <AnimatedSection delay={0.05}>
            <Card accent="gold">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Inbox className="size-4 text-warn" /> Decisões pendentes</CardTitle>
                <Link to="/decisions" className="text-xs text-muted-foreground hover:text-foreground">ver todas <ArrowRight className="inline size-3.5" /></Link>
              </CardHeader>
              <CardContent>
                {pending.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="Tudo em dia" sub="Nenhuma decisão aguardando." />
                ) : (
                  <div className="space-y-2">
                    {pending.slice(0, 3).map((d) => (
                      <Link key={d.id} to="/decisions" className="block rounded-lg border border-border bg-background/50 p-3 transition-colors hover:border-warn/30 hover:bg-warn/[0.04]">
                        <div className="text-sm font-medium">{d.title}</div>
                        <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{d.question}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Network className="size-4 text-muted-foreground" /> Sistema</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                <Row label="Motor (arquivo)" ok={status.data?.upstream.ok} detail={status.data?.upstream.ok ? "legível" : "inacessível"} />
                <Row label="Ollama (modelos)" ok={ollamaOk} detail={ollamaOk ? `${status.data!.ollama.models} modelos` : "offline"} />
                <Row label="Agentes" ok={online > 0} detail={`${online} online`} />
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>

        {/* runs recentes */}
        <AnimatedSection className="col-span-12 lg:col-span-7" delay={0.05}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="size-4 text-muted-foreground" /> Runs recentes</CardTitle>
              <Link to="/runs" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">ver todos <ArrowRight className="size-3.5" /></Link>
            </CardHeader>
            <CardContent>
              {recentRuns.length === 0 ? (
                <EmptyState icon={Activity} title="Nenhum run ainda" sub="Dispare um agente ou workflow." />
              ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="show" className="-mt-1 divide-y divide-border/60">
                  {recentRuns.map((r) => (
                    <motion.div key={r.id} variants={staggerItem}>
                      <Link to={`/runs/${r.id}`} className="flex items-center gap-3 py-2.5 transition-opacity hover:opacity-90">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{r.title}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground/60">{r.kind} · {r.agentName ?? r.workflowId} · {timeAgo(r.startedAt)}</div>
                        </div>
                        <StatusPill status={r.status} pulse={r.status === "running"} />
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>

        {/* workflow ativo */}
        <AnimatedSection className="col-span-12 lg:col-span-5" delay={0.1}>
          <Card accent="blue" className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><WorkflowIcon className="size-4 text-muted-foreground" /> Workflow ativo</CardTitle>
              <Link to="/workflows" className="text-xs text-muted-foreground hover:text-foreground">workflows <ArrowRight className="inline size-3.5" /></Link>
            </CardHeader>
            <CardContent>
              {activeWf ? (
                <div>
                  <div className="mb-3 text-sm"><b>{activeWf.name}</b> <span className="text-muted-foreground">— {activeWf.description}</span></div>
                  <Pipeline steps={activeWf.steps} />
                </div>
              ) : (
                <EmptyState icon={WorkflowIcon} title="Nenhum workflow rodando" sub="Os disponíveis ficam na aba Workflows." />
              )}
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>

      {/* estúdio — time de agentes (bonequinhos) ao vivo, embaixo do "acontecendo agora" */}
      <AnimatedSection delay={0.05}>
        <AgentStage
          agents={agents.data?.agents ?? []}
          onRun={(id) => runAgent.mutate({ id })}
          runningId={runAgent.isPending ? runAgent.variables?.id ?? null : null}
        />
      </AnimatedSection>
    </div>
  );
}

function Row({ label, ok, detail }: { label: string; ok?: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <StatusPill tone={ok ? "ok" : "danger"} label={detail ?? (ok ? "ok" : "off")} />
    </div>
  );
}
