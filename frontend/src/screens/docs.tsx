import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Book, Boxes, Workflow as WorkflowIcon, Bot, Cpu, Network, Terminal,
  Lightbulb, ShieldCheck, ArrowRight, AppWindow, Layers, type LucideIcon,
} from "lucide-react";
import { useStudioState, useWorkflows } from "@/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pipeline } from "@/components/pipeline";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

/* ── primitivos locais de doc (tudo in-app, nada navega pra fora) ──────────── */
function Callout({
  tone = "info", icon: Icon = Lightbulb, children,
}: { tone?: "info" | "gold" | "warn"; icon?: LucideIcon; children: React.ReactNode }) {
  const c = {
    info: "border-l-blue [&_svg]:text-blue",
    gold: "border-l-primary [&_svg]:text-primary",
    warn: "border-l-warn [&_svg]:text-warn",
  }[tone];
  return (
    <div className={cn("flex gap-3 rounded-md border border-border border-l-[3px] bg-background/60 p-3 text-sm text-muted-foreground", c)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="[&_b]:text-foreground [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-primary">{children}</div>
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-popover p-3.5 font-mono text-xs leading-relaxed text-muted-foreground [&_.k]:text-primary">
      {children}
    </pre>
  );
}

function ArchFlow() {
  const Node = ({ icon: Icon, title, sub, accent }: { icon: LucideIcon; title: string; sub: string; accent?: boolean }) => (
    <div className={cn("flex min-w-[120px] flex-col items-center gap-1 rounded-md border bg-background px-4 py-3 text-center",
      accent ? "border-primary/40" : "border-border")}>
      <Icon className={cn("size-4", accent ? "text-primary" : "text-muted-foreground")} />
      <b className="text-sm">{title}</b>
      <i className="font-mono text-[10.5px] not-italic text-muted-foreground/60">{sub}</i>
    </div>
  );
  const Arrow = ({ label }: { label?: string }) => (
    <div className="flex flex-col items-center text-border">
      <ArrowRight className="size-4" />
      {label && <small className="text-[9px] text-muted-foreground/50">{label}</small>}
    </div>
  );
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Node icon={AppWindow} title="Cockpit" sub="React · aberto em :8782" />
      <Arrow label="/api/*" />
      {/* caixa do BFF — o Runner vive DENTRO dele (não é serviço externo) */}
      <div className="rounded-md border border-primary/40 bg-background p-2.5">
        <div className="mb-1.5 flex items-center gap-2 px-0.5">
          <Boxes className="size-4 text-primary" />
          <b className="text-sm">BFF</b>
          <i className="font-mono text-[10.5px] not-italic text-muted-foreground/60">server.py + cockpit_api</i>
        </div>
        <div className="flex items-center gap-2 rounded border border-border bg-card px-2.5 py-1.5">
          <Terminal className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Runner</span>
          <span className="font-mono text-[10px] not-italic text-muted-foreground/50">runs · logs SSE · interno</span>
        </div>
      </div>
      <Arrow label="integra" />
      {/* serviços externos (processos separados, com porta) */}
      <div className="flex flex-col gap-2">
        <Node icon={Cpu} title="Ollama" sub=":11434 · modelos" />
        <Node icon={Network} title="Motor" sub="arquivos · studio_mirror" />
      </div>
    </div>
  );
}

/* ── seções ────────────────────────────────────────────────────────────────*/
const SECTIONS: { id: string; title: string; icon: LucideIcon }[] = [
  { id: "visao", title: "O que é", icon: Book },
  { id: "arquitetura", title: "Arquitetura", icon: Network },
  { id: "pipeline", title: "Pipeline", icon: WorkflowIcon },
  { id: "agentes", title: "Agentes & Runs", icon: Bot },
  { id: "telas", title: "Guia das telas", icon: Layers },
  { id: "conhecimento", title: "Base de conhecimento", icon: Lightbulb },
  { id: "api", title: "API", icon: Terminal },
];

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-4">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="size-4 text-muted-foreground" /> {title}</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_b]:text-foreground">{children}</CardContent>
    </Card>
  );
}

