import { motion } from "framer-motion";
import { FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { staggerContainer, staggerItem } from "./animated-section";
import type { SkillDoc, SkillTrack, SpecDoc } from "@/data/flow";

const TRACK: Record<SkillTrack, { label: string; dot: string; ring: string }> = {
  pipeline: { label: "Pipeline", dot: "bg-blue", ring: "border-l-blue" },
  gates: { label: "Gates & Visual", dot: "bg-ok", ring: "border-l-ok" },
  interiores: { label: "Interiores & Móveis", dot: "bg-primary", ring: "border-l-primary" },
  decisao: { label: "Decisão", dot: "bg-purple", ring: "border-l-purple" },
  ops: { label: "Repo & Ops", dot: "bg-orange", ring: "border-l-orange" },
};
const ORDER: SkillTrack[] = ["pipeline", "gates", "interiores", "decisao", "ops"];

export function SkillsGrid({ skills }: { skills: SkillDoc[] }) {
  return (
    <div className="space-y-5">
      {ORDER.map((track) => {
        const items = skills.filter((s) => s.track === track);
        if (!items.length) return null;
        const cfg = TRACK[track];
        return (
          <div key={track}>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              <span className={cn("size-2 rounded-full", cfg.dot)} /> {cfg.label}
              <span className="text-muted-foreground/40">· {items.length}</span>
            </div>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            >
              {items.map((s) => (
                <motion.div
                  key={s.name}
                  variants={staggerItem}
                  className={cn("rounded-md border border-border border-l-[3px] bg-card p-3 transition-colors hover:border-border/70", cfg.ring)}
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="size-3 shrink-0 text-muted-foreground/40" />
                    <code className="truncate font-mono text-xs font-semibold text-foreground">{s.name}</code>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{s.summary}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

export function SpecsList({ specs }: { specs: SpecDoc[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {specs.map((s) => (
        <div key={s.file} className="flex items-start gap-2.5 rounded-md border border-border bg-card p-3">
          <FileText className="mt-0.5 size-4 shrink-0 text-primary/70" />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium">{s.title}</span>
              <code className="truncate font-mono text-[10.5px] text-muted-foreground/40">{s.file}</code>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.summary}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
