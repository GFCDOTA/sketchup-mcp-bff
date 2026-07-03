import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Boxes, Network, Cpu, Terminal, Bot, AppWindow, Hand, Radio,
  ArrowRightLeft, FileDown, Eye, Play, AlertTriangle, HelpCircle, Info, type LucideIcon,
} from "lucide-react";
import type { FileActivityEvent, FileSource, FileOp } from "@/api/types";
import { cn, timeAgo } from "@/lib/utils";

/* origem do evento → ícone + cor (token). */
const SOURCE: Record<FileSource, { icon: LucideIcon; tone: string }> = {
  bff: { icon: Boxes, tone: "text-primary" },
  upstream: { icon: Network, tone: "text-blue" },
  ollama: { icon: Cpu, tone: "text-purple" },
  runner: { icon: Terminal, tone: "text-warn" },
  agent: { icon: Bot, tone: "text-ok" },
  frontend: { icon: AppWindow, tone: "text-muted-foreground" },
  manual: { icon: Hand, tone: "text-foreground" },
  watcher: { icon: Eye, tone: "text-muted-foreground" },
};

/* operação → ícone pequeno de "verbo". */
const OP: Partial<Record<FileOp, LucideIcon>> = {
  proxy: ArrowRightLeft, serve: FileDown, execute: Play, read: Eye, error: AlertTriangle,
};

function dot(ev: FileActivityEvent) {
  if (ev.status === "error" || ev.op === "error") return "bg-danger";
  if (ev.status === "warn") return "bg-warn";
  if (ev.source === "runner") return "bg-warn";
  if (ev.source === "ollama") return "bg-purple";
  if (ev.source === "upstream") return "bg-blue";
  return "bg-ok";
}

export function LiveActivity({
  events,
  live,
  className,
  onSelect,
}: {
  events: FileActivityEvent[];
  live: boolean;
  className?: string;
  /** clique numa linha — ex.: levar pra doc do que é aquele evento. */
  onSelect?: (ev: FileActivityEvent) => void;
}) {
  const reduce = useReducedMotion();
  const ordered = [...events].reverse(); // mais novo no topo

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-ok/12 text-ok">
            <Radio className="size-4" />
          </span>
          <div>
            <div className="text-sm font-semibold leading-none">Acontecendo agora</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground/60">
              atividade interna do cockpit em tempo real
            </div>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            live ? "border-ok/25 bg-ok/12 text-ok" : "border-border bg-secondary text-muted-foreground",
          )}
        >
          <span className={cn("size-1.5 rounded-full", live ? "bg-ok animate-pulse-dot" : "bg-muted-foreground/50")} />
          {live ? "ao vivo" : "conectando…"}
        </span>
      </div>

      {/* o que é isto? — desfaz a confusão "cadê o SketchUp" */}
      <Link
        to="/flow#arquitetura"
        className="mb-3 flex items-start gap-2 rounded-lg border border-border border-l-[3px] border-l-blue/50 bg-background/50 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground transition-colors hover:border-l-blue hover:text-foreground"
      >
        <Info className="mt-0.5 size-3.5 shrink-0 text-blue" />
        <span>
          Não é a geração do SketchUp — é o <b className="text-foreground/80">próprio cockpit se mantendo vivo</b>:
          a tela busca status/agentes/runs a cada poucos segundos e o BFF lê os arquivos do motor e fala com o Ollama.
          Cada linha é uma chamada e <b className="text-foreground/80">quem a fez</b>. <span className="text-blue">o que é isto? →</span>
        </span>
      </Link>

      <div className="relative max-h-[360px] flex-1 overflow-y-auto rounded-lg border border-border bg-popover/60">
        {ordered.length === 0 ? (
          <div className="grid h-28 place-items-center text-xs text-muted-foreground/50">
            aguardando atividade…
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.03]">
            <AnimatePresence initial={false}>
              {ordered.map((ev) => {
                const s = SOURCE[ev.source] ?? SOURCE.bff;
                const Verb = OP[ev.op];
                const isErr = ev.status === "error" || ev.op === "error";
                return (
                  <motion.li
                    key={ev.id}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, y: -8, backgroundColor: "rgba(201,168,106,0.10)" }}
                    animate={{ opacity: 1, y: 0, backgroundColor: "rgba(0,0,0,0)" }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  >
                    <button
                      type="button"
                      onClick={onSelect ? () => onSelect(ev) : undefined}
                      disabled={!onSelect}
                      title={onSelect ? "o que é isto? abrir na documentação" : undefined}
                      className={cn(
                        "group/row flex w-full items-center gap-3 px-3 py-2 text-left",
                        isErr && "bg-danger/[0.05]",
                        onSelect && "transition-colors hover:bg-white/[0.04]",
                      )}
                    >
                      <span className={cn("grid size-7 shrink-0 place-items-center rounded-md border border-border bg-card", s.tone)}>
                        <s.icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {Verb && <Verb className={cn("size-3 shrink-0", isErr ? "text-danger" : "text-muted-foreground/50")} />}
                          <span className={cn("truncate text-[13px]", isErr ? "text-danger" : "text-foreground/90")}>
                            {ev.label ?? `${ev.op} ${ev.path}`}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground/45">
                          {ev.endpoint ?? ev.path}
                          {ev.runId && <span className="text-warn/70"> · {ev.runId}</span>}
                        </div>
                      </div>
                      {onSelect && <HelpCircle className="size-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover/row:text-primary/70" />}
                      <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground/40">{timeAgo(ev.ts)}</span>
                      <span className={cn("size-1.5 shrink-0 rounded-full", dot(ev))} />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
