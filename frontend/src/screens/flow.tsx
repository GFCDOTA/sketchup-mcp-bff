import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Workflow as WorkflowIcon, Network, FolderTree, Bot, Plug, Package,
  Sparkles, Terminal, Cpu, Wrench, AlertTriangle, ArrowRight, Wand2, Scale,
  ChevronDown, ChevronRight,
} from "lucide-react";
import {
  flowSteps, architectureLayers, bffTree, engineTree, recipes, agentDocs,
  endpointDocs, artifactDocs, responsibilityCards, setupCommands, troubleshootingItems,
  skillDocs, specDocs, stepCategory, CATEGORY_LABEL, type FlowCategory,
} from "@/data/flow";
import { cn } from "@/lib/utils";
import { FlowHero } from "@/components/flow/flow-hero";
import { DecisionFlowSection } from "@/components/flow/decision-flow-diagram";
import { PipelineSection } from "@/components/flow/pipeline-diagram";
import { ArchitectureSection } from "@/components/flow/architecture-diagram";
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

// Página enxuta (feedback Felipe 2026-07-07): 3 DIAGRAMAS no topo + runbook curto;
// todo o detalhe denso (pipeline passo-a-passo, repos, skills, API, artifacts, agentes)
// vive COLAPSADO em "Detalhes técnicos" — a página não é mais um paredão.
const SECTIONS = [
  { id: "decisoes-fluxo", label: "Decisões", icon: Scale },
  { id: "pipeline", label: "Pipeline", icon: WorkflowIcon },
  { id: "arquitetura", label: "Arquitetura", icon: Network },
  { id: "runbook", label: "Rodar", icon: Terminal },
  { id: "detalhes", label: "Detalhes", icon: FolderTree },
];

const STEP_CATS: (FlowCategory | "all")[] = ["all", "pipeline", "gates", "api", "artifacts"];

