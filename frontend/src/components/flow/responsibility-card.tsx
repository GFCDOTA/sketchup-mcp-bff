import { cn } from "@/lib/utils";
import type { ResponsibilityCard as RC } from "@/data/flow";

const DOT: Record<RC["tone"], string> = {
  ok: "bg-ok", info: "bg-blue", gold: "bg-primary", purple: "bg-purple", warn: "bg-warn",
};

export function ResponsibilityCard({ card }: { card: RC }) {
  return (
    <div className="h-full rounded-lg border border-border bg-card p-5 transition-colors hover:border-border/70">
      <div className="mb-2 flex items-center gap-2.5">
        <span className={cn("size-3 rounded-full", DOT[card.tone])} />
        <h3 className="text-sm font-semibold">{card.title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{card.body}</p>
    </div>
  );
}
