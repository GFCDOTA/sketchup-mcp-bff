import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ChevronRight } from "lucide-react";
import { useRuns } from "@/api/hooks";
import type { RunStatus } from "@/api/types";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState, ErrorState } from "@/components/states";
import { SkeletonText } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/utils";

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "running", label: "Rodando" },
  { key: "succeeded", label: "Sucesso" },
  { key: "failed", label: "Falha" },
];

function fmtDur(ms?: number) {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** Corpo da aba "Runs" da tela Operação (sem header próprio; filtro inline). */
export function RunsPanel() {
  const { data, isLoading, isError, error } = useRuns();
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  const runs = (data?.runs ?? []).filter((r) => filter === "all" || r.status === (filter as RunStatus));

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f.key} value={f.key}>{f.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isError ? (
        <ErrorState message={error?.message} />
      ) : isLoading ? (
        <Card className="p-4"><SkeletonText lines={6} /></Card>
      ) : runs.length === 0 ? (
        <Card><EmptyState icon={Activity} title="Nenhum run" sub="Dispare um agente ou workflow." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_110px_120px_90px_28px] items-center gap-3 border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            <span>Run</span><span>Tipo</span><span>Status</span><span>Duração</span><span />
          </div>
          <div className="divide-y divide-border/60">
            {runs.map((r) => (
              <button
                key={r.id}
                onClick={() => navigate(`/runs/${r.id}`)}
                className="grid w-full grid-cols-[1fr_110px_120px_90px_28px] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.title}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground/50">
                    {r.agentName ?? r.workflowId ?? r.id} · {timeAgo(r.startedAt)}
                  </div>
                </div>
                <span className="text-xs capitalize text-muted-foreground">{r.kind}</span>
                <StatusPill status={r.status} pulse={r.status === "running"} />
                <span className="font-mono text-xs text-muted-foreground">{fmtDur(r.durationMs)}</span>
                <ChevronRight className="size-4 text-muted-foreground/40" />
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
