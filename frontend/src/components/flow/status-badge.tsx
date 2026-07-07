import { cn } from "@/lib/utils";

export type FlowStatus = "implemented" | "mock" | "planned";

const CFG: Record<FlowStatus, { label: string; cls: string; dot: string }> = {
  implemented: { label: "implementado", cls: "bg-ok/12 text-ok border-ok/25", dot: "bg-ok" },
  mock: { label: "mock", cls: "bg-warn/12 text-warn border-warn/25", dot: "bg-warn" },
  planned: { label: "planejado", cls: "bg-purple/12 text-purple border-purple/30", dot: "bg-purple" },
};

export function StatusBadge({ status, className }: { status: FlowStatus; className?: string }) {
  const c = CFG[status] ?? CFG.planned;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
        c.cls,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}
