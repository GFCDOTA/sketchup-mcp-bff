// decision-history.tsx — HISTÓRICO DE DECISÕES do CARTEIRO (auto_decider / gate mode B).
// Vidro read-only do audit.jsonl que o motor escreve por decisão OBJETIVA drenada.
// Por decisão o Felipe vê: O QUE PEDIRAM (decision_id + tipo) · COMO RESOLVEU
// (classification + action) · QUEM decidiu + QUÃO CONFIANTE · O QUE USOU
// (judge_verdicts + evidence expandível) · QUANDO (relativo) + selo dry-run/aplicado.
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Gavel, ServerCog, ShieldCheck, ChevronDown, ChevronRight, Bot, Scale, Clock,
} from "lucide-react";
import { useDecisionHistory } from "@/api/hooks";
import type {
  DecisionAction, DecisionAuditRecord, DecisionClassification, DecisionType,
} from "@/api/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/states";
import { SkeletonText } from "@/components/ui/skeleton";
import { staggerContainer, staggerItem } from "@/components/flow/animated-section";
import { cn } from "@/lib/utils";

type BadgeVariant = BadgeProps["variant"];

/* action = O QUE ACONTECEU. approve=verde · reject=danger · escalated=blue · refused/pending=warn */
const ACTION_BADGE: Record<DecisionAction, BadgeVariant> = {
  auto_approve: "ok", auto_reject: "danger", escalated_gate: "info",
  refused_taste: "warn", left_pending: "warn",
};
const ACTION_LABEL: Record<DecisionAction, string> = {
  auto_approve: "aprovado", auto_reject: "rejeitado", escalated_gate: "escalado ao gate",
  refused_taste: "recusado (gosto)", left_pending: "deixado p/ humano",
};
/* classification = COMO RESOLVEU (o veredito objetivo do juiz) */
const CLASS_BADGE: Record<DecisionClassification, BadgeVariant> = {
  OBJECTIVE_STRONG_PASS: "ok", OBJECTIVE_STRONG_FAIL: "danger", BORDERLINE: "info",
  INVALID: "warn", TASTE_REFUSED: "purple",
};
const TYPE_LABEL: Record<DecisionType, string> = {
  furniture_program: "programa de móveis", consistency_gap: "gap de consistência",
};
/* verdicts dos juízes (interns/geometry_sanity/furniture_overlap) + gate — pontinho colorido */
const VERDICT_DOT: Record<string, string> = {
  PASS: "bg-ok", WARN: "bg-warn", FAIL: "bg-danger", SKIPPED: "bg-border",
  GO: "bg-ok", "NO-GO": "bg-danger", VISUAL_REVIEW: "bg-warn",
};

const ACTION_FILTERS: DecisionAction[] = [
  "auto_approve", "auto_reject", "escalated_gate", "refused_taste", "left_pending",
];

function fmtRelative(iso: string | null): { rel: string; abs: string } {
  if (!iso) return { rel: "—", abs: "" };
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return { rel: iso, abs: iso };
  const abs = new Date(iso).toLocaleString("pt-BR");
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return { rel: `${Math.round(s)}s atrás`, abs };
  if (s < 5400) return { rel: `${Math.round(s / 60)}min atrás`, abs };
  if (s < 172800) return { rel: `${Math.round(s / 3600)}h atrás`, abs };
  return { rel: `${Math.round(s / 86400)}d atrás`, abs };
}

