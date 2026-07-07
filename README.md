# sketchup-mcp-bff — Interior Studio AI Cockpit

**AI Cockpit** (React + TypeScript) + **BFF** (Python) para operar o Interior Studio do
projeto `sketchup-mcp` — o estúdio multi-agente que gera `.skp` fiéis a plantas de PDF e
mobília/renderiza ambientes. Um app só, numa porta só: `http://localhost:8782/`.

```
browser ──▶ :8782  (BFF: serve frontend/dist + /api/* do cockpit)
                 ├── Ollama :11434          (modelos locais — models, chat)
                 ├── runner                 (runs + logs ao vivo via SSE)
                 └── ARQUIVOS do motor      (studio_mirror lê o repo sketchup-mcp direto —
                                             /api/state, /api/kgraph, /api/consult/*, /img/*)
```

> **Arquitetura:** o frontend fala **só** com `/api/*`. Quem conversa com modelos locais,
> lê os arquivos do motor e roda o runner de agents é o **BFF** ([`cockpit_api.py`](cockpit_api.py))
> — nunca o React. **`:8781` não é mais dependência**: todo dado do estúdio é respondido pelo
> próprio BFF lendo o repo do motor por ARQUIVO ([`studio_mirror.py`](studio_mirror.py), padrão
> `bridge_mirror`). O código do estúdio vive em `GFCDOTA/sketchup-mcp` (não é tocado aqui).

## Como rodar

### Docker (recomendado — um comando, assim como o `sketchup-mcp`)

Pré-requisito: **Docker** (Desktop). Igual o motor dockeriza só a sua dashboard, aqui o
compose dockeriza só o **bff** — que builda o React em imagem e reinicia sozinho.

```bash
docker compose up -d --build      # builda o React + sobe o bff(:8782)
#  -> http://localhost:8782/
docker compose logs -f bff        # acompanhar
docker compose down               # parar
```

O **bff** (`:8782`) serve o frontend React + `/api/*`, fala com o **Ollama do host**
(`:11434`) e responde `/api/state` + imagens **lendo o repo do motor** montado **read-only**
em `/repos/sketchup-mcp` (studio_mirror + Live System Map). Não há mais serviço `upstream`
nem `BFF_UPSTREAM` — dados ao vivo = motor montado; sem motor, rode em mock:

```bash
docker build -t interior-studio-bff .                          # builda a imagem primeiro
docker run --rm -p 8782:8782 -e BFF_MOCK=1 interior-studio-bff # cockpit standalone (snapshot)
```

> ⚠️ Com o mount `:ro`, a **única escrita** do cockpit no motor (aprovar/rejeitar proposta)
> degrada com `503` honesto — no host ela funciona (move o JSON em `.ai_bridge/proposals/`).

Topologia e troubleshooting em [`docs/DOCKER.md`](docs/DOCKER.md).

### Manual (sem Docker)

Pré-requisitos: **Python 3.10+** (BFF, stdlib) e **Node 18+** (build do React).

```bash
# 1) build do React (uma vez; gera frontend/dist)
cd frontend && npm install && npm run build && cd ..

# 2) BFF — serve o cockpit + API na 8782 (lê o motor por ARQUIVO; sem :8781)
python server.py
# -> http://127.0.0.1:8782/
```

> O BFF acha o motor pelo `BFF_ENGINE_ROOT` (default: pasta irmã `../sketchup-mcp`).
> Rodando de uma worktree, exporte `BFF_ENGINE_ROOT` explicitamente — senão todos os
> painéis do estúdio degradam pra vazio (honesto, mas inútil).

Desenvolvimento do frontend (HMR, opcional): `cd frontend && npm run dev` (`:5173`, faz
proxy de `/api` pro BFF). Ver [`frontend/README.md`](frontend/README.md).

### Variáveis de ambiente (BFF)

| var | default | descrição |
|---|---|---|
| `BFF_HOST` | `127.0.0.1` | bind (localhost por padrão — não expõe na LAN) |
| `BFF_PORT` | `8782` | porta do BFF |
| `BFF_OLLAMA` | `http://127.0.0.1:11434` | Ollama (modelos locais) |
| `BFF_WEB` | `./frontend/dist` | diretório do build React servido |
| `BFF_MOCK` | *(off)* | `1` serve `mocks/state.sample.json` em `/api/state` (sem motor) |
| `BFF_ENGINE_ROOT` | `../sketchup-mcp` | **repo do motor que o studio_mirror LÊ** (fonte de /api/state, imagens, kgraph, consult) + Live System Map |
| `BFF_SCAN_ROOT` | *(dir do módulo)* | repo do BFF a escanear (separa "o que roda" de "o que se mapeia") |
| `BFF_MARKS_FILE` | `./.file_map_marks.json` | onde persistir marks manuais (protected/legacy/stale) do mapa |

