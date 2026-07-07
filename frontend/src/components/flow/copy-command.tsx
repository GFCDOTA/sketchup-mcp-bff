import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

/** Linha de comando/path copiável com feedback. */
export function CopyCommand({
  value,
  label,
  variant = "command",
  className,
}: {
  value: string;
  label?: string;
  variant?: "command" | "path";
  className?: string;
}) {
  const [done, setDone] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {
      /* clipboard indisponível */
    }
  };

  return (
    <div className={className}>
      {label && <div className="mb-1 text-[11px] text-muted-foreground/60">{label}</div>}
      <button
        onClick={copy}
        title="Copiar"
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-md border border-border bg-popover px-3 py-2 text-left font-mono text-xs transition-colors hover:border-border/80",
        )}
      >
        {variant === "command" ? (
          <span className="select-none text-muted-foreground/40">$</span>
        ) : (
          <Terminal className="size-3.5 shrink-0 text-muted-foreground/40" />
        )}
        <span className="flex-1 overflow-x-auto whitespace-nowrap text-muted-foreground scrollbar-thin">
          {value}
        </span>
        <span className={cn("shrink-0 transition-colors", done ? "text-ok" : "text-muted-foreground/40 group-hover:text-muted-foreground")}>
          {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </span>
      </button>
    </div>
  );
}
