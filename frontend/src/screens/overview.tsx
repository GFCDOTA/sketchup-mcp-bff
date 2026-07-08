import { Link, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowRight, Workflow as WorkflowIcon, Network } from "lucide-react";
import { useStatus, useAgents, useRuns, useWorkflows, useLiveActivity, useRunAgent } from "@/api/hooks";
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

// Ícone por AGENTE (id primeiro — os 3 LLMs compartilham role "LLM"); role como
// fallback pros líderes; 🤖 como último recurso.
const AGENT_EMOJI_BY_ID: Record<string, string> = {
  "interior-pm": "🧭",
  "interior-orchestrator": "🛠️",
  "interior-designer": "📐",
  "ollama-llama": "🦙",      // Llama
  "ollama-qwen": "👑",       // Qwen ("Queen")
  "ollama-deepseek": "🐳",   // DeepSeek (logo = baleia)
  "gpt-docker": "💬",        // GPT (ChatGPT no Docker)
};
const AGENT_EMOJI: Record<string, string> = { PM: "🧭", "Team Lead": "🛠️", Arquiteto: "📐" };
// nome curto por agente — pra saber num relance QUEM está no ar
const AGENT_SHORT: Record<string, string> = {
  "gpt-docker": "GPT", "ollama-llama": "Llama", "ollama-qwen": "Qwen", "ollama-deepseek": "DeepSeek",
  "interior-pm": "PM", "interior-orchestrator": "Orchestrator", "interior-designer": "Designer",
};

