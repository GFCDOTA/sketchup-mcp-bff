import type { TreeNode } from "./types";

export const bffTree: TreeNode[] = [
  {
    "path": "sketchup-mcp-bff/server.py",
    "role": "BFF principal (:8782) — serve frontend/dist + faz dispatch para cockpit_api; /api desconhecido → 404 JSON, vitrine retirada → 410; modo BFF_MOCK lê mocks/"
  },
  {
    "path": "sketchup-mcp-bff/cockpit_api.py",
    "role": "Endpoints nativos do cockpit (status/models/chat/agents/runs/workflows/artifacts/decisions + state/kgraph/consult/img via studio_mirror); chat Ollama REAL, runner de runs STUB"
  },
  {
    "path": "sketchup-mcp-bff/studio_mirror.py",
    "role": "Espelho por ARQUIVO do estúdio (:8781 aposentado) — /api/state completo, kgraph, consult e imagens lidos direto do repo do motor; única escrita = mover proposta aprovada/rejeitada"
  },
  {
    "path": "sketchup-mcp-bff/mocks/state.sample.json",
    "role": "Snapshot real do /api/state (40KB) servido quando BFF_MOCK=1 (sem motor no disco)"
  },
  {
    "path": "sketchup-mcp-bff/docs/ARCHITECTURE.md",
    "role": "Doc da arquitetura BFF (diagrama browser→:8782→arquivos do motor, tabela de roteamento e fontes de dados)"
  },
  {
    "path": "sketchup-mcp-bff/docs/INSPECTION.md",
    "role": "Doc de inspeção/levantamento"
  },
  {
    "path": "sketchup-mcp-bff/frontend/",
    "role": "App React (Vite+TS+Tailwind+Radix+TanStack Query+React Router); build estático em dist/"
  },
  {
    "path": "sketchup-mcp-bff/frontend/dist/",
    "role": "Build estático servido pelo server.py (index.html + assets/)"
  },
  {
    "path": "sketchup-mcp-bff/frontend/src/App.tsx",
    "role": "Router: rotas / agents runs runs/:id workflows models decisions artifacts docs dentro do AppShell"
  },
  {
    "path": "sketchup-mcp-bff/frontend/src/api/client.ts",
    "role": "Cliente HTTP tipado — frontend fala SÓ com /api/*; SSE p/ logs de run; flag USE_MOCKS"
  },
  {
    "path": "sketchup-mcp-bff/frontend/src/api/types.ts",
    "role": "Contrato TS dos endpoints (StatusResponse, AgentsResponse, RunDetail, etc.)"
  },
  {
    "path": "sketchup-mcp-bff/frontend/src/api/hooks.ts",
    "role": "Hooks TanStack Query sobre o client"
  },
  {
    "path": "sketchup-mcp-bff/frontend/src/api/mocks.ts",
    "role": "Fixtures tipadas (31KB) usadas quando VITE_MOCKS=1"
  },
  {
    "path": "sketchup-mcp-bff/frontend/src/config/nav.ts",
    "role": "Registro de navegação (2 seções: Cockpit / Modelos & Decisões) com badges runs/decisions"
  },
  {
    "path": "sketchup-mcp-bff/frontend/src/screens/",
    "role": "9 telas: overview, agents, runs, run-detail, workflows, models, decisions, artifacts, docs"
  },
  {
    "path": "sketchup-mcp-bff/frontend/src/components/shell/",
    "role": "App shell: app-shell, sidebar, topbar, command-palette, conn-badge"
  },
  {
    "path": "sketchup-mcp-bff/frontend/src/components/ui/",
    "role": "Primitivos shadcn-style (button, card, dialog, badge, tabs, input, etc.)"
  },
  {
    "path": "sketchup-mcp-bff/frontend/src/components/",
    "role": "Componentes de domínio: log-viewer, pipeline, timeline, metric, states, page-header"
  },
  {
    "path": "sketchup-mcp-bff/frontend/src/store/ui.ts",
    "role": "UI-state (Zustand) — ex.: command palette aberto/fechado"
  },
  {
    "path": "sketchup-mcp-bff/frontend/src/lib/",
    "role": "Utilidades (status.ts, utils.ts)"
  }
];

