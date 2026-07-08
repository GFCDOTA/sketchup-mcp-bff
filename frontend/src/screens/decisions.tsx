// decisions.tsx — DECISÕES (aba única, layout compacto).
// Ordem pensada pra caber na tela e ser escaneável (feedback Felipe 2026-07-07):
//   1. Acionamentos do carteiro — o botão "Rodar agora" LÁ NO TOPO (é o que se aciona).
//   2. Aguardando você          — UM card só; cada decisão é uma LINHA que EXPANDE no clique
//                                 (Aprovar/Rejeitar aparecem ao abrir) → não come a tela.
//   3. De onde vêm as decisões  — explicador COLAPSÁVEL (fechado por padrão).
//   4. Histórico do carteiro     — cada decisão OBJETIVA drenada (vidro do audit).
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Inbox, CheckCircle2, Boxes,
  Gavel, ServerCog, ShieldCheck, ChevronDown, ChevronRight, Bot, Scale, Clock,
  Zap, Play, Loader2, AlertTriangle, Hand, type LucideIcon,
} from "lucide-react";
import {
  useDecisions, useRespondDecision,
  useDecisionHistory, useCarteiroRuns, useRunCarteiro,
} from "@/api/hooks";
import type {
  Decision,
  DecisionAction, DecisionAuditRecord, DecisionClassification, DecisionType,
  CarteiroRunRecord,
} from "@/api/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
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
/* rótulo do TIPO na fila "Aguardando você" — honesto por tipo (gap ≠ programa). */
const PENDING_TYPE_LABEL: Record<string, string> = {
  furniture_program: "programa", consistency_gap: "gap",
  visual_review: "veredito visual", program_proposal: "programa",
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

/** chevron reutilizado nas linhas colapsáveis */
function Caret({ open, className }: { open: boolean; className?: string }) {
  return open
    ? <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground/50", className)} />
    : <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground/50", className)} />;
}

export default function Decisions() {
  return (
    <>
      <PageHeader
        title="Decisões"
        subtitle="Aciona o juiz automático, resolve o que aguarda você, e vê de onde vêm as decisões — tudo numa aba."
      />

      {/* 1 · ACIONAMENTOS — o botão no TOPO */}
      <CarteiroRunsCard />

      {/* 2 · AGUARDANDO VOCÊ — um card só, linhas que expandem no clique */}
      <PendingSection />

      {/* 3 · DE ONDE VÊM — explicador colapsável (fechado por padrão) */}
      <SourceOfDecisions />

      {/* 4 · HISTÓRICO do carteiro — vidro do audit */}
      <CarteiroHistory />
    </>
  );
}

/* ═══════════════ 1 · ACIONAMENTOS do carteiro (gatilho + vidro dos runs) ═══════════════ */
function CarteiroRunsCard() {
  const { data } = useCarteiroRuns(20);
  const run = useRunCarteiro();
  const [flash, setFlash] = useState<string | null>(null);
  const [showRuns, setShowRuns] = useState(false);

  const trigger = () =>
    run.mutate("manual", {
      onSuccess: (res) => {
        setFlash(res.ok ? "acionado — roda em até 60s" : (res.error ?? "não foi possível acionar"));
        window.setTimeout(() => setFlash(null), 6000);
      },
    });

  const runs = data?.runs ?? [];
  const last = data?.last_run ? fmtRelative(data.last_run) : null;

  return (
    <Card className="mb-4" accent="gold">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-4 text-primary" /> Acionamentos do juiz automático
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {last ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" /> último acionamento{" "}
                <strong className="font-medium text-foreground" title={last.abs}>{last.rel}</strong>
              </span>
            ) : (
              "o juiz ainda não registrou um acionamento por aqui"
            )}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={trigger} disabled={run.isPending}
          className="shrink-0">
          {run.isPending
            ? <><Loader2 className="size-3.5 animate-spin" /> acionando…</>
            : <><Play className="size-3.5" /> Rodar o juiz agora</>}
        </Button>
      </CardHeader>

      {/* feedback do clique + a lista de drains, ambos discretos (não empurram a página) */}
      {(flash || (run.isError && !flash) || runs.length > 0) && (
        <CardContent className="pt-0">
          {flash && (
            <div className={cn("flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs",
              run.data?.ok !== false && !run.isError
                ? "border-ok/30 bg-ok/10 text-ok" : "border-danger/30 bg-danger/10 text-danger")}>
              {run.data?.ok !== false && !run.isError
                ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
              {flash}
            </div>
          )}
          {run.isError && !flash && (
            <div className="flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-xs text-danger">
              <AlertTriangle className="size-3.5" /> {run.error?.message ?? "não foi possível acionar"}
            </div>
          )}

          {runs.length > 0 && (
            <div className={cn(flash || run.isError ? "mt-2.5" : "")}>
              <button onClick={() => setShowRuns((o) => !o)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/70 hover:text-foreground">
                <Caret open={showRuns} className="size-3.5" />
                últimos acionamentos <span className="text-muted-foreground/40">({runs.length})</span>
              </button>
              {showRuns && (
                <ul className="mt-2 space-y-1.5">
                  {runs.slice(0, 8).map((r, i) => <CarteiroRunRow key={`${r.t}-${i}`} r={r} />)}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function CarteiroRunRow({ r }: { r: CarteiroRunRecord }) {
  const when = fmtRelative(r.t);
  const manual = r.trigger === "manual";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/50 px-2.5 py-1.5 text-xs">
      <span className="inline-flex items-center gap-1 text-muted-foreground/60" title={when.abs}>
        <Clock className="size-3" /> {when.rel}
      </span>
      <Badge variant="outline" className="inline-flex items-center gap-1">
        {manual ? <Hand className="size-3" /> : <Zap className="size-3" />}
        {manual ? "manual" : "auto"}
      </Badge>
      <span className="font-medium text-foreground">{r.decided} decidida{r.decided === 1 ? "" : "s"}</span>
      <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground/70">
        {r.auto_approve > 0 && <span className="text-ok">+{r.auto_approve}</span>}
        {r.auto_reject > 0 && <span className="text-danger">−{r.auto_reject}</span>}
        {r.escalated > 0 && <span className="text-blue">↑{r.escalated} gate</span>}
        {r.left_pending > 0 && <span className="text-warn">{r.left_pending} p/ humano</span>}
      </span>
      {r.dry_run && <Badge variant="outline" className="ml-auto shrink-0">dry-run</Badge>}
    </li>
  );
}

/* ═══════════════ 2 · AGUARDANDO VOCÊ (um card, acordeão de linhas) ═══════════════ */
function PendingSection() {
  const { data, isLoading, isError, error } = useDecisions();
  const respond = useRespondDecision();
  const [openId, setOpenId] = useState<string | null>(null);

  const pending = (data?.decisions ?? []).filter((d) => d.status === "pending");
  const answered = (data?.decisions ?? []).filter((d) => d.status !== "pending");
  const empty = pending.length === 0 && answered.length === 0;

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <Inbox className="size-4 text-warn" /> Aguardando você
            {pending.length > 0 && <Badge variant="warn" className="tabular-nums">{pending.length}</Badge>}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            gates que só você decide — clique numa linha pra abrir e responder
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isError ? (
          <ErrorState message={error?.message} />
        ) : isLoading ? (
          <SkeletonText lines={3} />
        ) : empty ? (
          <EmptyState icon={CheckCircle2} title="Tudo em dia" sub="Nenhuma decisão aguardando você." />
        ) : (
          <>
            {pending.length > 0 && (
              <div className="divide-y divide-border/50">
                {pending.map((d) => (
                  <PendingRow
                    key={d.id}
                    d={d}
                    open={openId === d.id}
                    onToggle={() => setOpenId((cur) => (cur === d.id ? null : d.id))}
                    onRespond={(choice) => respond.mutate({ id: d.id, choice })}
                    busy={respond.isPending && respond.variables?.id === d.id}
                  />
                ))}
              </div>
            )}
            {answered.length > 0 && <AnsweredList items={answered} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PendingRow({ d, open, onToggle, onRespond, busy }: {
  d: Decision; open: boolean; onToggle: () => void;
  onRespond: (c: string) => void; busy: boolean;
}) {
  return (
    <div>
      <button onClick={onToggle}
        className="flex w-full items-center gap-2.5 py-2.5 text-left transition-colors hover:bg-secondary/30">
        <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-secondary text-warn">
          <Inbox className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{d.title}</span>
          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground/60">
            <Badge variant="outline" className="normal-case">{PENDING_TYPE_LABEL[d.type] ?? d.type}</Badge>
            <span className="truncate">{d.source}</span>
          </span>
        </span>
        <StatusPill status="pending" />
        <Caret open={open} />
      </button>
      {open && (
        <div className="pb-3 pl-[38px] pr-1">
          <p className="text-sm text-foreground/90">{d.question}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {(d.options ?? ["Aprovar", "Rejeitar"]).map((opt, i) => (
              <Button key={opt} size="sm" variant={i === 0 ? "primary" : "secondary"}
                disabled={busy} onClick={() => onRespond(opt)}>
                {opt}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnsweredList({ items }: { items: Decision[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 border-t border-border/60 pt-2">
      <button onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 hover:text-muted-foreground">
        <Caret open={open} className="size-3.5" />
        Respondidas <span className="font-normal normal-case tracking-normal">({items.length})</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1">
          {items.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 rounded-md px-1 py-1.5 text-xs opacity-70">
              <div className="min-w-0">
                <div className="truncate font-medium">{d.title}</div>
                <div className="truncate text-[11px] text-muted-foreground/60">{d.source}</div>
              </div>
              <StatusPill status={d.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ 3 · DE ONDE VÊM as decisões (colapsável, fechado) ═══════════════ */
function SourceOfDecisions() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="mb-4">
      <button onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-secondary/20">
        <Boxes className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold">De onde vêm as decisões</span>
        <span className="hidden truncate text-xs text-muted-foreground/50 sm:inline">
          — o que alimenta a fila · por que fica “0 decididas”
        </span>
        <Caret open={open} className="ml-auto" />
      </button>
      {open && (
        <CardContent className="space-y-2.5 pt-0">
          <p className="text-xs text-muted-foreground">
            A fila é <code>.ai_bridge/proposals/pending/</code>. Dois trabalhadores locais a enchem;
            o juiz drena a cada sweep (~15&nbsp;min) ou no botão acima. Fila vazia = nada a decidir.
          </p>
          <SourceRow
            icon={Boxes} tone="text-ok" who="Arquiteto" makes="programa de móveis"
            note="por cômodo (via Ollama). É o que o juiz AUTO-decide: 100% limpo → aprova; falha dura → rejeita." />
          <SourceRow
            icon={ShieldCheck} tone="text-warn" who="Estagiários / Auditor" makes="gap de consistência"
            note="ex. falta item CORE, nome vazado de outro cômodo, redundância. Sempre borderline → precisa do gate (:8765) ou de você." />
          <p className="rounded-md border border-border/50 bg-secondary/30 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground/80">
            <span className="font-medium text-foreground/80">Por que fica “0 decididas”:</span> um gap
            borderline, no drain automático, cai em <em>deixado p/ humano</em> — o gate é lento e fica de
            fora do tick, então ele não vira decisão AUTO. Decisão AUTO nova entra quando o{" "}
            <span className="font-medium text-foreground/80">Arquiteto propõe um programa limpo</span>{" "}
            (auto-decidível). Esse gatilho ainda não está exposto no cockpit — é o próximo passo.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function SourceRow({ icon: Icon, tone, who, makes, note }: {
  icon: LucideIcon; tone: string; who: string; makes: string; note: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-border bg-secondary", tone)}>
        <Icon className="size-3.5" />
      </span>
      <p className="text-xs leading-snug text-muted-foreground">
        <span className="font-semibold text-foreground">{who}</span>
        {" → propõe "}
        <span className="font-medium text-foreground/80">{makes}</span>
        {". "}
        <span className="text-muted-foreground/80">{note}</span>
      </p>
    </div>
  );
}

/* ═══════════════ 4 · HISTÓRICO do carteiro (vidro do audit) ═══════════════ */
function CarteiroHistory() {
  const { data, isLoading, isError, error } = useDecisionHistory(100);
  const [actionFilter, setActionFilter] = useState<"ALL" | DecisionAction>("ALL");

  const records = (data?.records ?? []).filter(
    (r) => actionFilter === "ALL" || r.action === actionFilter,
  );

  return (
    <section>
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Gavel className="size-4 text-muted-foreground" /> Histórico do juiz automático
      </div>
      <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground/70">
        <span className="inline-flex items-center gap-1 text-blue">
          <ServerCog className="size-3.5" /> vidro read-only
        </span>
        <span>— o juiz decide no motor; aqui é só o <code>auto_decider_audit.jsonl</code>. objetivo ≠ gosto.</span>
      </p>

      {isError ? (
        <ErrorState message={error?.message} />
      ) : isLoading ? (
        <Card className="p-4"><SkeletonText lines={5} /></Card>
      ) : !data?.live ? (
        <Card><EmptyState icon={Gavel} title="Sem histórico do juiz"
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
                  <AuditCard r={r} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}
    </section>
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

function AuditCard({ r }: { r: DecisionAuditRecord }) {
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
