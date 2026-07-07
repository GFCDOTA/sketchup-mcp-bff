import { motion } from "framer-motion";
import {
  GitBranch, ServerCog, ShieldCheck, CircleDot, FileCheck2,
  Activity, Boxes, Cpu, FolderGit2, Radio, Heart,
} from "lucide-react";
import {
  useNocLedger, useNocStatus,
  useBridgeHealth, useGateLive, useBridgeSessions, useBridgeGit, useBridgeSkp,
} from "@/api/hooks";
import type { NocTask, NocLockState } from "@/api/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/states";
import { SkeletonText } from "@/components/ui/skeleton";
import { staggerContainer, staggerItem } from "@/components/flow/animated-section";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  COMMITTED: "text-ok border-ok/30 bg-ok/10",
  VERIFY_FAILED: "text-danger border-danger/30 bg-danger/10",
  VISUAL_REVIEW_QUEUED: "text-warn border-warn/30 bg-warn/10",
  NOOP: "text-muted-foreground border-border bg-secondary",
  DRY_RUN: "text-muted-foreground border-border bg-secondary",
};
const tone = (s: string) => STATUS_TONE[s] ?? "text-blue border-blue/30 bg-blue/10";

const LOCK_TONE: Record<string, string> = {
  held: "text-ok bg-ok/10 border-ok/30",
  stale: "text-warn bg-warn/10 border-warn/30",
  free: "text-muted-foreground bg-secondary border-border",
};

function LockBadge({ lock }: { lock?: NocLockState }) {
  if (!lock) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
      LOCK_TONE[lock.state] ?? LOCK_TONE.free)}>
      <CircleDot className="size-3" /> {lock.label}
    </span>
  );
}

