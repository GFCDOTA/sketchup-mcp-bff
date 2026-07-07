import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";
import type { EndpointDoc } from "@/data/flow";

const METHOD: Record<string, string> = {
  GET: "text-ok bg-ok/12 border-ok/25",
  POST: "text-blue bg-blue/12 border-blue/25",
  SSE: "text-purple bg-purple/12 border-purple/30",
};

export function ApiEndpointCard({ ep }: { ep: EndpointDoc }) {
  const m = ep.method.toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5">
      <span className={cn("w-12 shrink-0 rounded border px-1.5 py-0.5 text-center font-mono text-[10px] font-bold", METHOD[m] ?? "text-muted-foreground bg-secondary border-border")}>
        {m}
      </span>
      <div className="min-w-0 flex-1">
        <code className="block truncate font-mono text-xs text-foreground">{ep.path}</code>
        <div className="truncate text-[11px] text-muted-foreground/70">{ep.summary}</div>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground/40">fonte</div>
        <div className="text-[11px] text-muted-foreground">{ep.dataSource}</div>
      </div>
      <StatusBadge status={ep.status} className="shrink-0" />
    </div>
  );
}
