import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowDown, BookOpen, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStatus } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Chip({ on, label }: { on?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
      <span className={cn("size-1.5 rounded-full", on ? "bg-ok shadow-[0_0_6px] shadow-ok" : "bg-muted-foreground/40")} />
      {label}
    </span>
  );
}

export function FlowHero({ onSeeFlow }: { onSeeFlow: () => void }) {
  const { data } = useStatus();
  const qc = useQueryClient();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-card via-card to-background p-7 sm:p-10"
    >
      <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 size-72 rounded-full bg-blue/10 blur-3xl" />

      <div className="relative">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-ok/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-ok">Local-first</span>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">AI Cockpit</span>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">Documentação viva</span>
        </div>

        <h1 className="max-w-3xl text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-[2.6rem]">
          Da planta <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">PDF</span> ao{" "}
          <span className="bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">.skp</span> validado, renderizado e aprovado
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Como o Interior Studio funciona de ponta a ponta — quais agentes, APIs, gates, artifacts e decisões
          participam do processo, do consensus ao render revisado. Gerado do código real dos dois repositórios.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Chip on={data?.upstream.ok} label={`motor (arquivo) ${data?.upstream.ok ? "ok" : "off"}`} />
          <Chip on={data?.ollama.ok} label={`ollama :11434 ${data?.ollama.ok ? `${data.ollama.models} modelos` : "off"}`} />
          <Chip on label="cockpit :8782" />
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <Button variant="primary" onClick={onSeeFlow}>
            <ArrowDown className="size-4" /> Ver o fluxo
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/docs"><BookOpen className="size-4" /> Abrir docs</Link>
          </Button>
          <Button variant="ghost" onClick={() => qc.invalidateQueries()}>
            <RefreshCw className="size-4" /> Diagnóstico
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
