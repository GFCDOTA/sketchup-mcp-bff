import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, Activity, Workflow as WorkflowIcon, Cpu, type LucideIcon } from "lucide-react";
import { useAgents, useRuns, useWorkflows, useModels } from "@/api/hooks";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AgentsPanel } from "@/screens/agents";
import { RunsPanel } from "@/screens/runs";
import { WorkflowsPanel } from "@/screens/workflows";
import { ModelsPanel } from "@/screens/models";

type TabKey = "agentes" | "runs" | "workflows" | "modelos";
const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "agentes", label: "Agentes", icon: Bot },
  { key: "runs", label: "Runs", icon: Activity },
  { key: "workflows", label: "Workflows", icon: WorkflowIcon },
  { key: "modelos", label: "Modelos", icon: Cpu },
];

/** Operação — o time, as execuções, as recipes e os modelos, num lugar só (abas). */
export default function Operacao() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as TabKey | null;
  const tab: TabKey = TABS.some((t) => t.key === raw) ? (raw as TabKey) : "agentes";

  // contagens ao vivo nas abas (React Query dedupa com os panels — sem fetch duplo)
  const agents = useAgents();
  const runs = useRuns();
  const workflows = useWorkflows();
  const models = useModels();
  const counts: Record<TabKey, number | undefined> = {
    agentes: (agents.data?.agents ?? []).filter((a) => a.online).length || undefined,
    runs: (runs.data?.runs ?? []).filter((r) => r.status === "running").length || undefined,
    workflows: workflows.data?.workflows.length,
    modelos: models.data?.models.length,
  };

  return (
    <>
      <PageHeader title="Operação" subtitle="O time, as execuções, as recipes e os modelos locais — num lugar só." />

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="mb-4 flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              <t.icon className="size-3.5" /> {t.label}
              {counts[t.key] != null && (
                <span className={cn(
                  "ml-1 rounded-full px-1.5 text-[10px] font-semibold leading-4",
                  tab === t.key ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground/70",
                )}>
                  {counts[t.key]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
              {t.key === "agentes" && <AgentsPanel />}
              {t.key === "runs" && <RunsPanel />}
              {t.key === "workflows" && <WorkflowsPanel />}
              {t.key === "modelos" && <ModelsPanel />}
            </motion.div>
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
