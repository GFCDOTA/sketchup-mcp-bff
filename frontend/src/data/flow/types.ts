// types.ts — modelos da documentação viva (Studio Flow). Conteúdo gerado a partir do
// mapeamento real dos repos sketchup-mcp + sketchup-mcp-bff (não inventado).
export type FlowStatus = "implemented" | "mock" | "planned";

export interface FlowStep {
  id: string;
  title: string;
  timelineLabel: string;
  status: FlowStatus;
  objetivo: string;
  inputs: string[];
  outputs: string[];
  scripts: string[];
  apis: string[];
  artifacts: string[];
  gates: string[];
  errosComuns: string[];
  debug: string[];
}

export interface Recipe {
  id: string;
  name: string;
  whenToUse: string;
  inputs: string[];
  outputs: string[];
  tools: string[];
  checklist: string[];
  risks: string[];
  runbook: string[];
  status: FlowStatus;
}

export interface AgentDoc {
  id: string;
  name: string;
  role: string;
  model: string;
  inputs: string[];
  outputs: string[];
  tools: string[];
  status: FlowStatus;
}

export interface ArtifactDoc {
  type: string;
  description: string;
  examplePath: string;
  origin: string;
  lifecycle: string;
  status: FlowStatus;
}

export interface TreeNode {
  path: string;
  role: string;
}

export interface Layer {
  name: string;
  detail: string;
  status: FlowStatus;
}

export interface EndpointDoc {
  method: string;
  path: string;
  summary: string;
  dataSource: string;
  status: FlowStatus;
}

export interface ResponsibilityCard {
  id: string;
  title: string;
  body: string;
  tone: "ok" | "info" | "gold" | "purple" | "warn";
}

export interface TroubleshootingItem {
  problem: string;
  cause: string;
  fix: string;
}

export type SkillTrack = "pipeline" | "gates" | "interiores" | "decisao" | "ops";

export interface SkillDoc {
  name: string;
  summary: string;
  track: SkillTrack;
}

export interface SpecDoc {
  file: string;
  title: string;
  summary: string;
}

/** filtros da tela (categorias de etapa) */
export type FlowCategory = "pipeline" | "gates" | "agents" | "artifacts" | "api";