// ids que vivem DENTRO de "Detalhes técnicos" (deep-links precisam expandir a seção)
const DETAIL_IDS = new Set(["fluxo", "repos", "skills", "recipes", "agentes", "api", "artifacts"]);

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
  const [showDetails, setShowDetails] = useState(false);
  const { hash } = useLocation();

  // deep-link (ex.: clique num log → /flow#api) → expande Detalhes se preciso e rola
  useEffect(() => {
    if (!hash) return;
    const id = hash.replace("#", "");
    if (DETAIL_IDS.has(id)) setShowDetails(true);
    const t = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("ring-2", "ring-primary/40", "rounded-lg");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary/40", "rounded-lg"), 1600);
      }
    }, 160);
    return () => clearTimeout(t);
  }, [hash]);

  const visible = cat === "all" ? flowSteps : flowSteps.filter((s) => stepCategory[s.id] === cat);
  useEffect(() => {
    if (!visible.find((s) => s.id === selId)) setSelId(visible[0]?.id ?? flowSteps[0]?.id ?? "");
  }, [cat]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = flowSteps.find((s) => s.id === selId) ?? flowSteps[0];

  const goTo = (id: string) => {
    if (id === "detalhes" || DETAIL_IDS.has(id)) setShowDetails(true);
    // deixa o React pintar o conteúdo expandido antes de rolar
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  };

  return (
    <div className="space-y-10">
      <FlowHero onSeeFlow={() => goTo("decisoes-fluxo")} />

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

      {/* DECISÕES */}
      <AnimatedSection>
        <SectionTitle id="decisoes-fluxo" icon={Scale} title="Como as decisões fluem"
          sub="Quem decide o quê, e pra onde vão os rejeitados — de relance." />
        <DecisionFlowSection />
      </AnimatedSection>

      {/* PIPELINE */}
      <AnimatedSection>
        <SectionTitle id="pipeline" icon={WorkflowIcon} title="Do PDF ao .skp"
          sub="O pipeline em 7 etapas — do consensus ao artefato aprovado." />
        <PipelineSection />
      </AnimatedSection>

      {/* ARQUITETURA */}
      <AnimatedSection>
        <SectionTitle id="arquitetura" icon={Network} title="Arquitetura"
          sub="Do browser ao motor — o React fala só com /api/*, o BFF lê o motor por arquivo." />
        <ArchitectureSection />
      </AnimatedSection>

      {/* RUNBOOK */}
      <AnimatedSection>
        <SectionTitle id="runbook" icon={Terminal} title="Como rodar"
          sub="Setup do ambiente e os erros comuns." />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2.5">
            {setupCommands.map((c) => <CopyCommand key={c.cmd} label={c.label} value={c.cmd} />)}
          </div>
          <div className="space-y-2.5">
            {troubleshootingItems.slice(0, 5).map((t) => (
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
          <Link to="/decisions" className="text-sm text-primary hover:underline">→ ver Decisões</Link>
          <Link to="/operacao" className="text-sm text-primary hover:underline">→ ver Operação</Link>
          <Link to="/docs" className="text-sm text-primary hover:underline">→ Documentação</Link>
        </div>
      </AnimatedSection>

      {/* DETALHES TÉCNICOS — tudo que era paredão, agora colapsado */}
      <AnimatedSection>
        <button
          id="detalhes"
          onClick={() => setShowDetails((v) => !v)}
          className="flex w-full scroll-mt-4 items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-border/70"
        >
          {showDetails ? <ChevronDown className="size-4 shrink-0 text-primary" /> : <ChevronRight className="size-4 shrink-0 text-primary" />}
          <FolderTree className="size-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold">Detalhes técnicos</span>
          <span className="hidden truncate text-xs text-muted-foreground/60 sm:inline">
            pipeline passo-a-passo · repositórios · skills &amp; specs · recipes · agentes · API · artifacts
          </span>
          <span className="ml-auto text-[11px] text-muted-foreground/50">{showDetails ? "esconder" : "abrir"}</span>
        </button>

        {showDetails && (
          <div className="mt-6 space-y-10">
            {/* FLUXO interativo (passo-a-passo denso) */}
            <div>
              <SectionTitle id="fluxo" icon={WorkflowIcon} title="Pipeline passo-a-passo"
                sub="Cada etapa em detalhe — clique numa para inputs, scripts, gates e erros comuns." />
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
            </div>

            {/* MAPA DE ARQUITETURA (camadas em texto — o resumo visual está acima) */}
            <div>
              <SectionTitle icon={Network} title="Camadas (detalhe)"
                sub="As 9 camadas do browser ao motor, uma a uma." />
              <ArchitectureMap layers={architectureLayers} />
            </div>

            {/* REPOS */}
            <div>
              <SectionTitle id="repos" icon={FolderTree} title="Estrutura dos repositórios"
                sub="O cockpit/BFF e as pastas-chave do motor." />
              <div className="grid gap-4 lg:grid-cols-2">
                <ProjectTree title="sketchup-mcp-bff/  (cockpit + BFF)" nodes={bffTree} accent="gold" />
                <ProjectTree title="sketchup-mcp/  (motor — não modificado)" nodes={engineTree} accent="blue" />
              </div>
            </div>

            {/* SKILLS & SPECS */}
            <div>
              <SectionTitle id="skills" icon={Wand2} title={`Skills do estúdio (${skillDocs.length})`}
                sub="A esteira agêntica do motor (.claude/skills)." />
              <SkillsGrid skills={skillDocs} />
              <div className="mt-8">
                <SectionTitle icon={FolderTree} title={`Specs (${specDocs.length})`}
                  sub="O contrato vivo do motor (.claude/specs)." />
                <SpecsList specs={specDocs} />
              </div>
            </div>

            {/* RECIPES */}
            <div>
              <SectionTitle id="recipes" icon={Sparkles} title="Recipes / Workflows"
                sub="Receitas reproduzíveis: quando usar, inputs, outputs, checklist, riscos." />
              <div className="grid gap-4 lg:grid-cols-2">
                {recipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}
              </div>
            </div>

            {/* AGENTES */}
            <div>
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
            </div>

            {/* API */}
            <div>
              <SectionTitle id="api" icon={Plug} title="Endpoints da API"
                sub="O contrato que o React consome — todos same-origin, via o BFF." />
              <div className="space-y-2">
                {endpointDocs.map((ep) => <ApiEndpointCard key={ep.method + ep.path} ep={ep} />)}
              </div>
            </div>

            {/* ARTIFACTS */}
            <div>
              <SectionTitle id="artifacts" icon={Package} title="Artifacts & lifecycle"
                sub="Tipos de artefatos, de onde vêm e o ciclo de vida." />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {artifactDocs.map((a) => <ArtifactLifecycle key={a.type} artifact={a} />)}
              </div>
            </div>

            {/* POR QUE É DIFERENTE */}
            <div>
              <SectionTitle icon={Sparkles} title="Por que é diferente" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {responsibilityCards.map((c) => <ResponsibilityCard key={c.id} card={c} />)}
              </div>
            </div>
          </div>
        )}
      </AnimatedSection>
    </div>
  );
}
