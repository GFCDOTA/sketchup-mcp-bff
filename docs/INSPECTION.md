# Inspeção — dashboard `http://localhost:8782/`

> Levantamento feito **antes** de qualquer mudança de UI, para preservar o domínio do
> app e não quebrar o que já funciona. Este é o ponto de partida do redesign que vive
> neste repositório (`sketchup-mcp-bff`).

## O que serve a porta 8782

| | |
|---|---|
| **App** | INTERIOR STUDIO — *live dashboard* (cockpit multi-agente do projeto `sketchup-mcp`) |
| **Arquivo** | `sketchup-mcp/tools/studio_dashboard.py` (~2008 linhas) |
| **Repo de origem** | `GFCDOTA/sketchup-mcp` — **não** é este repo; não é tocado por este projeto |
| **Stack** | Python `http.server` (stdlib pura, sem venv/build). HTML + CSS + JS **vanilla, tudo inline** numa única string `PAGE` (~94 KB). |
| **Modelo de render** | O cliente faz *polling* de `GET /api/state` e re-renderiza tudo no browser. |

> **Não é System Design.** É o estúdio de interiores multi-agente (PM · Team Lead ·
> Arquiteto) que orquestra a mobília/render de plantas do `sketchup-mcp`.

## Superfície de API (contrato estável que o novo frontend consome)

**GET**

- `GET /api/state` — payload único com todo o estado (ver contrato abaixo).
- `GET /api/consult/state`, `/api/consult/latest-question`, `/api/consult/latest-answer`
- `GET /api/kgraph` — grafo de conhecimento (JSON).
- `GET /img/<png>` — renders (`artifacts/.../kitchen_angles`).
- `GET /inbox-img/<img>` — imagens da inbox de referência.
- Páginas da "vitrine" servidas na mesma porta: `/explica`, `/grafo`, `/fluxo`,
  `/como-funciona`, `/agents`, `/single-agent`, `/multi-agent`, `/vitrine`.

**POST** (ações; corpo JSON) — ~25 endpoints, entre eles:
`/api/curate`, `/api/flag`, `/api/ask`, `/api/upload`, `/api/clear`, `/api/consensus`,
`/api/preview`, `/api/feed`, `/api/forget`, `/api/consult/{question,answer,ingest,learn,relay-request,ask-openai}`,
`/api/team-ask`, `/api/scout-search`, `/api/move`, `/api/cycle`, `/api/curate-ref`,
`/api/gpt-bundle`, `/api/refpack-images`, `/api/patch`, `/api/proposal`.

## Contrato de `GET /api/state`

Chaves de topo (capturado em `mocks/state.sample.json`):

| chave | tipo | conteúdo |
|---|---|---|
| `overview` | obj | **Mission control**: `project`, `active_focuses[]` (com `pipeline[]` de 8 passos), `rooms[]` |
| `factory` | obj | ciclo atual: `cycle_id`, `room`, `asset`, `microtask`, `status`, `next_action`, `references{}` |
| `agents` | obj | `umbrellas[]` (PM/Team Lead/Arquiteto + subs), `feed[]`, `metrics{}`, `model_usage{}` |
| `backlog` | obj | `total/geo/pele/done` + `tasks[]` (`mt`, `what`, `status`) |
| `sessions` | obj | `worktrees[]`, `claims[]` (coordenação multi-sessão) |
| `proposals` | obj | `pending/approved/rejected[]` — Arquiteto propõe programa do cômodo |
| `refpack` | obj | Reference Pack curado: `theme`, `direction`, `references[]`, `counts{}` |
| `renders` | list | galeria de PNGs (`name`, `theme`, `sub`, `kb`, `mtime`) |
| `learning` | obj | `new_rules[]`, `anti_patterns[]`, `golden_samples[]` |
| `patches` | obj | LEARNING_PATCH: `patches[]`, `counts{}` |
| `consult` | obj | ponte Consult GPT: `status`, `bridge_mode`, `openai_enabled` |
| `inbox` | list | itens de referência recebidos |
| `references` | obj | `by_kind`, `by_theme` |
| `knowledge` | obj | estado do conhecimento alimentado pelo Felipe |

## Crítica (resumo)

**Bom (preservar):** identidade dark + dourado; já há tokens CSS rudimentares; modelo de
domínio rico que mapeia bem numa navegação de produto.

**A melhorar:**

1. Sem *app shell* — scroll único de ~6000px de cards `resize:both` + drag-to-reorder.
2. Densidade sem hierarquia — títulos ALL-CAPS gigantes com emoji, sem padrão de header.
3. Emoji como ícone em tudo, sem sistema de ícones.
4. Status ad hoc — dezenas de classes one-off, sem componente unificado de *status pill*.
5. Logs/feed apertados, sem coloração por nível nem histórico de runs legível.
6. Cores não gerenciadas (muitos hex hardcoded fora dos tokens).
7. Sem estados de *empty / loading / error*.
8. Inviável de manter — ~1300 linhas de JS dentro de uma string Python.

## Decisão de arquitetura

O código vive em `GFCDOTA/sketchup-mcp` (repo que **não** tocamos). Portanto o frontend
melhorado vive **aqui** (`sketchup-mcp-bff`) como um **BFF fino**: serve a UI nova na
`:8782` e responde `/api/*` (e imagens) **lendo os arquivos do motor por conta própria**
(`studio_mirror.py`). *(Histórico: a primeira versão fazia proxy pro `studio_dashboard.py`
em `:8781`; o proxy foi aposentado — `:8781` não é mais dependência.)*

```
browser ──▶ :8782 (sketchup-mcp-bff: server.py + cockpit_api + studio_mirror) ──lê ARQUIVOS──▶ repo sketchup-mcp
```
