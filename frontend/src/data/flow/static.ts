// static.ts — dados autorais (não vêm do mapeamento): cards "por que é diferente",
// runbook de setup e troubleshooting, e a categorização das etapas para os filtros.
import type { ResponsibilityCard, TroubleshootingItem, FlowCategory } from "./types";

export const responsibilityCards: ResponsibilityCard[] = [
  { id: "trace", tone: "ok", title: "Rastreabilidade ponta a ponta",
    body: "Do PDF da planta ao .skp aprovado: cada agente, API, gate, artifact e decisão fica registrado e navegável." },
  { id: "gates-first", tone: "info", title: "Gates antes de opinião",
    body: "Validações determinísticas (opening_host, wall_overlap, fidelidade) rodam antes de qualquer veredito visual — fato antes de gosto." },
  { id: "artifacts-truth", tone: "gold", title: "Artifacts como fonte de verdade",
    body: "O .skp/render no disco manda. Idempotência por content-hash: reconstruir o mesmo consensus reusa o artifact em ~0s." },
  { id: "human-gate", tone: "purple", title: "Humano aprova o que é crítico",
    body: "O veredito visual (IMPROVED/SAME/WORSE) nunca é automático — é uma decisão humana, registrada com rastreabilidade." },
  { id: "models-bff", tone: "info", title: "Modelos locais atrás do BFF",
    body: "O Ollama nunca é chamado direto pelo React. Tudo passa por /api/* — o BFF é o ponto único de integração." },
  { id: "auditable", tone: "ok", title: "Runs e logs auditáveis",
    body: "Cada execução tem timeline de steps e logs ao vivo (SSE), com status running/succeeded/failed." },
  { id: "living-docs", tone: "gold", title: "Documentação viva no app",
    body: "Esta tela é gerada a partir do código real dos dois repos — marcando honestamente o que é implementado, mock ou planejado." },
];

export const setupCommands: { label: string; cmd: string }[] = [
  { label: "1) Build do cockpit (uma vez)", cmd: "cd frontend && npm install && npm run build && cd .." },
  { label: "2) BFF — serve o cockpit + API na :8782 (dados lidos por ARQUIVO do motor)", cmd: "python server.py" },
  { label: "Dev do front com HMR (opcional)", cmd: "cd frontend && npm run dev" },
  { label: "Só visual, sem backend (mocks tipados)", cmd: "VITE_MOCKS=1 npm run dev" },
  { label: "Subir os modelos locais", cmd: "ollama serve" },
];

export const troubleshootingItems: TroubleshootingItem[] = [
  { problem: "Porta ocupada (:8782 / :5173)",
    cause: "Outra instância (ou um dev server) ainda está de pé na porta.",
    fix: "Mate o processo da porta e suba de novo. Em dev, o BFF roda na :8782 e o Vite na :5173 — não conflitam." },
  { problem: "Ollama fora do ar (:11434)",
    cause: "O runtime de modelos não está rodando.",
    fix: "`ollama serve`. As telas Modelos/chat tratam offline graciosamente (status + hint), sem quebrar." },
  { problem: "Painéis do Estúdio vazios (agents/renders/decisions)",
    cause: "O studio_mirror não achou os arquivos do motor — ENGINE_ROOT errado ou ausente.",
    fix: "Confira BFF_ENGINE_ROOT (default: pasta irmã ../sketchup-mcp). O painel degrada honesto (vazio), nunca inventa dado." },
  { problem: "O dashboard não reflete a mudança do front",
    cause: "O BFF serve o build (frontend/dist), não o código-fonte.",
    fix: "`npm run build` em frontend/ e dê refresh na :8782 (ou use `npm run dev` na :5173 com HMR)." },
  { problem: "Planta sai inflada (~1.36x)",
    cause: "PT_TO_M não foi setado antes do import de core.scale → escala default 0.0352.",
    fix: "Garanta a escala verificada por planta (planta_74 = 0.0259) antes do build." },
  { problem: "Run não executa de verdade",
    cause: "O runner do cockpit é um STUB (simula steps/logs).",
    fix: "Execução real é a próxima fase (runner → subprocess do pipeline do sketchup-mcp). Por ora, runs são demonstrativos." },
];

/** categoria de cada etapa do fluxo (para os filtros). */
export const stepCategory: Record<string, FlowCategory> = {
  entrada: "pipeline", interpretacao: "pipeline", geracao: "pipeline",
  "04": "gates", "05": "gates", "06": "api", "07": "artifacts",
};

export const CATEGORY_LABEL: Record<FlowCategory | "all", string> = {
  all: "Tudo", pipeline: "Pipeline", gates: "Gates", agents: "Agentes", artifacts: "Artifacts", api: "API",
};
