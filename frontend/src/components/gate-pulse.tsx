import { Link } from "react-router-dom";
import { ArrowRight, Cpu, Heart, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBridgeHealth, useGateLive } from "@/api/hooks";
import { cn } from "@/lib/utils";

/** GatePulse — o gate (:8765) ao lado do "Acontecendo agora": está sendo acionado ou ocioso?
 *  SSE do audit.jsonl (useGateLive) + idade do último acesso (useBridgeHealth, por arquivo).
 *  Versão compacta do GateLiveCard da tela NOC — o feed completo vive lá. */

function fmtAge(s: number): string {
  if (s < 90) return `${Math.round(s)}s`;
  if (s < 5400) return `${Math.round(s / 60)}min`;
  return `${Math.round(s / 3600)}h`;
}

// ocioso demais = oportunidade parada (fila de visão/decisão que ninguém drenou), não só silêncio
const IDLE_BANDS = [
  { maxS: 30 * 60, label: "ativo", cls: "text-ok border-ok/30 bg-ok/10" },
  { maxS: 4 * 3600, label: "quieto", cls: "text-warn border-warn/30 bg-warn/10" },
  { maxS: Infinity, label: "ocioso", cls: "text-danger border-danger/30 bg-danger/10" },
] as const;

export function GatePulse() {
  const { events, count, consults, live, ratePerMin } = useGateLive(3);
  const health = useBridgeHealth();
  const lastLiveS = events[0] ? Math.max(Date.now() / 1000 - events[0].ts, 0) : null;
  const idleS = lastLiveS ?? health.data?.signals.gateLastActivityS ?? null;
  const band = idleS == null ? null : IDLE_BANDS.find((b) => idleS < b.maxS)!;

  return (
    <Card className={cn("border", live && idleS != null && idleS < 1800 ? "border-ok/30 bg-ok/[0.03]" : "border-border")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className={cn("size-4", live ? "text-ok" : "text-muted-foreground/50")} />
          Gate (:8765)
          {live && <span className="size-1.5 rounded-full bg-ok animate-pulse-dot" />}
        </CardTitle>
        <Link to="/noc" className="text-xs text-muted-foreground hover:text-foreground">
          ver NOC <ArrowRight className="inline size-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="flex items-baseline gap-1.5">
            <span className="tabular-nums text-3xl font-bold leading-none text-ok">{count}</span>
            <span className="text-xs text-muted-foreground/70">acessos agora</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="tabular-nums text-lg font-semibold leading-none text-blue">{ratePerMin.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground/70">/min</span>
          </div>
          {band && idleS != null && (
            <Badge variant="outline" className={cn("ml-auto", band.cls)}>
              {band.label} · último {fmtAge(idleS)} atrás
            </Badge>
          )}
        </div>
        <div className="mt-2.5 space-y-1">
          {events.length === 0 ? (
            <div className="text-[11px] text-muted-foreground/50">
              {consults} consults no ledger · aguardando acesso ao vivo…
            </div>
          ) : (
            events.map((e, i) => (
              <div key={`${e.ts}-${i}`} className="flex items-center gap-2 text-xs">
                {e.kind === "consult" ? (
                  <>
                    <Cpu className="size-3 shrink-0 text-blue" />
                    <code className="truncate text-muted-foreground/80">{e.model ?? "consult"}</code>
                    {e.tier && <Badge variant="outline" className="shrink-0">{e.tier}</Badge>}
                  </>
                ) : (
                  <>
                    <Heart className="size-3 shrink-0 text-ok/60" />
                    <span className="text-muted-foreground/60">heartbeat</span>
                    {e.cycle != null && <span className="ml-auto shrink-0 text-muted-foreground/40">ciclo {e.cycle}</span>}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
