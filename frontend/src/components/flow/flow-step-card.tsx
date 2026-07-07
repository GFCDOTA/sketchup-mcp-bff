import {
  LogIn, LogOut, FileCode2, Plug, Package, ShieldCheck, AlertTriangle, Bug,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "./status-badge";
import type { FlowStep } from "@/data/flow";

function Field({
  label, icon: Icon, items, mono, tone,
}: {
  label: string; icon: LucideIcon; items: string[]; mono?: boolean; tone?: "warn";
}) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
        <Icon className={cn("size-3.5", tone === "warn" && "text-warn")} /> {label}
      </div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <span className={cn("mt-1.5 size-1 shrink-0 rounded-full", tone === "warn" ? "bg-warn" : "bg-border")} />
            <span className={cn(mono && "break-all font-mono text-[11px]")}>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FlowStepCard({ step }: { step: FlowStep }) {
  return (
    <Card className="p-5" accent={step.status === "implemented" ? "ok" : step.status === "mock" ? "orange" : "purple"}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground/50">{step.timelineLabel}</div>
          <h3 className="mt-0.5 text-lg font-semibold leading-tight">{step.title}</h3>
        </div>
        <StatusBadge status={step.status} className="shrink-0" />
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{step.objetivo}</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Inputs" icon={LogIn} items={step.inputs} mono />
        <Field label="Outputs" icon={LogOut} items={step.outputs} mono />
        <Field label="Scripts / serviços" icon={FileCode2} items={step.scripts} mono />
        <Field label="APIs" icon={Plug} items={step.apis} mono />
        <Field label="Artifacts" icon={Package} items={step.artifacts} mono />
        <Field label="Gates" icon={ShieldCheck} items={step.gates} />
        <Field label="Erros comuns" icon={AlertTriangle} items={step.errosComuns} tone="warn" />
        <Field label="Como depurar" icon={Bug} items={step.debug} mono />
      </div>
    </Card>
  );
}
