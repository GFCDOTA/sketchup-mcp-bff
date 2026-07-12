// curation-autonomy-card.tsx — "o que a revisão autônoma fez": as últimas passadas
// do laço (curation_runs.jsonl do motor, via /api/curation). Responde ao Felipe
// "quero VER o que o sistema faz a cada 15min" sem ele abrir log nenhum.
// Self-contained; dados chegam pelo poll de 6s do useCuration.
import { Bot, Wrench } from "lucide-react";
import type { CurationAutonomy } from "@/api/types";
import { Card, CardContent, CardEyebrow, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const hhmm = (t: number) =>
  new Date(t * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const ddmm = (t: number) =>
  new Date(t * 1000).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const notaColor = (n: number | null) =>
  n == null ? "text-muted-foreground/60" : n >= 7 ? "text-ok" : n >= 5 ? "text-warn" : "text-danger";

/** Dot de frescor: verde <20min (tick saudável) · âmbar <1h · cinza parado. */
function freshness(lastT: number | null): { cls: string; label: string } {
  if (!lastT) return { cls: "bg-muted-foreground/40", label: "nunca rodou" };
  const age = Date.now() / 1000 - lastT;
  if (age < 20 * 60) return { cls: "bg-ok", label: `ativo — última ${hhmm(lastT)}` };
  if (age < 60 * 60) return { cls: "bg-warn", label: `quieto — última ${hhmm(lastT)}` };
  return { cls: "bg-muted-foreground/40", label: `parado — última ${ddmm(lastT)} ${hhmm(lastT)}` };
}

const shortVid = (vid: string) => {
  const segs = vid.split("__").filter(Boolean);
  return segs.length >= 2 ? segs.slice(-2).join("·") : vid;
};

export function CurationAutonomyCard({ autonomy }: { autonomy?: CurationAutonomy }) {
  const runs = autonomy?.runs ?? [];
  const fresh = freshness(autonomy?.last_t ?? null);
  const last = runs[0];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardEyebrow>laço autônomo</CardEyebrow>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bot className="size-4 text-primary" />
          Revisão autônoma · GPT
          <span className={cn("ml-1 inline-block size-2 rounded-full", fresh.cls)} title={fresh.label} />
          <span className="text-[11px] font-normal text-muted-foreground/70">{fresh.label}</span>
          {last && last.remaining > 0 && (
            <span className="ml-auto text-[11px] font-normal text-muted-foreground">
              restam <span className="font-semibold text-foreground/80">{last.remaining}</span> na fila
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">
            Nenhuma passada registrada ainda — o atuador roda o laço a cada ~15min.
          </p>
        ) : (
          <ul className="space-y-1">
            {runs.slice(0, 5).map((r, i) => (
              <li key={`${r.t}-${i}`}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11.5px] leading-snug">
                <span className="font-mono text-muted-foreground/60">{ddmm(r.t)} {hhmm(r.t)}</span>
                {r.trigger === "manual" && (
                  <span className="rounded-sm bg-primary/15 px-1 text-[9.5px] font-semibold uppercase text-primary">manual</span>
                )}
                {r.n_reviewed === 0 ? (
                  <span className="text-muted-foreground/60">rodou — nada novo pra revisar</span>
                ) : (
                  <>
                    <span>revisou <span className="font-semibold">{r.n_reviewed}</span>:</span>
                    {r.reviewed.map((v) => (
                      <span key={v.variant_id} className="font-mono" title={v.variant_id}>
                        {shortVid(v.variant_id)}
                        <span className={cn("ml-0.5 font-bold", notaColor(v.nota))}>
                          {v.nota != null ? `${v.nota}/10` : "—"}
                        </span>
                      </span>
                    ))}
                  </>
                )}
                {r.enqueued_fixes.length > 0 && (
                  <span className="flex items-center gap-0.5 text-warn">
                    <Wrench className="size-3" />{r.enqueued_fixes.length} correção(ões)
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 border-t border-border/40 pt-1.5 text-[10.5px] text-muted-foreground/60">
          A cada ~15min o sistema escolhe sozinho o que revisar e manda pro GPT (nota 0–10 no card).
          Nota &lt;7 vira candidata a correção — o auto-fix (sessão Claude) está desligado até você ligar.
        </p>
      </CardContent>
    </Card>
  );
}