export const engineTree: TreeNode[] = [
  {
    "path": "sketchup-mcp/tools/",
    "role": "Motor: ~120 scripts Python/Ruby do pipeline PDF→.skp, builders de móvel, gates determinísticos, renderers, dashboard"
  },
  {
    "path": "sketchup-mcp/tools/studio_dashboard.py",
    "role": "Dashboard legado do motor (:8781) — NÃO é mais dependência do cockpit: o studio_mirror lê os mesmos arquivos direto"
  },
  {
    "path": "sketchup-mcp/tools/build_plan_shell_skp.py",
    "role": "Núcleo: consensus.json → casca .skp (paredes/aberturas/cômodos); par .rb gera a geometria 3D"
  },
  {
    "path": "sketchup-mcp/tools/ollama_bridge.py",
    "role": "Ponte p/ modelos locais Ollama (:11434) usados pelos agentes do estúdio"
  },
  {
    "path": "sketchup-mcp/tools/interior_studio/",
    "role": "Estúdio multi-agente: architect_program, cycles, interns, proposals, project_state, render_judge, theme_registry"
  },
  {
    "path": "sketchup-mcp/tools/interior_studio/project_state.py",
    "role": "Constrói o estado consumido pelo /api/state (agents/proposals/consult/...) — fonte dos dados derivados do BFF"
  },
  {
    "path": "sketchup-mcp/tools/interior_studio/consult_gpt_bridge/",
    "role": "Ponte de consulta ao GPT (veredito visual / oracle modo B)"
  },
  {
    "path": "sketchup-mcp/tools/claude_bridge/",
    "role": "Bridge/NOC: server.py (88KB), noc_dispatcher, ollama_client, dashboard.html legado, pr_history"
  },
  {
    "path": "sketchup-mcp/tools/mcp_server/",
    "role": "Servidor MCP (fatia-1) + smoke/stdio_check"
  },
  {
    "path": "sketchup-mcp/tools/pdf_knowledge/",
    "role": "Extração de conhecimento do PDF da planta"
  },
  {
    "path": "sketchup-mcp/tools/prompts/",
    "role": "Prompts dos agentes/oráculos"
  },
  {
    "path": "sketchup-mcp/tools/vitrine/",
    "role": "Páginas-vitrine legadas (explica/grafo/flow/agents .html) — retiradas do cockpit (410); só o kgraph.json ainda é lido (/api/kgraph)"
  },
  {
    "path": "sketchup-mcp/.claude/",
    "role": "Config agêntica: agents/ (4 .md), skills/ (18), constitution.md, memory/, specs/, plans/, evals/"
  },
  {
    "path": "sketchup-mcp/.claude/agents/",
    "role": "4 agentes: interior-pm, interior-orchestrator, interior-designer, reference-scout"
  },
  {
    "path": "sketchup-mcp/fixtures/",
    "role": "Insumos de teste: planta_74/, quadrado/, scene_intents/, synthetic_rooms/, visual_oracle_examples|negative/"
  },
  {
    "path": "sketchup-mcp/fixtures/planta_74/",
    "role": "consensus + anotações humanas (paredes/aberturas/soft barriers) da planta principal"
  },
  {
    "path": "sketchup-mcp/artifacts/",
    "role": "Saídas geradas: planta_74/, canonical/, review/, kitchen_research/, reference_lab/, _archive/"
  },
  {
    "path": "sketchup-mcp/artifacts/planta_74/",
    "role": "Deliverables: planta_74.skp (+metadata), renders top/iso/floors, geometry_report.json, furnished/, design_intent/"
  },
  {
    "path": "sketchup-mcp/interior/",
    "role": "Pacote do estúdio: class_specs, composer, planners, renderers, schemas"
  },
  {
    "path": "sketchup-mcp/core/scale.py",
    "role": "Núcleo de escala/unidades"
  },
  {
    "path": "sketchup-mcp/schemas/visual_findings.schema.json",
    "role": "Schema dos achados visuais do Visual Oracle"
  }
];
