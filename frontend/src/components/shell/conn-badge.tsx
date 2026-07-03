import { useStatus } from "@/api/hooks";
import { USE_MOCKS } from "@/api/client";
import { cn } from "@/lib/utils";

export function ConnBadge() {
  const { data, isError, isLoading } = useStatus();
  const state: "live" | "mock" | "offline" | "connecting" = USE_MOCKS
    ? "mock"
    : isLoading
      ? "connecting"
      : isError || !data?.upstream.ok
        ? "offline"
        : "live";

  const cfg = {
    live: { dot: "bg-ok shadow-[0_0_7px] shadow-ok animate-pulse-dot", text: "text-ok", border: "border-ok/25 bg-ok/10", label: "ao vivo" },
    mock: { dot: "bg-warn", text: "text-warn", border: "border-warn/25 bg-warn/10", label: "modo mock" },
    offline: { dot: "bg-danger", text: "text-danger", border: "border-danger/25 bg-danger/10", label: "motor inacessível" },
    connecting: { dot: "bg-muted-foreground", text: "text-muted-foreground", border: "border-border bg-background", label: "conectando…" },
  }[state];

  const ollamaOn = data?.ollama.ok;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        cfg.border,
        cfg.text,
      )}
      title={
        data
          ? `motor (arquivo) ${data.upstream.ok ? "ok" : "off"} · ollama ${data.ollama.ok ? `${data.ollama.models} modelos` : "off"}`
          : undefined
      }
    >
      <span className={cn("size-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
      {state === "live" && (
        <>
          <span className="mx-0.5 h-3 w-px bg-current opacity-20" />
          <span className={cn("flex items-center gap-1", ollamaOn ? "text-ok" : "text-muted-foreground/60")}>
            <span className={cn("size-1.5 rounded-full", ollamaOn ? "bg-ok" : "bg-muted-foreground/40")} />
            ollama
          </span>
        </>
      )}
    </div>
  );
}
