import { Bot, Cpu, Wrench, Search, Play, Check, AlertTriangle, Lightbulb } from "lucide-react";
import { useTheme } from "@/theme/use-theme";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Card, CardHeader, CardTitle, CardContent, CardEyebrow } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Metric } from "@/components/metric";
import { LogViewer } from "@/components/log-viewer";
import { Timeline } from "@/components/timeline";
import { Pipeline } from "@/components/pipeline";
import { StatusBadge } from "@/components/flow/status-badge";
import { RecipeCard } from "@/components/flow/recipe-card";
import { ArtifactLifecycle } from "@/components/flow/artifact-lifecycle";
import { recipes, artifactDocs } from "@/data/flow";
import type { LogLine, RunStep, WorkflowStep } from "@/api/types";

const LOGS: LogLine[] = [
  { ts: new Date().toISOString(), level: "info", agent: "Builder", message: "run iniciado (qwen2.5-coder:7b)" },
  { ts: new Date().toISOString(), level: "debug", agent: "Builder", message: "emitindo Ruby via SketchUp API…" },
  { ts: new Date().toISOString(), level: "success", agent: "Builder", message: "geometria: 18.432 faces, 0 degeneradas" },
  { ts: new Date().toISOString(), level: "warn", agent: "Builder", message: "braço esquerdo 2mm fora — dentro da tolerância" },
  { ts: new Date().toISOString(), level: "error", agent: "Oráculo", message: "OPENAI_API_KEY ausente — visão indisponível" },
];
const STEPS: RunStep[] = [
  { name: "Carregar spec", status: "done" }, { name: "Emitir Ruby", status: "done" },
  { name: "Build 3D", status: "running" }, { name: "Gate de fidelidade", status: "pending" },
];
const PIPE: WorkflowStep[] = [
  { key: "ref", label: "Referência", status: "done" }, { key: "cur", label: "Curadoria", status: "done" },
  { key: "build", label: "Build", status: "doing" }, { key: "vray", label: "V-Ray", status: "pending" },
];

function Lab({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap items-start gap-3">{children}</CardContent>
    </Card>
  );
}