### O que ainda é vivo (fora arquivo)

- **Ollama `:11434`** — status/chat dos modelos locais (sob demanda; off ⇒ agentes `online=false`, honesto).
- **A ÚNICA escrita no motor** = mover proposta `pending → approved|rejected` quando você decide
  no painel Decisões (`.ai_bridge/proposals/`). Com o motor montado read-only (Docker), degrada `503`.
- Ações LLM do dashboard legado (`propose`/`audit` de proposta) **não existem** no cockpit —
  sem arquivo-fonte, sem fabricação (o React nunca as chamou).

## Estrutura

```
server.py            BFF: serve frontend/dist + dispatch do cockpit_api  (stdlib, sem proxy)
cockpit_api.py       endpoints AI (status, models/Ollama, agents, runs+SSE, decisions, workflows)
studio_mirror.py     estúdio por ARQUIVO: /api/state, kgraph, consult, /img — lê o repo do motor
frontend/            app React (Vite + TS + Tailwind + Radix + TanStack Query)
  src/api/           contrato tipado + mocks + client + hooks (Query/SSE)
  src/components/    design system (ui/) + shell (sidebar/topbar/command palette)
  src/screens/       overview · agents · runs · run-detail · workflows · models · decisions · artifacts · docs
mocks/state.sample.json   snapshot real de /api/state (contrato + modo offline)
docs/                INSPECTION.md (histórico) · ARCHITECTURE.md
```

## Telas

| Tela | O que mostra |
|---|---|
| **Visão Geral** | mission control: status, métricas, runs recentes, decisões, workflow ativo |
| **Agentes** | time multi-agente — status, modelo, tools, disparo de run |
| **Runs** | histórico filtrável; o detalhe traz timeline + **log viewer ao vivo (SSE)** |
| **Workflows** | recipes (quando usar · inputs · outputs · tools · checklist · riscos) |
| **Modelos** | modelos do Ollama + testar prompt (via BFF) |
| **Decisões** | gates (propostas, revisão visual) com responder |
| **Artefatos** | renders, SKPs, relatórios (lightbox in-app) |
| **Documentação** | arquitetura, pipeline, guia das telas, base de conhecimento — tudo in-app |
| **Studio Flow** | documentação viva ponta a ponta: timeline interativa, mapa de arquitetura, árvore dos repos, recipes, runbook (gerada do código real, marcando implemented/mock/planned) |

Endpoints e contrato em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) e `frontend/src/api/types.ts`.

## Temas

O cockpit tem **10 temas premium** trocáveis pelo **header** — persistem em `localStorage`,
com transição suave e respeitando `prefers-reduced-motion`. Tudo é **token-driven** (CSS vars
HSL), então o tema propaga em sidebar, header, cards, badges, logs e docs sem hardcode.

- Default: **🌑 Obsidian Agent** (AI cockpit dark premium). Demais: ◼️ Linear Slate, 🟨 Studio Gold,
  🧬 Cyber Grid, 📐 Blueprint Architect, 🟢 Supabase Emerald, 🚀 Raycast Command, 🟣 Cursor Neon,
  🧊 Frosted Glass, ☀️ Minimal Light (claro).
- Compare todos na tela **Theme Lab** (`/theme-lab`) — todos os componentes num lugar só.

### Como adicionar um tema

1. Em `frontend/src/theme/themes.ts`, adicione um objeto `Theme` (tipo em `theme-types.ts`):
   `id`, `name`, `emoji`, `description`, `isDark`, `background` (`none`/`grid`/`mesh`/`glass`/`glow`/`dots`),
   `motion`, `preview` (4 cores hex), `colors` (HSL triplets — ver as chaves em `theme-types.ts`),
   e `glow`/`shadow`/`radius`.
2. Pronto — ele aparece no switcher do header e no Theme Lab automaticamente.

Arquivos: `src/theme/` (`theme-types`, `themes`, `apply-theme`, `theme-provider`, `use-theme`) ·
`src/components/theme/theme-switcher.tsx`.
