import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Workflow as WorkflowIcon, Network, FolderTree, Bot, Plug, Package,
  Sparkles, Terminal, Cpu, Wrench, AlertTriangle, ArrowRight, Wand2,
} from "lucide-react";
import {
  flowSteps, architectureLayers, bffTree, engineTree, recipes, agentDocs,
  endpointDocs, artifactDocs, responsibilityCards, setupCommands, troubleshootingItems,
  skillDocs, specDocs, stepCategory, CATEGORY_LABEL, type FlowCategory,
} from "@/data/flow";
import { cn } from "@/lib/utils";
import { FlowHero } from "@/components/flow/flow-hero";
import { FlowTimeline } from "@/components/flow/flow-timeline";
import { FlowStepCard } from "@/components/flow/flow-step-card";
import { ArchitectureMap } from "@/components/flow/architecture-map";
import { ProjectTree } from "@/components/flow/project-tree";
import { RecipeCard } from "@/components/flow/recipe-card";
import { ResponsibilityCard } from "@/components/flow/responsibility-card";
import { ApiEndpointCard } from "@/components/flow/api-endpoint-card";
import { ArtifactLifecycle } from "@/components/flow/artifact-lifecycle";
import { StatusBadge } from "@/components/flow/status-badge";
import { CopyCommand } from "@/components/flow/copy-command";
import { SkillsGrid, SpecsList } from "@/components/flow/skills-grid";
import { AnimatedSection, staggerContainer, staggerItem } from "@/components/flow/animated-section";

const SECTIONS = [
  { id: "fluxo", label: "Fluxo", icon: WorkflowIcon },
  { id: "arquitetura", label: "Arquitetura", icon: Network },
  { id: "repos", label: "Repositórios", icon: FolderTree },
  { id: "skills", label: "Skills & Specs", icon: Wand2 },
  { id: "recipes", label: "Recipes", icon: Sparkles },
  { id: "agentes", label: "Agentes", icon: Bot },
  { id: "api", label: "API", icon: Plug },
  { id: "artifacts", label: "Artifacts", icon: Package },
  { id: "runbook", label: "Como rodar", icon: Terminal },
];

const STEP_CATS: (FlowCategory | "all")[] = ["all", "pipeline", "gates", "api", "artifacts"];

