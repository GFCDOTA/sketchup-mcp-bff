# Interior Studio — AI Cockpit (React)

Frontend do **AI Cockpit**: React + TypeScript + Vite + Tailwind + Radix (shadcn-style) +
TanStack Query. Consome **só** o BFF (`/api/*`). É o **único** frontend do projeto — em
produção, o build (`dist/`) é servido pelo próprio BFF na `:8782` (o app vanilla anterior
foi aposentado).

## Arquitetura

```
prod:  browser ──▶ :8782 (BFF serve dist/ + /api/*)
dev:   Vite :5173 ──/api/* (proxy)──▶ BFF :8782
                                        ├── /api/state, /img → ARQUIVOS do motor (studio_mirror)
                                        ├── Ollama :11434 (models, chat)
                                        └── runner (runs, SSE de logs)
```

**Regra inviolável:** o frontend **nunca** chama Ollama nem scripts direto — só `/api/*`.
O BFF é o ponto único de integração com modelos locais, agents, artifacts, logs e decisões.

## Como rodar

```bash
# 1) BFF (serve /api/* do cockpit lendo o motor por arquivo) na 8782
python ../server.py

# 2) frontend (dev, com HMR) — proxy de /api → :8782
npm install
npm run dev          # http://localhost:5173

# build de produção
npm run build        # tsc -b && vite build  → dist/
npm run preview
```

### Sem backend (só visual)

```bash
VITE_MOCKS=1 npm run dev    # usa fixtures tipadas de src/api/mocks.ts
```

### Variáveis (`.env`)

| var | default | uso |
|---|---|---|
| `VITE_BFF_URL` | `http://localhost:8782` | alvo do proxy `/api` em dev |
| `VITE_MOCKS` | `0` | `1` usa mocks tipados em vez do BFF |

## Endpoints consumidos (contrato em `src/api/types.ts`)

`GET /api/status` · `GET /api/models` · `POST /api/models/chat` · `GET /api/agents` ·
`POST /api/agents/:id/run` · `GET /api/runs` · `GET /api/runs/:id` ·
`GET /api/runs/:id/logs` (SSE) · `GET /api/artifacts` · `GET /api/decisions` ·
`POST /api/decisions/:id/respond` · `GET /api/workflows` · `POST /api/workflows/:id/run`

## Estrutura

```
src/
  api/
    types.ts        contrato TS de todos os endpoints (+ payload legado)
    mocks.ts        fixtures tipadas (modo VITE_MOCKS)
    client.ts       fetch tipado + toggle de mocks + streamRunLogs (SSE)
    hooks.ts        hooks TanStack Query + mutations + useRunLogStream
  components/
    ui/             primitivos shadcn-style (button, card, badge, tabs, dialog, …)
    shell/          app-shell, sidebar, topbar, command-palette, conn-badge
    states.tsx · metric.tsx · log-viewer.tsx · timeline.tsx · pipeline.tsx · page-header.tsx
  screens/          overview · agents · runs · run-detail · workflows · models · decisions · artifacts
  store/ui.ts       Zustand (só UI: command palette, drawer)
  config/nav.ts     navegação
  lib/              utils (cn, timeAgo) · status (tom visual)
```

## Telas

- **Visão Geral** — métricas, runs recentes, decisões pendentes, workflow ativo, saúde do sistema.
- **Agentes** — cards com status/modelo/tools + disparo de run.
- **Runs** — histórico filtrável; **Run detail** com timeline + **log viewer ao vivo (SSE)**.
- **Workflows** — recipes (quando usar / inputs / outputs / tools / checklist / riscos) + run.
- **Modelos** — modelos do Ollama + painel "testar prompt" (chat via BFF).
- **Decisões** — inbox de gates (propostas, revisão visual) com responder.
- **Artefatos** — galeria de renders/SKP/reports.

## Próximos passos (arquitetura pronta para)

- Trocar o **runner stub** (em `cockpit_api.py`) por um runner real de agents/workflows.
- Streaming de chat (hoje o BFF usa `stream:false`).
- Empacotar como **PWA / Capacitor** para iOS (a API já é a fronteira certa).
