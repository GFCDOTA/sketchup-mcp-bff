import { Wrench, AlertTriangle, Check, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CardEyebrow } from "@/components/ui/card";
import { StatusBadge } from "./status-badge";
import type { Recipe } from "@/data/flow";

function Chips({ items, icon: Icon }: { items: string[]; icon?: typeof Wrench }) {
  if (!items?.length) return <span className="text-xs text-muted-foreground/50">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
          {Icon && <Icon className="size-3 text-muted-foreground/50" />} {t}
        </span>
      ))}
    </div>
  );
}

export function RecipeCard({ recipe: r }: { recipe: Recipe }) {
  return (
    <Card accent="gold" className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardEyebrow>recipe</CardEyebrow>
            <h3 className="mt-0.5 text-base font-semibold leading-tight">{r.name}</h3>
          </div>
          <StatusBadge status={r.status} className="shrink-0" />
        </div>

        <div>
          <CardEyebrow className="mb-1">Quando usar</CardEyebrow>
          <p className="text-sm text-muted-foreground">{r.whenToUse}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div><CardEyebrow className="mb-1.5">Inputs</CardEyebrow><Chips items={r.inputs} /></div>
          <div><CardEyebrow className="mb-1.5">Outputs</CardEyebrow><Chips items={r.outputs} /></div>
        </div>

        <div><CardEyebrow className="mb-1.5">Tools</CardEyebrow><Chips items={r.tools} icon={Wrench} /></div>

        {r.checklist?.length > 0 && (
          <div>
            <CardEyebrow className="mb-1.5 flex items-center gap-1.5"><ListChecks className="size-3.5" /> Checklist</CardEyebrow>
            <ul className="space-y-1">
              {r.checklist.map((c) => (
                <li key={c} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-ok" /> {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {r.risks?.length > 0 && (
          <div>
            <CardEyebrow className="mb-1.5">Riscos</CardEyebrow>
            <ul className="space-y-1">
              {r.risks.map((x) => (
                <li key={x} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" /> {x}
                </li>
              ))}
            </ul>
          </div>
        )}

        {r.runbook?.length > 0 && (
          <div className="mt-auto">
            <CardEyebrow className="mb-1.5">Runbook</CardEyebrow>
            <ol className="space-y-1">
              {r.runbook.map((step, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="font-mono text-[10px] text-primary/70">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
