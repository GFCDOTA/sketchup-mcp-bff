import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";
import type { LogLine, LogLevel } from "@/api/types";

const LEVEL: Record<LogLevel, string> = {
  debug: "text-muted-foreground/50",
  info: "text-blue",
  warn: "text-warn",
  error: "text-danger",
  success: "text-ok",
};

export function LogViewer({
  lines,
  live,
  className,
  emptyHint = "Sem logs.",
}: {
  lines: LogLine[];
  live?: boolean;
  className?: string;
  emptyHint?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div
      ref={ref}
      className={cn(
        "max-h-[460px] overflow-auto rounded-md border border-border bg-popover font-mono text-xs leading-relaxed",
        className,
      )}
    >
      {lines.length === 0 ? (
        <div className="p-4 text-muted-foreground/50">{emptyHint}</div>
      ) : (
        lines.map((l, i) => (
          <div
            key={i}
            className={cn(
              "grid grid-cols-[68px_120px_1fr] gap-3 border-b border-white/[0.025] px-3 py-1 hover:bg-white/[0.02]",
              l.level === "error" && "bg-danger/[0.06]",
            )}
          >
            <span className="text-muted-foreground/40">{timeAgo(l.ts)}</span>
            <span className={cn("truncate", LEVEL[l.level])}>{l.agent ?? l.level}</span>
            <span className="break-words text-muted-foreground">{l.message}</span>
          </div>
        ))
      )}
      {live && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground/50">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-ok" /> streaming…
        </div>
      )}
    </div>
  );
}
