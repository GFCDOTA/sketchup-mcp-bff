// gpt-review-badge.tsx — status VIVO do laço autônomo de revisão (curation_review
// no motor) + a nota/crítica do GPT-no-Docker, por card de curadoria. Self-contained.
// Alimentado pelos sidecars curation_status.jsonl / gpt_reviews.jsonl (poll de 6s do
// useCuration). Ausente → não renderiza nada (degrade honesto).
import { Loader2, Sparkles, Wrench, CircleCheck, UserRound, EyeOff, Hourglass } from "lucide-react";
import type { CurationAnalysisStatus, CurationVariant } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Meta = { label: string; variant: "default" | "ok" | "warn" | "danger" | "info" | "gold" | "outline";
              icon: typeof Sparkles; spin?: boolean };

const STATUS_META: Record<CurationAnalysisStatus, Meta> = {
  na_fila: { label: "na fila", variant: "outline", icon: Hourglass },
  em_analise: { label: "em análise · GPT", variant: "info", icon: Loader2, spin: true },
  revisado: { label: "revisado", variant: "default", icon: Sparkles },
  corrigindo: { label: "corrigindo", variant: "warn", icon: Wrench, spin: true },
  concluido: { label: "concluído", variant: "ok", icon: CircleCheck },
  aguardando_felipe: { label: "aguardando você", variant: "gold", icon: UserRound },
  oraculo_offline: { label: "oráculo offline", variant: "danger", icon: EyeOff },
};

const notaColor = (n: number) => (n >= 7 ? "text-ok" : n >= 5 ? "text-warn" : "text-danger");

/** Pílula de status do laço + nota/crítica do GPT. Só aparece se o item já entrou
 *  no laço (tem status OU review) — senão retorna null. */
export function GptReviewBadge({ v }: { v: CurationVariant }) {
  const status = v.analysis_status;
  const hasReview = v.gpt_nota != null || !!v.gpt_porque;
  if (!status && !hasReview) return null;

  const meta = status ? STATUS_META[status] : null;
  const Icon = meta?.icon ?? Sparkles;

  return (
    <div className="mt-2 rounded-md border border-border/40 bg-muted/20 p-2">
      <div className="flex items-center gap-2">
        {meta && (
          <Badge variant={meta.variant} className="normal-case">
            <Icon className={cn("size-3", meta.spin && "animate-spin")} />
            {meta.label}
          </Badge>
        )}
        {v.gpt_nota != null && (
          <span className="ml-auto font-mono text-sm font-bold leading-none"
            title="nota do GPT-no-Docker (0–10)">
            <span className={notaColor(v.gpt_nota)}>{v.gpt_nota}</span>
            <span className="text-muted-foreground/50">/10</span>
          </span>
        )}
      </div>

      {v.gpt_porque && (
        <p className="mt-1.5 line-clamp-3 text-[11px] leading-snug text-muted-foreground/85"
          title={v.gpt_porque}>
          {v.gpt_porque}
        </p>
      )}

      {v.gpt_caminho && (
        <details className="mt-1">
          <summary className="cursor-pointer select-none text-[10.5px] font-medium text-primary/80 hover:text-primary">
            caminho pro 10
          </summary>
          <p className="mt-1 whitespace-pre-line text-[11px] leading-snug text-muted-foreground/80">
            {v.gpt_caminho}
          </p>
        </details>
      )}
    </div>
  );
}