export default function ThemeLab() {
  const { theme, themeId, setThemeId, themes } = useTheme();

  return (
    <>
      <PageHeader title="Theme Lab" subtitle={`Compare os ${themes.length} temas — todos os componentes num lugar só. Atual: ${theme.emoji} ${theme.name}`} />

      {/* troca rápida */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => setThemeId(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
              t.id === themeId ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{t.emoji}</span> {t.name}
            <span className="flex gap-0.5">
              {t.preview.slice(0, 3).map((c, i) => <span key={i} className="size-2 rounded-[2px] ring-1 ring-black/25" style={{ background: c }} />)}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Runs ativos" value={3} icon={Play} tone="info" />
          <Metric label="Aprovados" value={12} icon={Check} tone="ok" />
          <Metric label="Pendências" value={2} icon={AlertTriangle} tone="warn" />
          <Metric label="Modelos" value={3} icon={Cpu} tone="info" />
        </div>

        <div className="col-span-12 lg:col-span-6"><Lab title="Buttons">
          <Button variant="primary"><Play className="size-3.5" /> Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </Lab></div>

        <div className="col-span-12 lg:col-span-6"><Lab title="Badges & Status pills">
          <Badge variant="default">default</Badge><Badge variant="ok">ok</Badge>
          <Badge variant="warn">warn</Badge><Badge variant="danger">danger</Badge>
          <Badge variant="info">info</Badge><Badge variant="gold">gold</Badge><Badge variant="purple">purple</Badge>
          <div className="flex w-full flex-wrap gap-2 pt-1">
            <StatusPill status="running" pulse /><StatusPill status="succeeded" /><StatusPill status="failed" />
            <StatusPill status="queued" /><StatusBadge status="implemented" /><StatusBadge status="mock" /><StatusBadge status="planned" />
          </div>
        </Lab></div>

        <div className="col-span-12 lg:col-span-7"><Lab title="Log viewer (SSE)">
          <div className="w-full"><LogViewer lines={LOGS} /></div>
        </Lab></div>

        <div className="col-span-12 lg:col-span-5"><Lab title="Timeline & Pipeline">
          <div className="w-full space-y-4">
            <Timeline steps={STEPS} />
            <Pipeline steps={PIPE} />
          </div>
        </Lab></div>

        <div className="col-span-12 lg:col-span-6"><Lab title="Agent card">
          <div className="w-full rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-md border border-border bg-secondary text-muted-foreground"><Bot className="size-5" /></span>
              <div className="flex-1"><div className="flex items-center gap-2"><span className="font-semibold">Arquiteto</span><Badge variant="ok">online</Badge></div>
                <div className="text-xs text-muted-foreground/60">Architect · design</div></div>
              <StatusPill status="working" pulse />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="info" className="gap-1 normal-case"><Cpu className="size-3" /> deepseek-r1:14b</Badge>
              {["program", "consult-gpt", "vision"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"><Wrench className="size-3 text-muted-foreground/50" /> {t}</span>
              ))}
            </div>
          </div>
        </Lab></div>

        <div className="col-span-12 lg:col-span-6"><Lab title="Inputs & Callout">
          <div className="w-full space-y-3">
            <Input placeholder="Buscar…" />
            <Textarea rows={2} placeholder="Prompt para o modelo…" />
            <div className="flex gap-3 rounded-md border border-border border-l-[3px] border-l-blue bg-background/60 p-3 text-sm text-muted-foreground">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-blue" />
              <div>Callout de exemplo — usa <code className="rounded bg-secondary px-1 font-mono text-primary">tokens</code>, adapta a cada tema.</div>
            </div>
          </div>
        </Lab></div>

        <div className="col-span-12 lg:col-span-7"><Lab title="Tabela & chart (mock)">
          <div className="w-full space-y-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground/50">
                <th className="py-1.5">Run</th><th>Tipo</th><th>Status</th></tr></thead>
              <tbody className="divide-y divide-border/60">
                {[["sofa-3-lugares", "agent", "succeeded"], ["cozinha v3", "agent", "failed"], ["render 4k", "workflow", "running"]].map(([a, b, c]) => (
                  <tr key={a}><td className="py-2 font-medium">{a}</td><td className="text-muted-foreground">{b}</td><td><StatusPill status={c} pulse={c === "running"} /></td></tr>
                ))}
              </tbody>
            </table>
            <div className="flex h-24 items-end gap-1.5">
              {[40, 65, 35, 80, 55, 70, 48, 90, 60, 75].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </Lab></div>

        <div className="col-span-12 lg:col-span-5"><Lab title="Command palette (preview)">
          <div className="w-full overflow-hidden rounded-lg border border-border bg-popover">
            <div className="flex items-center gap-2.5 border-b border-border px-3 py-3"><Search className="size-4 text-muted-foreground/60" /><span className="text-sm text-muted-foreground/60">Buscar páginas e ações…</span></div>
            <div className="p-1.5">
              {["Visão Geral", "Agentes", "Runs", "Studio Flow"].map((x, i) => (
                <div key={x} className={cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-sm", i === 0 ? "bg-secondary text-foreground" : "text-muted-foreground")}>{x}</div>
              ))}
            </div>
          </div>
        </Lab></div>

        <div className="col-span-12 lg:col-span-6">
          <CardEyebrow className="mb-2">Recipe card</CardEyebrow>
          {recipes[0] && <RecipeCard recipe={recipes[0]} />}
        </div>
        <div className="col-span-12 lg:col-span-6">
          <CardEyebrow className="mb-2">Artifact card</CardEyebrow>
          {artifactDocs[0] && <ArtifactLifecycle artifact={artifactDocs[0]} />}
        </div>
      </div>
    </>
  );
}
