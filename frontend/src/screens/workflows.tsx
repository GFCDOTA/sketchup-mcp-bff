import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Workflow as WorkflowIcon, Play, ArrowRight, AlertTriangle, Wrench } from "lucide-react";
import { useWorkflows, useRunWorkflow } from "@/api/hooks";
import type { Workflow } from "@/api/types";
import { Card, CardContent, CardHeader, CardTitle, CardEyebrow } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { Pipeline } from "@/components/pipeline";
import { EmptyState, ErrorState } from "@/components/states";
import { SkeletonText } from "@/components/ui/skeleton";
import { staggerContainer, staggerItem } from "@/components/flow/animated-section";

/** Corpo da aba "Workflows" da tela Operação (sem header próprio). */
export function WorkflowsPanel() {
  const { data, isLoading, isError, error } = useWorkflows();
  const runWf = useRunWorkflow();
  const navigate = useNavigate();

  if (isError) return <ErrorState message={error?.message} />;
  if (isLoading)
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => <Card key={i} className="p-4"><SkeletonText lines={6} /></Card>)}
      </div>
    );
  if ((data?.workflows ?? []).length === 0) return <EmptyState icon={WorkflowIcon} title="Sem workflows" />;

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-4 lg:grid-cols-2">
      {data!.workflows.map((w) => (
        <motion.div key={w.id} variants={staggerItem}>
          <WorkflowCard
            wf={w}
            onRun={() => runWf.mutate(w.id, { onSuccess: (r) => r.runId && navigate(`/runs/${r.runId}`) })}
            running={runWf.isPending && runWf.variables === w.id}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <CardEyebrow className="mb-1.5">{title}</CardEyebrow>
      {children}
    </div>
  );
}

function Chips({ items, icon: Icon }: { items: string[]; icon?: typeof Wrench }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
          {Icon && <Icon className="size-3 text-muted-foreground/50" />} {t}
        </span>
      ))}
    </div>
  );
}

function WorkflowCard({ wf, onRun, running }: { wf: Workflow; onRun: () => void; running: boolean }) {
  return (
    <Card accent="gold" className="flex flex-col">
      <CardHeader>
        <div>
          <CardEyebrow>recipe</CardEyebrow>
          <CardTitle className="mt-0.5 text-base">{wf.name}</CardTitle>
        </div>
        <StatusPill status={wf.status} pulse={wf.status === "running"} />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="text-sm text-muted-foreground">{wf.description}</p>

        <Section title="Quando usar"><p className="text-sm text-muted-foreground/90">{wf.whenToUse}</p></Section>

        <Pipeline steps={wf.steps} />

        <div className="grid grid-cols-2 gap-4">
          <Section title="Inputs"><Chips items={wf.inputs} /></Section>
          <Section title="Outputs"><Chips items={wf.outputs} /></Section>
        </div>

        <Section title="Tools"><Chips items={wf.tools} icon={Wrench} /></Section>

        {wf.risks && wf.risks.length > 0 && (
          <Section title="Riscos">
            <ul className="space-y-1">
              {wf.risks.map((r) => (
                <li key={r} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" /> {r}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="mt-auto flex items-center gap-2 border-t border-border/60 pt-3">
          <Button size="sm" variant="primary" onClick={onRun} disabled={running}>
            <Play className="size-3.5" /> {running ? "Disparando…" : "Rodar workflow"}
          </Button>
          {wf.lastRunId && (
            <Button size="sm" variant="ghost" asChild>
              <Link to={`/runs/${wf.lastRunId}`}>último run <ArrowRight className="size-3.5" /></Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