function SectionTitle({ id, icon: Icon, title, sub }: { id?: string; icon: typeof Network; title: string; sub?: string }) {
  return (
    <div id={id} className="mb-4 scroll-mt-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Icon className="size-4 text-primary" /> {title}
      </h2>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function Flow() {
  const [cat, setCat] = useState<FlowCategory | "all">("all");
  const [selId, setSelId] = useState(flowSteps[0]?.id ?? "");
  const { hash } = useLocation();

  // chegou via deep-link (ex.: clique num log do "Acontecendo agora" → /flow#api) → rola até a seção
  useEffect(() => {
    if (!hash) return;
    const id = hash.replace("#", "");
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("ring-2", "ring-primary/40", "rounded-lg");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary/40", "rounded-lg"), 1600);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [hash]);

  const visible = cat === "all" ? flowSteps : flowSteps.filter((s) => stepCategory[s.id] === cat);
  useEffect(() => {
    if (!visible.find((s) => s.id === selId)) setSelId(visible[0]?.id ?? flowSteps[0]?.id ?? "");
  }, [cat]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = flowSteps.find((s) => s.id === selId) ?? flowSteps[0];

  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="space-y-10">
      <FlowHero onSeeFlow={() => goTo("fluxo")} />

      {/* nav de seções (navegável, não sai da página) */}
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-1.5 bg-background/80 px-1 py-2 backdrop-blur">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => goTo(s.id)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border/70 hover:text-foreground"
          >
            <s.icon className="size-3.5" /> {s.label}
          </button>
        ))}
      </div>

      {/* FLUXO */}
      <AnimatedSection>
        <SectionTitle id="fluxo" icon={WorkflowIcon} title="Fluxo ponta a ponta"
          sub="Do PDF ao artifact aprovado. Clique numa etapa para os detalhes; filtre por tipo." />
        <div className="mb-4 flex flex-wrap gap-1.5">
          {STEP_CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                cat === c ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card/40 p-4 sm:p-5">
          <FlowTimeline steps={visible} activeId={selId} onSelect={setSelId} />
        </div>
        <div className="mt-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={selected?.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {selected && <FlowStepCard step={selected} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </AnimatedSection>

      {/* ARQUITETURA */}
      <AnimatedSection>
        <SectionTitle id="arquitetura" icon={Network} title="Mapa de arquitetura"
          sub="Camadas do browser ao motor — o React fala só com /api/*." />
        <ArchitectureMap layers={architectureLayers} />
      </AnimatedSection>

      {/* REPOS */}
      <AnimatedSection>
        <SectionTitle id="repos" icon={FolderTree} title="Estrutura dos repositórios"
          sub="O cockpit/BFF (sketchup-mcp-bff) e as pastas-chave do motor (sketchup-mcp)." />
        <div className="grid gap-4 lg:grid-cols-2">
          <ProjectTree title="sketchup-mcp-bff/  (cockpit + BFF)" nodes={bffTree} accent="gold" />
          <ProjectTree title="sketchup-mcp/  (motor — não modificado)" nodes={engineTree} accent="blue" />
        </div>
      </AnimatedSection>

      {/* SKILLS & SPECS */}
      <AnimatedSection>
        <SectionTitle id="skills" icon={Wand2} title={`Skills do estúdio (${skillDocs.length})`}
          sub="A esteira agêntica do motor (.claude/skills) por responsabilidade." />
        <SkillsGrid skills={skillDocs} />
        <div className="mt-8">
          <SectionTitle icon={FolderTree} title={`Specs (${specDocs.length})`}
            sub="O contrato vivo do motor (.claude/specs) — o que cada parte promete." />
          <SpecsList specs={specDocs} />
        </div>
      </AnimatedSection>

      {/* RECIPES */}
      <AnimatedSection>
        <SectionTitle id="recipes" icon={Sparkles} title="Recipes / Workflows"
          sub="Receitas reproduzíveis: quando usar, inputs, outputs, tools, checklist, riscos e runbook." />
        <div className="grid gap-4 lg:grid-cols-2">
          {recipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}
        </div>
      </AnimatedSection>

      {/* AGENTES */}
      <AnimatedSection>
        <SectionTitle id="agentes" icon={Bot} title="Agentes"
          sub="O time multi-agente e os modelos que cada um usa." />
        <motion.div variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agentDocs.map((a) => (
            <motion.div key={a.id} variants={staggerItem} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground"><Bot className="size-4" /></span>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{a.name}</div>
                  <div className="text-[11px] text-muted-foreground/60">{a.role}</div></div>
                <StatusBadge status={a.status} />
              </div>
              {a.model && <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-blue/25 bg-blue/12 px-2 py-0.5 text-[11px] text-blue"><Cpu className="size-3" /> {a.model}</div>}
              <div className="flex flex-wrap gap-1">
                {a.tools.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                    <Wrench className="size-2.5 text-muted-foreground/50" /> {t}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatedSection>

      {/* API */}
      <AnimatedSection>
        <SectionTitle id="api" icon={Plug} title="Endpoints da API"
          sub="O contrato que o React consome — todos same-origin, via o BFF." />
        <div className="space-y-2">
          {endpointDocs.map((ep) => <ApiEndpointCard key={ep.method + ep.path} ep={ep} />)}
        </div>
      </AnimatedSection>

      {/* ARTIFACTS */}
      <AnimatedSection>
        <SectionTitle id="artifacts" icon={Package} title="Artifacts & lifecycle"
          sub="Tipos de artefatos, de onde vêm e o ciclo de vida de cada um." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {artifactDocs.map((a) => <ArtifactLifecycle key={a.type} artifact={a} />)}
        </div>
      </AnimatedSection>

      {/* POR QUE É DIFERENTE */}
      <AnimatedSection>
        <SectionTitle icon={Sparkles} title="Por que é diferente" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {responsibilityCards.map((c) => <ResponsibilityCard key={c.id} card={c} />)}
        </div>
      </AnimatedSection>

      {/* RUNBOOK */}
      <AnimatedSection>
        <SectionTitle id="runbook" icon={Terminal} title="Como rodar"
          sub="Setup do ambiente e troubleshooting dos erros comuns." />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2.5">
            {setupCommands.map((c) => <CopyCommand key={c.cmd} label={c.label} value={c.cmd} />)}
          </div>
          <div className="space-y-2.5">
            {troubleshootingItems.map((t) => (
              <div key={t.problem} className="rounded-lg border border-border bg-card p-3.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="size-3.5 text-warn" /> {t.problem}
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground"><span className="text-muted-foreground/50">causa:</span> {t.cause}</div>
                <div className="mt-1 flex items-start gap-1.5 text-xs text-foreground/80">
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-ok" /> {t.fix}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/runs" className="text-sm text-primary hover:underline">→ ver Runs</Link>
          <Link to="/agents" className="text-sm text-primary hover:underline">→ ver Agentes</Link>
          <Link to="/decisions" className="text-sm text-primary hover:underline">→ ver Decisões</Link>
          <Link to="/docs" className="text-sm text-primary hover:underline">→ Documentação</Link>
        </div>
      </AnimatedSection>
    </div>
  );
}
