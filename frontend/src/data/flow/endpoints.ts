import type { EndpointDoc } from "./types";

export const endpointDocs: EndpointDoc[] = [
  {
    "method": "GET",
    "path": "/api/status",
    "summary": "Saúde do cockpit: motor legível por ARQUIVO (ENGINE_ROOT) + Ollama + contagem de modelos",
    "dataSource": "_status(): fa.ENGINE_ROOT acessível (studio_mirror lê arquivos) + _ollama_get('/api/tags') (:11434)",
    "status": "implemented"
  },
  {
    "method": "GET",
    "path": "/api/models",
    "summary": "Lista modelos locais do Ollama (nome, família, tamanho, quantização)",
    "dataSource": "_ollama_models() → Ollama /api/tags (:11434); se inacessível retorna ok:false com hint",
    "status": "implemented"
  },
  {
    "method": "POST",
    "path": "/api/models/chat",
    "summary": "Chat com um modelo local (model+messages obrigatórios); valida e mede tookMs",
    "dataSource": "_ollama_chat() → POST Ollama /api/chat (:11434), stream=false; 503 se unreachable",
    "status": "implemented"
  },
  {
    "method": "GET",
    "path": "/api/agents",
    "summary": "Lista agentes (id, nome, role, modelo, status normalizado, tools) das umbrellas",
    "dataSource": "_derive_agents(_upstream_state()) — derivado de state.agents.umbrellas + tabela _AGENT_META",
    "status": "implemented"
  },
  {
    "method": "GET",
    "path": "/api/workflows",
    "summary": "Workflows/recipes: ciclo de fidelidade (do factory) + 2 canned (curate-refpack, render-vray)",
    "dataSource": "_derive_workflows(_upstream_state()) — derivado de overview.active_focuses.pipeline + factory + learning; 'curate'/'render-vray' são fixos no código",
    "status": "implemented"
  },
  {
    "method": "GET",
    "path": "/api/artifacts",
    "summary": "Artefatos: até 40 renders + entrada do Reference Pack",
    "dataSource": "_derive_artifacts(_upstream_state()) — derivado de state.renders[] e state.refpack",
    "status": "implemented"
  },
  {
    "method": "GET",
    "path": "/api/decisions",
    "summary": "Decisões pendentes: propostas de programa + veredito visual (Consult GPT)",
    "dataSource": "_derive_decisions(_upstream_state()) — derivado de state.proposals.pending[] e state.consult.status",
    "status": "implemented"
  },
  {
    "method": "GET",
    "path": "/api/runs",
    "summary": "Histórico de runs (sumários ordenados por startedAt desc)",
    "dataSource": "Registry RUNS em memória; _seed_runs() semeia a partir de state.sessions.claims; runner é STUB",
    "status": "mock"
  },
  {
    "method": "GET",
    "path": "/api/runs/{id}",
    "summary": "Detalhe de um run (steps, logs, inputs/outputs, artifactIds); 404 se não existe",
    "dataSource": "Registry RUNS em memória (objeto preenchido pelo _runner STUB)",
    "status": "mock"
  },
  {
    "method": "GET",
    "path": "/api/runs/{id}/logs",
    "summary": "Logs do run: SSE (text/event-stream, com heartbeat e event:end) ou JSON (?format=json)",
    "dataSource": "run.logs do registry em memória; linhas geradas pelo _runner STUB (não logs reais de um agente)",
    "status": "mock"
  },
  {
    "method": "POST",
    "path": "/api/agents/{id}/run",
    "summary": "Dispara um run do agente; resolve nome/modelo via _derive_agents e retorna runId",
    "dataSource": "_start_run('agent',...) → cria run no registry e dispara thread _runner (STUB com sleeps)",
    "status": "mock"
  },
  {
    "method": "POST",
    "path": "/api/workflows/{id}/run",
    "summary": "Dispara um run de workflow; monta steps a partir do workflow e retorna runId",
    "dataSource": "_start_run('workflow',...) → cria run no registry e dispara thread _runner (STUB)",
    "status": "mock"
  },
  {
    "method": "POST",
    "path": "/api/decisions/{id}/respond",
    "summary": "Responde uma decisão pendente; valida id contra as decisões reais (404 se desconhecida)",
    "dataSource": "_decide(): para proposta de programa MOVE o arquivo .ai_bridge/proposals/pending→approved|rejected (studio_mirror.decide_proposal — única escrita no motor; mount :ro degrada 503); 'visual-review' é só reconhecido, não encaminhado",
    "status": "implemented"
  }
];
