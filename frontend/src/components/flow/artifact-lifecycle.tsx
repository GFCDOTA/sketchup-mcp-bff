import { Image as ImageIcon, FileText, FileJson, Box, FileCode2, type LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";
import type { ArtifactDoc } from "@/data/flow";

function iconFor(type: string): LucideIcon {
  const t = type.toLowerCase();
  if (t.includes("render") || t.includes("png") || t.includes("image")) return ImageIcon;
  if (t.includes("skp")) return Box;
  if (t.includes("json") || t.includes("report") || t.includes("consensus")) return FileJson;
  if (t.includes("log")) return FileCode2;
  return FileText;
}

export function ArtifactLifecycle({ artifact: a }: { artifact: ArtifactDoc }) {
  const Icon = iconFor(a.type);
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{a.type}</div>
        </div>
        <StatusBadge status={a.status} className="shrink-0" />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{a.description}</p>

      <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-[11px]">
        <Row label="path" value={a.examplePath} mono />
        <Row label="origem" value={a.origin} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {a.lifecycle.split(/\s*(?:→|->|>)\s*/).filter(Boolean).map((stage, i, arr) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="rounded bg-secondary px-2 py-0.5 text-[10.5px] text-muted-foreground">{stage}</span>
            {i < arr.length - 1 && <ArrowRight className="size-3 text-border" />}
          </span>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-12 shrink-0 text-muted-foreground/40">{label}</span>
      <span className={cn("break-all text-muted-foreground", mono && "font-mono")}>{value}</span>
    </div>
  );
}