const SCREENS_GUIDE = [
  ["Visão Geral", "estado do sistema, métricas, runs recentes, decisões pendentes e o workflow ativo."],
  ["Agentes", "o time multi-agente (PM · Team Lead · Arquiteto + LLMs) com status, modelo, tools e disparo de run."],
  ["Runs", "histórico de execuções filtrável; o detalhe traz a timeline de steps e o log viewer ao vivo (SSE)."],
  ["Workflows", "as recipes (quando usar / inputs / outputs / tools / checklist / riscos) com botão de rodar."],
  ["Modelos", "modelos locais do Ollama e um painel para testar um prompt (passa pelo BFF, nunca direto)."],
  ["Decisões", "gates que aguardam você (propostas de programa, revisão visual) com responder."],
  ["Artefatos", "renders, SKPs, relatórios e JSONs gerados pelos runs."],
];

export default function Docs() {
  const state = useStudioState();
  const workflows = useWorkflows();
  const [active, setActive] = useState("visao");

  const knowledge = state.data?.knowledge?.entries ?? [];
  const mainWf = (workflows.data?.workflows ?? []).find((w) => w.id === "cycle-fidelity") ?? workflows.data?.workflows?.[0];

  const goTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <PageHeader title="Documentação" subtitle="Como o cockpit funciona — tudo aqui dentro, sem sair da página" />

      <div className="grid grid-cols-12 gap-5">
        {/* TOC in-page (rola dentro da página, não navega) */}
        <nav className="col-span-12 lg:col-span-3">
          <div className="lg:sticky lg:top-2 space-y-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => goTo(s.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active === s.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <s.icon className={cn("size-4", active === s.id ? "text-primary" : "text-muted-foreground/60")} />
                {s.title}
              </button>
            ))}
          </div>
        </nav>

        {/* conteúdo */}
        <div className="col-span-12 space-y-4 lg:col-span-9">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border border-l-[3px] border-l-primary bg-background/60 p-3.5 text-sm">
            <span className="text-muted-foreground">
              Quer o fluxo <b className="text-foreground">ponta a ponta</b>, interativo e animado? Veja o Studio Flow.
            </span>
            <Link to="/flow" className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
              Abrir Studio Flow <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <Section id="visao" title="O que é o Interior Studio" icon={Book}>
            <p>
              O <b>Interior Studio</b> é o cockpit multi-agente do projeto <code>sketchup-mcp</code>. O domínio
              do produto é gerar um <b>.skp</b> do SketchUp fiel a uma planta arquitetônica de PDF e, a partir
              dela, <b>mobiliar e renderizar</b> ambientes com um time de agentes (PM · Team Lead · Arquiteto)
              apoiado por modelos locais (Ollama) e por um oráculo visual.
            </p>
            <p>
              Este cockpit é a <b>interface de operação</b>: você acompanha o estado, dispara agentes e
              workflows, lê os logs ao vivo, cura referências e responde às decisões — sem tocar no terminal.
            </p>
            <Callout tone="gold" icon={ShieldCheck}>
              <b>Princípio de arquitetura:</b> o frontend fala <b>só</b> com <code>/api/*</code>. Quem conversa
              com modelos locais, com os arquivos do motor e com o runner de agents é o <b>BFF</b> — nunca o React.
            </Callout>
          </Section>

          <Section id="arquitetura" title="Arquitetura" icon={Network}>
            <p>
              O <b>Cockpit</b> é um app React servido pelo próprio <b>BFF</b> (Python, stdlib) na
              <code>:8782</code> — mesma origem para a UI e para a API. O BFF é o <b>ponto único de
              integração</b>: fala com o Ollama, executa os runs e monta o <code>/api/state</code> lendo os
              <b> arquivos do motor</b> (studio_mirror — a porta :8781 não é mais dependência).
              Você só abre <code>http://localhost:8782</code>.
            </p>
            <ArchFlow />
            <p>Para subir o ambiente:</p>
            <CodeBlock>
              <span className="k"># 1) build do cockpit (uma vez) → frontend/dist</span>{"\n"}
              cd frontend && npm run build && cd ..{"\n"}
              <span className="k"># 2) BFF: serve o cockpit + API → http://localhost:8782 (lê o motor por arquivo)</span>{"\n"}
              python server.py
            </CodeBlock>
            <Callout tone="info">
              Desenvolvendo o front com HMR: <code>npm run dev</code> (porta <code>:5173</code>, faz proxy
              de <code>/api</code> → :8782). Só visual, sem backend: <code>VITE_MOCKS=1 npm run dev</code>.
            </Callout>
          </Section>

          <Section id="pipeline" title="Pipeline de fidelidade" icon={WorkflowIcon}>
            <p>
              Cada asset (sofá, cozinha, …) avança por um pipeline: das <b>referências</b> curadas ao
              <b> render V-Ray</b> validado. Os passos do ciclo ativo:
            </p>
            {mainWf ? <Pipeline steps={mainWf.steps} /> : <p className="text-muted-foreground/60">carregando o ciclo…</p>}
            <p>
              Cada passo tem um dono (agente ou modelo) e gates determinísticos. O veredito visual nunca é
              automático: <b>quando o ciclo aguarda o juiz visual</b>, aparece uma <b>decisão</b>
              (IMPROVED/SAME/WORSE) na aba Decisões.
            </p>
          </Section>

          <Section id="agentes" title="Agentes & Runs" icon={Bot}>
            <p>
              O time é organizado em guarda-chuvas: <b>PM</b> coordena, <b>Team Lead</b> consulta os LLMs locais
              e o <b>Arquiteto</b> propõe o programa do cômodo e consulta o oráculo de visão. Cada agente tem um
              modelo associado e um conjunto de tools.
            </p>
            <p>
              Disparar um agente ou workflow cria um <b>run</b>. O run tem uma timeline de steps e um stream de
              <b> logs ao vivo</b> (Server-Sent Events) — você vê o progresso em tempo real na tela de detalhe,
              com cores por nível (debug / info / warn / error / success).
            </p>
            <Callout tone="warn" icon={Cpu}>
              O runner atual é um <b>stub</b> (simula steps + logs) — o ponto de plugue para um runner real de
              agents/workflows está marcado em <code>cockpit_api.py</code>. O <b>chat com Ollama é real</b>.
            </Callout>
          </Section>

          <Section id="telas" title="Guia das telas" icon={Layers}>
            <ul className="space-y-2">
              {SCREENS_GUIDE.map(([name, desc]) => (
                <li key={name} className="flex gap-2">
                  <ArrowRight className="mt-1 size-3.5 shrink-0 text-primary" />
                  <span><b>{name}</b> — {desc}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="conhecimento" title="Base de conhecimento" icon={Lightbulb}>
            <p>O conhecimento que alimenta o estúdio (estilo do Felipe, contratos, diretrizes de ciclo) vem do BFF:</p>
            {state.isLoading ? (
              <p className="text-muted-foreground/60">carregando…</p>
            ) : knowledge.length === 0 ? (
              <Callout tone="info">Nenhuma entrada agora (os arquivos do motor podem estar ausentes). Confira o BFF_ENGINE_ROOT e alimente o architect.md.</Callout>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {knowledge.map((e, i) => (
                  <div key={i} className="rounded-md border border-border border-l-[3px] border-l-primary/50 bg-background/60 p-3">
                    <div className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
                      <Book className="size-3.5 text-primary" /> {e.title}
                    </div>
                    <p className="line-clamp-4 text-xs text-muted-foreground">{e.preview}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section id="api" title="Contrato da API (BFF)" icon={Terminal}>
            <p>O frontend consome estes endpoints (tipos em <code>src/api/types.ts</code>):</p>
            <CodeBlock>
              GET  /api/status              <span className="k"># saúde (motor por arquivo + ollama)</span>{"\n"}
              GET  /api/models              <span className="k"># modelos do Ollama</span>{"\n"}
              POST /api/models/chat         <span className="k"># chat (via BFF, nunca direto)</span>{"\n"}
              GET  /api/agents{"\n"}
              POST /api/agents/:id/run{"\n"}
              GET  /api/runs  ·  /api/runs/:id  ·  /api/runs/:id/logs <span className="k">(SSE)</span>{"\n"}
              GET  /api/artifacts{"\n"}
              GET  /api/decisions  ·  POST /api/decisions/:id/respond{"\n"}
              GET  /api/workflows  ·  POST /api/workflows/:id/run
            </CodeBlock>
          </Section>
        </div>
      </div>
    </>
  );
}
