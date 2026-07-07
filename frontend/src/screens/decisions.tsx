import { motion } from "framer-motion";
import { Inbox, CheckCircle2, MessageSquare } from "lucide-react";
import { useDecisions, useRespondDecision } from "@/api/hooks";
import type { Decision } from "@/api/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState, ErrorState } from "@/components/states";
import { SkeletonText } from "@/components/ui/skeleton";
import { staggerContainer, staggerItem } from "@/components/flow/animated-section";

export default function Decisions() {
  const { data, isLoading, isError, error } = useDecisions();
  const respond = useRespondDecision();

  const pending = (data?.decisions ?? []).filter((d) => d.status === "pending");
  const answered = (data?.decisions ?? []).filter((d) => d.status !== "pending");

  return (
    <>
      <PageHeader title="Decisões" subtitle="Gates que aguardam você — propostas de programa e revisões visuais" />

      {isError ? (
        <ErrorState message={error?.message} />
      ) : isLoading ? (
        <Card className="p-4"><SkeletonText lines={4} /></Card>
      ) : pending.length === 0 && answered.length === 0 ? (
        <Card><EmptyState icon={CheckCircle2} title="Tudo em dia" sub="Nenhuma decisão registrada." /></Card>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-3">
              {pending.map((d) => (
                <motion.div key={d.id} variants={staggerItem}>
                  <DecisionCard
                    d={d}
                    onRespond={(choice) => respond.mutate({ id: d.id, choice })}
                    busy={respond.isPending && respond.variables?.id === d.id}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {answered.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">Respondidas</div>
              <div className="space-y-2">
                {answered.map((d) => (
                  <Card key={d.id} className="opacity-70">
                    <CardContent className="flex items-center justify-between py-3">
                      <div><div className="text-sm font-medium">{d.title}</div><div className="text-xs text-muted-foreground/60">{d.source}</div></div>
                      <StatusPill status={d.status} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function DecisionCard({ d, onRespond, busy }: { d: Decision; onRespond: (c: string) => void; busy: boolean }) {
  return (
    <Card accent="gold">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-secondary text-warn">
              <Inbox className="size-4" />
            </span>
            <div>
              <div className="font-semibold">{d.title}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                <Badge variant="outline" className="normal-case">{d.type}</Badge>
                <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" /> {d.source}</span>
              </div>
            </div>
          </div>
          <StatusPill status="pending" />
        </div>

        <p className="mt-3 text-sm text-foreground/90">{d.question}</p>

        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
          {(d.options ?? ["Aprovar", "Rejeitar"]).map((opt, i) => (
            <Button
              key={opt}
              size="sm"
              variant={i === 0 ? "primary" : "secondary"}
              disabled={busy}
              onClick={() => onRespond(opt)}
            >
              {opt}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