export default function NocLedger() {
  const ledger = useNocLedger();
  const status = useNocStatus();
  const tasks = ledger.data?.tasks ?? [];

  return (
    <>
      <PageHeader title="NOC — Sistema & atuador"
        subtitle="Tudo numa página: saúde do projeto, gate do oráculo, sessões, git e .skp — lidos de ARQUIVO (:8765 nunca é tocado), + os runs reais do atuador." />

      <SistemaSection />

      {/* faixa de honestidade */}
      <Card className="mb-4 border-blue/20 bg-blue/[0.04]">
        <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium text-blue"><ServerCog className="size-4" /> Vidro read-only</span>
          <span>O atuador (worktree → <code>claude -p</code> → branch) roda no NOC, não aqui — o cockpit só LÊ os arquivos.</span>
          <span className="ml-auto inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-ok" /> nunca toca main · veredito visual = só você</span>
        </CardContent>
      </Card>

      {/* linha de status do atuador */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <LockBadge lock={status.data?.lock} />
        <Badge variant="outline">fila: {status.data?.queueCount ?? "—"}</Badge>
        <Badge variant="outline">tasks no ledger: {status.data?.taskCount ?? tasks.length}</Badge>
        {ledger.data?.live && (
          <span className="inline-flex items-center gap-1 text-xs text-ok">
            <span className="size-1.5 rounded-full bg-ok animate-pulse-dot" /> LIVE
          </span>
        )}
        {status.data?.nocRoot && (
          <code className="ml-auto truncate text-[10px] text-muted-foreground/40">{status.data.nocRoot}</code>
        )}
      </div>

      {ledger.isError ? (
        <ErrorState message={ledger.error?.message} />
      ) : ledger.isLoading ? (
        <Card className="p-4"><SkeletonText lines={4} /></Card>
      ) : !ledger.data?.live ? (
        <Card><EmptyState icon={GitBranch} title="Sem ledger do NOC"
          sub={ledger.data?.reason || "actions.jsonl ainda não existe — o atuador não rodou."} /></Card>
      ) : tasks.length === 0 ? (
        <Card><EmptyState icon={GitBranch} title="Fila vazia (live)" sub="Nenhum ciclo no ledger ainda." /></Card>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-3">
          {tasks.map((t) => (
            <motion.div key={t.taskId} variants={staggerItem}>
              <TaskCard t={t} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </>
  );
}

const HEALTH_TONE: Record<string, string> = {
  GREEN: "text-ok border-ok/30 bg-ok/10",
  YELLOW: "text-warn border-warn/30 bg-warn/10",
  RED: "text-danger border-danger/30 bg-danger/10",
};

function fmtAge(s: number): string {
  if (s < 90) return `${Math.round(s)}s atrás`;
  if (s < 5400) return `${Math.round(s / 60)}min atrás`;
  return `${Math.round(s / 3600)}h atrás`;
}

/** Sistema: saúde GYR + git + sessões + gate + .skp — tudo lido de ARQUIVO (o :8765 nunca é tocado).
 *  É o que absorve o dashboard.html do :8765 na página única. */
function SistemaSection() {
  const health = useBridgeHealth();
  const git = useBridgeGit();
  const sessions = useBridgeSessions();
  const skp = useBridgeSkp();
  const h = health.data;

  return (
    <div className="mb-5 space-y-3">
      <Card className={cn("border", h ? HEALTH_TONE[h.level] : "")}>
        <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-bold",
            h ? HEALTH_TONE[h.level] : "")}>
            <CircleDot className="size-3.5" /> {h?.level ?? "…"}
          </span>
          <span className="text-sm text-muted-foreground">
            {(h?.reasons ?? []).join(" · ") || "lendo a saúde do projeto…"}
          </span>
          {h && (
            <span className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground/70">
              <span>review pendente: {h.signals.visualReviewPending}</span>
              <span>repos sujos: {h.signals.dirtyRepos}</span>
              <span>sessões ativas: {h.signals.activeSessions ?? "—"}</span>
            </span>
          )}
        </CardContent>
      </Card>

      <GateLiveCard />

      <div className="grid gap-3 md:grid-cols-2">
        <Card><CardContent className="pt-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <FolderGit2 className="size-4 text-blue" /> Git — {git.data?.repos.length ?? 0} repos · {git.data?.worktrees ?? 0} worktrees
          </div>
          <div className="space-y-1.5">
            {(git.data?.repos ?? []).map((r) => (
              <div key={r.name} className="flex items-center gap-2 text-xs">
                <code className="truncate text-muted-foreground/80">{r.name}</code>
                <span className="inline-flex items-center gap-1 truncate text-muted-foreground/60">
                  <GitBranch className="size-3 shrink-0" />{r.branch}
                </span>
                {r.dirty > 0 && <Badge variant="outline" className="ml-auto shrink-0 border-warn/30 text-warn">{r.dirty} sujo</Badge>}
              </div>
            ))}
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Activity className="size-4 text-ok" /> Sessões Claude — {sessions.data?.active ?? 0} ativas / {sessions.data?.total ?? 0}
          </div>
          <div className="space-y-1.5">
            {(sessions.data?.sessions ?? []).filter((s) => s.state !== "STOPPED").slice(0, 8).map((s) => (
              <div key={s.id + s.project} className="flex items-center gap-2 text-xs">
                <span className={cn("size-1.5 shrink-0 rounded-full", s.state === "ACTIVE" ? "bg-ok animate-pulse-dot" : "bg-warn")} />
                <code className="truncate text-muted-foreground/70">{s.project}</code>
                <span className="ml-auto shrink-0 text-muted-foreground/50">{s.state === "ACTIVE" ? "agora" : `${Math.round(s.idleSec / 60)}min`}</span>
              </div>
            ))}
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Boxes className="size-4 text-blue" /> .skp por planta
          </div>
          <div className="space-y-1.5">
            {(skp.data?.plants ?? []).map((p) => (
              <div key={p.plant} className="flex items-center gap-2 text-xs">
                <code className="truncate text-muted-foreground/80">{p.plant}</code>
                <Badge variant="outline" className="shrink-0">{p.skpCount} .skp</Badge>
                <span className="ml-auto shrink-0 text-muted-foreground/50">{p.renders} renders</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      </div>
    </div>
  );
}

/** Gate AO VIVO — o mesmo padrão do "Acontecendo agora", mas lendo o audit.jsonl do :8765 por SSE.
 *  Conta os ACESSOS ao gate em tempo real (consults + heartbeats do oráculo). */
function GateLiveCard() {
  const { events, count, consults, live, ratePerMin } = useGateLive(24);
  const lastAgeS = events[0] ? Math.max(Date.now() / 1000 - events[0].ts, 0) : null;

  return (
    <Card className={cn("border", live ? "border-ok/30 bg-ok/[0.04]" : "border-border")}>
      <CardContent className="pt-4">
        <div className="mb-3 flex flex-wrap items-end gap-x-5 gap-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Radio className={cn("size-4", live ? "text-ok" : "text-muted-foreground/50")} />
            Gate ao vivo
            {live
              ? <span className="inline-flex items-center gap-1 text-xs font-normal text-ok">
                  <span className="size-1.5 rounded-full bg-ok animate-pulse-dot" /> streaming
                </span>
              : <span className="text-xs font-normal text-muted-foreground/50">conectando…</span>}
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="tabular-nums text-3xl font-bold leading-none text-ok">{count}</span>
            <span className="text-xs text-muted-foreground/70">acessos nesta sessão</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="tabular-nums text-lg font-semibold leading-none text-blue">{ratePerMin.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground/70">acessos/min</span>
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground/60">
            <Badge variant="outline">{consults} consults no total</Badge>
            {lastAgeS != null && <span>último: {fmtAge(lastAgeS)}</span>}
          </div>
        </div>

        <p className="mb-2 text-[11px] text-muted-foreground/50">
          tail do <code>audit.jsonl</code> · consult = metadado só (sem prompt = privacidade) · o :8765 nunca é tocado
        </p>

        {events.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground/40">
            aguardando acessos ao gate… (heartbeats do oráculo aparecem aqui em tempo real)
          </div>
        ) : (
          <div className="space-y-1">
            {events.map((e, i) => (
              <div key={`${e.ts}-${i}`}
                className="flex items-center gap-2 text-xs animate-in fade-in slide-in-from-top-1">
                {e.kind === "consult" ? (
                  <>
                    <Cpu className="size-3 shrink-0 text-blue" />
                    <code className="truncate text-muted-foreground/80">{e.model ?? "consult"}</code>
                    {e.tier && <Badge variant="outline" className="shrink-0">{e.tier}</Badge>}
                    <span className="ml-auto shrink-0 text-muted-foreground/60">
                      {e.durSec != null && `${e.durSec}s · `}{e.qChars ?? 0}→{e.aChars ?? 0}
                    </span>
                  </>
                ) : (
                  <>
                    <Heart className="size-3 shrink-0 text-ok/60" />
                    <span className="text-muted-foreground/60">heartbeat</span>
                    {e.session && <code className="truncate text-muted-foreground/40">{e.session}</code>}
                    {e.cycle != null && <span className="ml-auto shrink-0 text-muted-foreground/40">ciclo {e.cycle}</span>}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaskCard({ t }: { t: NocTask }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground/60">{t.taskId}</span>
              <span className="font-semibold">{t.title || "(sem título)"}</span>
            </div>
            {t.branch && (
              <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <GitBranch className="size-3.5" /> <code>{t.branch}</code>
                {t.dryRun && <Badge variant="outline" className="ml-1">dry-run</Badge>}
              </div>
            )}
          </div>
          <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold", tone(t.status))}>
            {t.status}
          </span>
        </div>

        {(t.verifyChecked.length > 0 || t.verifyMissing.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs">
            <span className="inline-flex items-center gap-1 text-ok"><FileCheck2 className="size-3.5" /> verify</span>
            {t.verifyChecked.map((f) => (
              <code key={f} className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground/80">{f}</code>
            ))}
            {t.verifyMissing.map((f) => (
              <code key={f} className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] text-danger">faltou: {f}</code>
            ))}
          </div>
        )}

        {t.outTail && <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground/40">{t.outTail}</p>}
      </CardContent>
    </Card>
  );
}
