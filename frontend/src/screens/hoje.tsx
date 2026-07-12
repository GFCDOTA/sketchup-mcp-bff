// hoje.tsx — a HOME: central de trabalho orientada a exceções (design GPT 2026-07-12).
// Régua dos 5 segundos: (1) o sistema está funcionando? → banner; (2) o que está
// fazendo? → missões (unidade = missão, não evento/agente); (3) o que precisa de
// MIM? → inbox lateral. Todo item diz QUEM AGE AGORA (etiqueta). Zero jargão.
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CircleCheck, TriangleAlert, PauseCircle, Inbox as InboxIcon, ChevronRight, Sparkles,
} from "lucide-react";
import { useHoje } from "@/api/hooks";
import type { HojeInboxItem, HojeMission } from "@/api/types";
import { PageHeader } from "@/components/page-header";
import { PresenceStrip } from "@/components/presence-strip";
import { Card, CardContent, CardEyebrow, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/states";
import { SkeletonText } from "@/components/ui/skeleton";
import { staggerContainer, staggerItem } from "@/components/flow/animated-section";
import { ETIQUETA_META, hhmm, humanStatus, relTime } from "@/lib/humanize";
import { cn } from "@/lib/utils";

/* ── bloco 1: o banner dos 5 segundos ──────────────────────────────────────── */
function Banner({ data }: { data: NonNullable<ReturnType<typeof useHoje>["data"]> }) {
  const a = data.autonomy;
  const esperando = a.n_esperando_voce;

  if (a.estado_banner === "BLOQUEIOS") {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/[0.07] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-danger">
          <TriangleAlert className="size-4" />
          {a.n_bloqueios} bloqueio(s) — o sistema não conseguiu avançar nesses pontos
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            última atividade {relTime(a.ultima_atividade)}
          </span>
        </div>
        <ul className="mt-2 space-y-1">
          {a.bloqueios.map((b) => (
            <li key={b.task_id ?? b.titulo} className="flex items-baseline gap-2 text-xs">
              <span className="inline-block size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-danger" />
              <span className="min-w-0 flex-1 truncate" title={b.titulo}>{b.titulo}</span>
              <span className="shrink-0 text-muted-foreground/70">{humanStatus(b.status)}</span>
              <span className="shrink-0 font-mono text-muted-foreground/50">{hhmm(b.quando)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const meta = a.estado_banner === "NORMAL"
    ? { icon: CircleCheck, cls: "border-ok/30 bg-ok/[0.06] text-ok",
        txt: "Sistema normal — trabalhando sozinho" }
    : a.estado_banner === "QUIETO"
      ? { icon: PauseCircle, cls: "border-warn/30 bg-warn/[0.06] text-warn",
          txt: "Sistema quieto — sem atividade recente" }
      : { icon: PauseCircle, cls: "border-border bg-secondary/30 text-muted-foreground",
          txt: "Sistema parado — o atuador não está rodando" };
  const Icon = meta.icon;
  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium", meta.cls)}>
      <Icon className="size-4" />
      {meta.txt}
      <span className="text-xs font-normal text-muted-foreground">
        · última atividade {relTime(a.ultima_atividade)}
        {a.proximo_ciclo_s != null && ` · próximo ciclo em ~${Math.max(1, Math.round(a.proximo_ciclo_s / 60))}min`}
      </span>
      {esperando > 0 && (
        <Link to="/curation"
          className="ml-auto rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/25">
          {esperando} decisão(ões) esperando você →
        </Link>
      )}
    </div>
  );
}

/* ── etiqueta "quem age agora" ─────────────────────────────────────────────── */
function Etiqueta({ e }: { e: HojeMission["etiqueta"] }) {
  const m = ETIQUETA_META[e];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide", m.cls)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

/* ── bloco 2: missões em andamento ─────────────────────────────────────────── */
function MissionCard({ m }: { m: HojeMission }) {
  const to = m.tema ? "/curation" : "/noc";
  return (
    <motion.div variants={staggerItem}>
      <Link to={to} className="block">
        <Card className="transition-colors hover:border-primary/40">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{m.titulo}</span>
              <Etiqueta e={m.etiqueta} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {m.n_variantes != null && <span>{m.n_variantes} variante(s)</span>}
              {m.melhor_nota != null && (
                <span>melhor nota <span className={cn("font-bold",
                  m.melhor_nota >= 7 ? "text-ok" : m.melhor_nota >= 5 ? "text-warn" : "text-danger")}>
                  {m.melhor_nota}/10</span></span>
              )}
              {m.n_em_revisao > 0 && <span>{m.n_em_revisao} com o sistema</span>}
              {m.n_esperando_voce > 0 && (
                <span className="font-semibold text-primary">{m.n_esperando_voce} esperando você</span>
              )}
            </div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground/80">
              <ChevronRight className="size-3 text-primary" />
              próximo passo: {m.proxima_acao}
            </p>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

/* ── bloco 3: inbox "precisa de você" ──────────────────────────────────────── */
function InboxItem({ i }: { i: HojeInboxItem }) {
  return (
    <Link to={i.rota}
      className="block rounded-lg border border-border/60 bg-background/40 px-3 py-2 transition-colors hover:border-primary/50">
      <div className="flex items-center gap-2">
        <span className={cn("rounded-sm px-1.5 py-0.5 text-[9.5px] font-bold uppercase",
          i.tipo === "gosto" ? "bg-primary/15 text-primary" : "bg-blue/15 text-blue")}>
          {i.tipo === "gosto" ? "seu veredito" : "decisão"}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium" title={i.titulo}>{i.titulo}</span>
      </div>
      {i.detalhe && <p className="mt-1 truncate text-[11px] text-muted-foreground/70">{i.detalhe}</p>}
    </Link>
  );
}

export default function Hoje() {
  const { data, isLoading, isError, error } = useHoje();

  return (
    <>
      <PageHeader title="Hoje"
        subtitle="O sistema trabalha sozinho — aqui você vê o que ele fez, o que está fazendo e o que espera de você" />

      {isError ? (
        <ErrorState message={error?.message} />
      ) : isLoading || !data ? (
        <Card className="p-4"><SkeletonText lines={5} /></Card>
      ) : (
        <div className="space-y-4">
          <PresenceStrip />
          <Banner data={data} />

          <div className="grid grid-cols-12 gap-4">
            {/* missões — centro */}
            <div className="col-span-12 lg:col-span-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardEyebrow>trabalho em andamento</CardEyebrow>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="size-4 text-primary" /> Missões
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.missions.length === 0 ? (
                    <EmptyState icon={Sparkles} title="Nada em andamento"
                      sub="o próximo ciclo do sistema cria trabalho sozinho" />
                  ) : (
                    <motion.div variants={staggerContainer} initial="hidden" animate="show"
                      className="grid gap-3 sm:grid-cols-2">
                      {data.missions.map((m) => <MissionCard key={`${m.plant}-${m.tema}`} m={m} />)}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* inbox — lateral fixa */}
            <div className="col-span-12 lg:col-span-4">
              <Card accent="gold">
                <CardHeader className="pb-2">
                  <CardEyebrow>só o que exige humano</CardEyebrow>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <InboxIcon className="size-4 text-primary" /> Precisa de você
                    {data.inbox.length > 0 && (
                      <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 font-mono text-xs font-bold text-primary">
                        {data.inbox.length}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.inbox.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70">
                      Nada esperando você — o sistema segue sozinho. ✨
                    </p>
                  ) : (
                    data.inbox.map((i, idx) => <InboxItem key={`${i.tipo}-${i.id ?? i.tema ?? idx}`} i={i} />)
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
