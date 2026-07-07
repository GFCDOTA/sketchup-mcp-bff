import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { FlowStep } from "@/data/flow";

/** rótulos curtos dos nós da timeline (por id real das etapas mapeadas). */
const NODE: Record<string, string> = {
  entrada: "PDF · Consensus",
  interpretacao: "Interpretação",
  geracao: "Geometria · .skp",
  "04": "Gates",
  "05": "Render · Visual",
  "06": "Oracle",
  "07": "Aprovado",
};

export function FlowTimeline({
  steps,
  activeId,
  onSelect,
}: {
  steps: FlowStep[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const activeIdx = steps.findIndex((s) => s.id === activeId);
  return (
    <div className="overflow-x-auto pb-2 scrollbar-thin">
      <div className="flex min-w-max items-start gap-1 px-1">
        {steps.map((s, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <div key={s.id} className="flex items-start">
              <button
                onClick={() => onSelect(s.id)}
                className="group flex w-[112px] flex-col items-center gap-2 text-center"
                aria-current={active}
              >
                <span className="relative">
                  {active && (
                    <motion.span
                      layoutId="tl-active-ring"
                      className="absolute -inset-1.5 rounded-full ring-2 ring-primary"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-full border-2 text-xs font-bold transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : done
                          ? "border-ok/60 bg-ok/15 text-ok"
                          : "border-border bg-card text-muted-foreground group-hover:border-border/80",
                    )}
                  >
                    {i + 1}
                  </span>
                </span>
                <span
                  className={cn(
                    "text-[11px] font-medium leading-tight",
                    active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {NODE[s.id] ?? s.title}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span className={cn("mt-[18px] h-0.5 w-7 rounded-full", i < activeIdx ? "bg-ok/50" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
