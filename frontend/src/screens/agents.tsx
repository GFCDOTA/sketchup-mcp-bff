import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, Cpu, Play, Wrench } from "lucide-react";
import { useAgents, useRunAgent } from "@/api/hooks";
import type { Agent } from "@/api/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState, ErrorState } from "@/components/states";
import { SkeletonText } from "@/components/ui/skeleton";
import { staggerContainer, staggerItem } from "@/components/flow/animated-section";

/** Corpo da aba "Agentes" da tela Operação (sem header próprio). */
export function AgentsPanel() {
  const { data, isLoading, isError, error } = useAgents();
  const runAgent = useRunAgent();
  const navigate = useNavigate();

  if (isError) return <ErrorState message={error?.message} />;
  if (isLoading)
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-4"><SkeletonText lines={4} /></CardContent></Card>
        ))}
      </div>
    );
  if ((data?.agents ?? []).length === 0) return <EmptyState icon={Bot} title="Sem agentes" />;

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data!.agents.map((a) => (
        <motion.div key={a.id} variants={staggerItem} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}>
          <AgentCard
            agent={a}
            onRun={() => runAgent.mutate({ id: a.id }, { onSuccess: (r) => r.runId && navigate(`/runs/${r.runId}`) })}
            running={runAgent.isPending && runAgent.variables?.id === a.id}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

function AgentCard({ agent, onRun, running }: { agent: Agent; onRun: () => void; running: boolean }) {
  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 pt-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-secondary text-muted-foreground">
            <Bot className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold">{agent.name}</span>
              <span className={`size-2 shrink-0 rounded-full ${agent.online ? "bg-ok shadow-[0_0_6px] shadow-ok" : "bg-muted-foreground/40"}`} />
            </div>
            <div className="text-xs text-muted-foreground/60">{agent.role} · {agent.umbrella}</div>
          </div>
          <StatusPill status={agent.status} pulse={agent.status === "working"} />
        </div>

        {agent.message && <p className="line-clamp-2 text-xs text-muted-foreground">{agent.message}</p>}

        <div className="flex flex-wrap items-center gap-1.5">
          {agent.model && (
            <Badge variant="info" className="gap-1 normal-case"><Cpu className="size-3" /> {agent.model}</Badge>
          )}
          {agent.tools.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              <Wrench className="size-3 text-muted-foreground/50" /> {t}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-border/60 pt-3">
          <Button size="sm" variant="primary" onClick={onRun} disabled={running}>
            <Play className="size-3.5" /> {running ? "Disparando…" : "Run"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
