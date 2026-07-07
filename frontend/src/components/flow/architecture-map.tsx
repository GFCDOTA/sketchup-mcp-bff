import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";
import { staggerContainer, staggerItem } from "./animated-section";
import type { Layer } from "@/data/flow";

/** Mapa de camadas — pilha vertical (browser no topo → motor na base). */
export function ArchitectureMap({ layers }: { layers: Layer[] }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className="flex flex-col gap-2"
    >
      {layers.map((l, i) => (
        <motion.div key={l.name} variants={staggerItem}>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-border/70">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary font-mono text-xs text-muted-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{l.name}</span>
                <StatusBadge status={l.status} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{l.detail}</p>
            </div>
          </div>
          {i < layers.length - 1 && (
            <div className="flex justify-center py-0.5 text-border">
              <ChevronDown className="size-3.5" />
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}