// Logo real (SVG inline) para agentes com marca própria. Precede o emoji.
// OpenAI "blossom" branca sobre disco preto — igual ao badge do ChatGPT.
const OPENAI_LOGO = (
  <svg viewBox="0 0 256 260" width="1em" height="1em" role="img" aria-label="ChatGPT"
       style={{ verticalAlign: "middle", display: "inline-block" }}>
    <circle cx="128" cy="130" r="128" fill="#000000" />
    <g transform="translate(44 44) scale(0.66)">
      <path fill="#ffffff" d="M239.183914,106.202783 C245.054304,88.5242096 243.02228,69.1733805 233.607599,53.0998864 C219.451678,28.4588021 190.999703,15.7836129 163.213007,21.739505 C147.554077,4.32145883 123.794909,-3.42398554 100.87901,1.41873898 C77.9631105,6.26146349 59.3690093,22.9572536 52.0959621,45.2214219 C33.8436494,48.9644867 18.0901721,60.392749 8.86672513,76.5818033 C-5.443491,101.182962 -2.19544431,132.215255 16.8986662,153.320094 C11.0060865,170.990656 13.0197283,190.343991 22.4238231,206.422991 C36.5975553,231.072344 65.0680342,243.746566 92.8695738,237.783372 C105.235639,251.708249 123.001113,259.630942 141.623968,259.52692 C170.105359,259.552169 195.337611,241.165718 204.037777,214.045661 C222.28734,210.296356 238.038489,198.869783 247.267014,182.68528 C261.404453,158.127515 258.142494,127.262775 239.183914,106.202783 L239.183914,106.202783 Z M141.623968,242.541207 C130.255682,242.559177 119.243876,238.574642 110.519381,231.286197 L112.054146,230.416496 L163.724595,200.590881 C166.340648,199.056444 167.954321,196.256818 167.970781,193.224005 L167.970781,120.373788 L189.815614,133.010026 C190.034132,133.121423 190.186235,133.330564 190.224885,133.572774 L190.224885,193.940229 C190.168603,220.758427 168.442166,242.484864 141.623968,242.541207 Z M37.1575749,197.93062 C31.456498,188.086359 29.4094818,176.546984 31.3766237,165.342426 L32.9113895,166.263285 L84.6329973,196.088901 C87.2389349,197.618207 90.4682717,197.618207 93.0742093,196.088901 L156.255402,159.663793 L156.255402,184.885111 C156.243557,185.149771 156.111725,185.394602 155.89729,185.550176 L103.561776,215.733903 C80.3054953,229.131632 50.5924954,221.165435 37.1575749,197.93062 Z M23.5493181,85.3811273 C29.2899861,75.4733097 38.3511911,67.9162648 49.1287482,64.0478825 L49.1287482,125.438515 C49.0891492,128.459425 50.6965386,131.262556 53.3237748,132.754232 L116.198014,169.025864 L94.3531808,181.662102 C94.1132325,181.789434 93.8257461,181.789434 93.5857979,181.662102 L41.3526015,151.529534 C18.1419426,138.076098 10.1817681,108.385562 23.5493181,85.125333 L23.5493181,85.3811273 Z M203.0146,127.075598 L139.935725,90.4458545 L161.7294,77.8607748 C161.969348,77.7334434 162.256834,77.7334434 162.496783,77.8607748 L214.729979,108.044502 C231.032329,117.451747 240.437294,135.426109 238.871504,154.182739 C237.305714,172.939368 225.050719,189.105572 207.414262,195.67963 L207.414262,134.288998 C207.322521,131.276867 205.650697,128.535853 203.0146,127.075598 Z M224.757116,94.3850867 L223.22235,93.4642272 L171.60306,63.3828173 C168.981293,61.8443751 165.732456,61.8443751 163.110689,63.3828173 L99.9806554,99.8079259 L99.9806554,74.5866077 C99.9533004,74.3254088 100.071095,74.0701869 100.287609,73.9215426 L152.520805,43.7889738 C168.863098,34.3743518 189.174256,35.2529043 204.642579,46.0434841 C220.110903,56.8340638 227.949269,75.5923959 224.757116,94.1804513 L224.757116,94.3850867 Z M88.0606409,139.097931 L66.2158076,126.512851 C65.9950399,126.379091 65.8450965,126.154176 65.8065367,125.898945 L65.8065367,65.684966 C65.8314495,46.8285367 76.7500605,29.6846032 93.8270852,21.6883055 C110.90411,13.6920079 131.063833,16.2835462 145.5632,28.338998 L144.028434,29.2086986 L92.3579852,59.0343142 C89.7419327,60.5687513 88.1282597,63.3683767 88.1117998,66.4011901 L88.0606409,139.097931 Z M99.9294965,113.5185 L128.06687,97.3011417 L156.255402,113.5185 L156.255402,145.953218 L128.169187,162.170577 L99.9806554,145.953218 L99.9294965,113.5185 Z" />
    </g>
  </svg>
);
const AGENT_LOGO_BY_ID: Record<string, ReactNode> = { "gpt-docker": OPENAI_LOGO };

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
  const workflows = useWorkflows();
  const activity = useLiveActivity(28);

  const agentList = agents.data?.agents ?? [];
  const online = agentList.filter((a) => a.online).length;
  const recentRuns = (runs.data?.runs ?? []).slice(0, 6);
  const activeWf = (workflows.data?.workflows ?? []).find((w) => w.status === "running");
  const ollamaOk = !!status.data?.ollama.ok;

  return (
    <div className="space-y-6">
      {/* header */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mission control — o oráculo (GPT) conduz a operação; os agentes locais são a retaguarda.
        </p>
      </header>

      {/* PRESENÇA — quem está logado AGORA (logo + status), no topo */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">No ar agora</span>
        {agentList.length === 0 ? (
          <span className="text-xs text-muted-foreground/50">{agents.isLoading ? "carregando…" : "nenhum agente reportando"}</span>
        ) : (
          agentList.map((a) => {
            const glyph = AGENT_LOGO_BY_ID[a.id] ?? AGENT_EMOJI_BY_ID[a.id] ?? AGENT_EMOJI[a.role] ?? "🤖";
            const short = AGENT_SHORT[a.id] ?? a.name;
            return (
              <span
                key={a.id}
                title={`${a.name} · ${a.online ? "online" : "offline"}${a.model ? ` · ${a.model}` : ""}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  a.online
                    ? "border-ok/30 bg-ok/[0.07] text-foreground"
                    : "border-border bg-secondary/40 text-muted-foreground/70 opacity-60 grayscale",
                )}
              >
                <span className="text-base leading-none">{glyph}</span>
                {short}
                <span className={cn("size-1.5 rounded-full", a.online ? "bg-ok animate-pulse-dot" : "bg-muted-foreground/40")} />
              </span>
            );
          })
        )}
        <span className="ml-auto text-[11px] text-muted-foreground/50">{online}/{agentList.length} online</span>
      </div>

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

        {/* oráculo (GPT/gate) + sistema */}
        <div className="col-span-12 space-y-4 lg:col-span-5">
          <AnimatedSection delay={0.03}>
            <GatePulse />
          </AnimatedSection>

          <AnimatedSection delay={0.04}>
            <GateRecent />
          </AnimatedSection>

          <AnimatedSection delay={0.05}>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Network className="size-4 text-muted-foreground" /> Sistema</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                <Row label="Motor (arquivo)" ok={status.data?.upstream.ok} detail={status.data?.upstream.ok ? "legível" : "inacessível"} />
                <Row label="Ollama (modelos)" ok={ollamaOk} detail={ollamaOk ? `${status.data!.ollama.models} modelos` : "offline"} />
                <Row label="Agentes (retaguarda)" ok={online > 0} detail={`${online} online`} />
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>

        {/* runs recentes */}
        <AnimatedSection className="col-span-12 lg:col-span-7" delay={0.05}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="size-4 text-muted-foreground" /> Runs recentes</CardTitle>
              <Link to="/operacao?tab=runs" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">ver todos <ArrowRight className="size-3.5" /></Link>
            </CardHeader>
            <CardContent>
              {recentRuns.length === 0 ? (
                <EmptyState icon={Activity} title="Nenhum run ainda" sub="A operação roda pelo oráculo (GPT)." />
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
              <Link to="/operacao?tab=workflows" className="text-xs text-muted-foreground hover:text-foreground">workflows <ArrowRight className="inline size-3.5" /></Link>
            </CardHeader>
            <CardContent>
              {activeWf ? (
                <div>
                  <div className="mb-3 text-sm"><b>{activeWf.name}</b> <span className="text-muted-foreground">— {activeWf.description}</span></div>
                  <Pipeline steps={activeWf.steps} />
                </div>
              ) : (
                <EmptyState icon={WorkflowIcon} title="Nenhum workflow rodando" sub="Os disponíveis ficam na aba Operação." />
              )}
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>

      {/* estúdio — o time (PM, Arquiteto, Estagiários, modelos locais + GPT) ao vivo */}
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
