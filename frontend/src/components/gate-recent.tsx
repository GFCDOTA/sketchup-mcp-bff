import { History, Cpu, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBridgeGate } from "@/api/hooks";
import { cn } from "@/lib/utils";

/** GateRecent — os ÚLTIMOS ACIONAMENTOS do gate (:8765), lidos do ledger via
 *  /api/bridge/gate (useBridgeGate). Complementa o GatePulse (ao-vivo por SSE):
 *  aqui a lista PERSISTE mesmo com o gate ocioso — é o "quem acionou por último". */

function fmtAgo(ts: number): string {
  const s = Math.max(Date.now() / 1000 - ts, 0);
  if (s < 90) return `${Math.round(s)}s`;
  if (s < 5400) return `${Math.round(s / 60)}min`;
  if (s < 172800) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

// mesma linguagem de cor do resto do cockpit: deep = raciocínio caro, fast = barato
const TIER_CLS: Record<string, string> = {
  deep: "text-blue border-blue/30",
  fast: "text-ok border-ok/30",
};

export function GateRecent({ max = 6 }: { max?: number }) {
  const { data, isLoading } = useBridgeGate();
  const consults = (data?.consults ?? []).slice().sort((a, b) => b.ts - a.ts).slice(0, max);

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          Últimos acionamentos
        </CardTitle>
        {data?.consultCount != null && (
          <span className="tabular-nums text-xs text-muted-foreground/70">{data.consultCount} no total</span>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-[11px] text-muted-foreground/50">carregando ledger do gate…</div>
        ) : consults.length === 0 ? (
          <div className="text-[11px] text-muted-foreground/50">nenhum acionamento registrado no ledger</div>
        ) : (
          <div className="space-y-1.5">
            {consults.map((c, i) => (
              <div key={`${c.ts}-${i}`} className="flex items-center gap-2 text-xs">
                <Cpu className="size-3 shrink-0 text-blue" />
                <code className="truncate text-muted-foreground/85">{c.model ?? "consult"}</code>
                {c.tier && (
                  <Badge variant="outline" className={cn("shrink-0", TIER_CLS[c.tier] ?? "")}>
                    {c.tier}
                  </Badge>
                )}
                <span className="ml-auto flex shrink-0 items-center gap-2 tabular-nums text-muted-foreground/55">
                  {c.durSec != null && <span>{c.durSec.toFixed(1)}s</span>}
                  <span className="flex items-center gap-0.5">
                    <Clock className="size-3" />
                    {fmtAgo(c.ts)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