export default function DecisionHistory() {
  const { data, isLoading, isError, error } = useDecisionHistory(100);
  const [actionFilter, setActionFilter] = useState<"ALL" | DecisionAction>("ALL");

  const records = (data?.records ?? []).filter(
    (r) => actionFilter === "ALL" || r.action === actionFilter,
  );

  return (
    <>
      <PageHeader
        title="Histórico de decisões"
        subtitle="Cada decisão OBJETIVA que o carteiro (auto_decider) avaliou: o que pediram, como resolveu, o que usou como evidência, quão confiante, quem decidiu e quando — lido de ARQUIVO (o motor nunca é tocado)."
      />

      {/* faixa de honestidade — o carteiro decide no motor, o cockpit só LÊ o audit */}
      <Card className="mb-4 border-blue/20 bg-blue/[0.04]">
        <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium text-blue">
            <ServerCog className="size-4" /> Vidro read-only
          </span>
          <span>O carteiro classifica e aplica no motor; aqui é só o <code>auto_decider_audit.jsonl</code>.</span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-ok" /> objetivo ≠ gosto · quem decide nunca é humano
          </span>
        </CardContent>
      </Card>

      {isError ? (
        <ErrorState message={error?.message} />
      ) : isLoading ? (
        <Card className="p-4"><SkeletonText lines={5} /></Card>
      ) : !data?.live ? (
        <Card><EmptyState icon={Gavel} title="Sem histórico do carteiro"
          sub={data?.reason ?? "o auto_decider ainda não aplicou nenhuma decisão"} /></Card>
      ) : (
        <div className="space-y-4">
          {/* placar por ação + filtro (as 5 chaves sempre presentes) */}
          <div className="flex flex-wrap items-center gap-2">
            <CountChip label={`Todas (${data.total})`}
              active={actionFilter === "ALL"} onClick={() => setActionFilter("ALL")} />
            {ACTION_FILTERS.map((a) => (
              <CountChip key={a} label={`${ACTION_LABEL[a]} (${data.counts[a] ?? 0})`}
                variant={ACTION_BADGE[a]} active={actionFilter === a}
                onClick={() => setActionFilter(a)} />
            ))}
          </div>

          {records.length === 0 ? (
            <Card><EmptyState icon={Gavel} title="Nada nesse filtro" /></Card>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="show"
              className="space-y-3">
              {records.map((r, i) => (
                <motion.div key={`${r.decision_id}-${r.action}-${i}`} variants={staggerItem}>
                  <DecisionCard r={r} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}
    </>
  );
}

function CountChip({ label, variant, active, onClick }: {
  label: string; variant?: BadgeVariant; active: boolean; onClick: () => void;
}) {
  const dot = variant === "ok" ? "bg-ok" : variant === "danger" ? "bg-danger"
    : variant === "info" ? "bg-blue" : variant === "warn" ? "bg-warn" : "bg-muted-foreground/40";
  return (
    <button onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}>
      {variant && <span className={cn("size-1.5 rounded-full", dot)} />}
      {label}
    </button>
  );
}

function DecisionCard({ r }: { r: DecisionAuditRecord }) {
  const [open, setOpen] = useState(false);
  const when = fmtRelative(r.created_at);
  const conf = r.confidence;
  const confPct = conf == null ? null : Math.round(Math.max(0, Math.min(1, conf)) * 100);
  const confTone = conf == null ? "bg-border"
    : conf >= 0.66 ? "bg-ok" : conf >= 0.33 ? "bg-warn" : "bg-danger";
  const verdicts = Object.entries(r.judge_verdicts ?? {});
  const evidence = r.evidence ?? [];

  return (
    <Card>
      <CardContent className="pt-4">
        {/* topo — O QUE PEDIRAM (id + tipo) · O QUE ACONTECEU (action) · QUANDO */}
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground/70">{r.decision_id}</span>
              {r.decision_type && (
                <Badge variant="outline">{TYPE_LABEL[r.decision_type] ?? r.decision_type}</Badge>
              )}
            </div>
          </div>
          {r.action && (
            <Badge variant={ACTION_BADGE[r.action] ?? "outline"} className="shrink-0">
              {ACTION_LABEL[r.action] ?? r.action}
            </Badge>
          )}
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground/50"
            title={when.abs}>
            <Clock className="size-3" /> {when.rel}
          </span>
        </div>

        {/* linha 2 — COMO RESOLVEU (classification) · QUEM (decided_by) · CONFIANÇA · selo */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          {r.classification && (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <Scale className="size-3.5 text-muted-foreground/60" />
              <Badge variant={CLASS_BADGE[r.classification] ?? "outline"}>{r.classification}</Badge>
            </span>
          )}
          {r.decided_by && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70"
              title="quem decidiu — o RAIL: nunca um humano">
              <Bot className="size-3.5" /> <code>{r.decided_by}</code>
            </span>
          )}
          {confPct != null && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70"
              title={`confiança objetiva ${conf}`}>
              conf
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                <span className={cn("block h-full rounded-full", confTone)} style={{ width: `${confPct}%` }} />
              </span>
              <span className="tabular-nums font-mono">{confPct}%</span>
            </span>
          )}
          <Badge variant={r.dry_run ? "outline" : "ok"} className="ml-auto shrink-0">
            {r.dry_run ? "dry-run" : "aplicado"}
          </Badge>
        </div>

        {/* juízes — O QUE USOU (chips PASS/WARN/FAIL) + o gate quando escalado */}
        {(verdicts.length > 0 || r.gate) && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {verdicts.map(([name, v]) => (
              <span key={name} title={`${name}: ${v}`}
                className="inline-flex items-center gap-1 rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", VERDICT_DOT[String(v)] ?? "bg-border")} />
                {name} <span className="font-mono opacity-70">{v}</span>
              </span>
            ))}
            {r.gate?.verdict && (
              <span title={`gate: ${r.gate.status ?? ""} → ${r.gate.verdict} (${r.gate.confidence ?? "?"})${r.gate.applied ? ` · aplicou ${r.gate.applied}` : ""}`}
                className="inline-flex items-center gap-1 rounded border border-blue/30 bg-blue/[0.06] px-1.5 py-0.5 text-[10px] text-blue">
                <span className={cn("size-1.5 rounded-full", VERDICT_DOT[String(r.gate.verdict)] ?? "bg-blue")} />
                gate <span className="font-mono opacity-80">{r.gate.verdict}</span>
              </span>
            )}
          </div>
        )}

        {/* evidência — a razão legível (ex. "falta CORE: vaso"), expandível */}
        {evidence.length > 0 && (
          <div className="mt-3 border-t border-border/60 pt-2.5">
            <button onClick={() => setOpen((o) => !o)}
              className="flex w-full items-center gap-1.5 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground">
              {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              evidência
              <span className="font-normal text-muted-foreground/50">({evidence.length})</span>
              {!open && evidence[0] && (
                <span className="ml-1 truncate font-normal text-muted-foreground/60">— {evidence[0]}</span>
              )}
            </button>
            {open && (
              <ul className="mt-2 space-y-1">
                {evidence.map((e, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground/80">
                    <span className="mt-1 size-1 shrink-0 rounded-full bg-muted-foreground/40" />
                    <span className="min-w-0 break-words">{e}</span>
                  </li>
                ))}
                {r.corpus_version && (
                  <li className="pt-1 text-[10px] text-muted-foreground/40">
                    corpus <code>{r.corpus_version}</code>
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
