# Cockpit (:8782) ↔ NOC — plano de integração

> Como o dashboard :8782 vira o cockpit REAL do NOC autônomo. Decidido por painel de
> design + júri (3 arquiteturas: A *vidro* 9.5 ▸ B *control-plane* 7.3 ▸ C *event-bus* 6.4).
> **Vencedora: A como espinha + enxertos cirúrgicos de B e C.**

## Problema

O cockpit :8782 mostra dados **STUB** (`cockpit_api.py` `_runner` = `time.sleep` + logs
fake, auto-marcado `stub=True`). Enquanto isso, o **NOC faz trabalho autônomo REAL**
(`noc_dispatcher.py`: lê fila → worktree off `develop` → `claude -p` → verify → commit+push
de branch, **nunca main**), mas tudo em arquivo plano, **sem nenhuma UI viva**. Os dois
estão desconectados.

## Princípio

O **atuador pesado (`claude -p`, build) FICA no NOC**. O **:8782 é VIDRO + CONTROLE por
escrita-em-arquivo**. Nenhuma fase edita o código do **:8765/bridge nem os watchdogs PS**
(Hard Rule #1 — frágil/off-limits; já derrubou o :8765 antes).

## Regras duras (inegociáveis)

1. **Um app** — tudo no hub `:8782` (base p/ celular); nenhuma porta nova exposta.
2. **Ler-arquivo > acoplar** — o seam é *tail* de arquivos planos via o `ENGINE_ROOT` que
   `file_activity.py` já resolve. Zero RPC/import do código do motor.
3. **:8765 off-limits** — contato único = `GET /health` (selo verde), degradável, nunca pra atuar.
4. **Honestidade** — STUB nunca é pintado de pronto; live diz live, stub diz stub (justaposição).
5. **Veredito visual** (IMPROVED/SAME/WORSE) = **só Felipe**; nenhuma automação decide aparência.
6. **Candidato ≠ canônico** — worker nunca toca `main`/fixture; só observa branches que o dispatcher empurrou.

## Arquitetura (read-path)

```
NOC (atuador, processo separado, off origin/develop)
  escreve  .ai_bridge/noc/{queue.jsonl, actions.jsonl, dispatcher.lock}
           proposals/pending/*.json ·  runs/local_llm/*.md
     │  (arquivos planos, sem RPC)
     ▼
noc_mirror.py  (BFF, novo · stdlib · irmão de file_activity.py)
   tail/parse → /api/noc/{queue, ledger, proposals, status} + SSE /api/noc/stream
   (cada read → fa.emit(source='noc') → NOC acende no Live System Map de graça)
     ▼
:8782 cockpit  → Fila NOC · Ledger/Branches · Visual Review Inbox · selo NOC vivo/stale
```

Derivações honestas: **última linha por `task_id` vence** (T1: `DRY_RUN` → `COMMITTED`,
confirmado no ledger vivo); `status==VISUAL_REVIEW_QUEUED` vira a fila do gate humano;
`dispatcher.lock` lido via `noc_lock.holder()` (já retorna `None` por TTL stale) → selo
**"NOC vivo / lock stale há Xs"**, nunca "morto".

## Seams (arquivo → endpoint)

| O quê | Arquivo/endpoint | Direção |
|---|---|---|
| Fila de tasks seguras | `.ai_bridge/noc/queue.jsonl` | read |
| Ledger (branches, verify, status terminal) | `.ai_bridge/noc/actions.jsonl` | read |
| Heartbeat do atuador (TTL) | `.ai_bridge/noc/dispatcher.lock` | read |
| Propostas do Architect local | `proposals/pending/*.json` | read |
| Saúde do oráculo (selo verde) | `GET :8765/health` | read |
| Delta ao vivo | `GET /api/noc/stream` (cursor de nº-de-linhas) | stream |
| **Fase 3** — enfileirar task | `POST /api/noc/enqueue` → append `queue.jsonl` | write |
| **Fase 4** — veredito humano | `POST /api/noc/visual-review/<id>` → `reviews.jsonl` | write |

## Plano faseado

### Fase 1 — Espelho read-only (vidro) · **começa aqui**
Trocar os dados STUB por **leitura real** dos arquivos do NOC. Sem write, sem :8765, sem motor.
- `noc_mirror.py`: `load_queue()`, `load_ledger()` (**só as últimas N linhas** — seek do fim, nunca o arquivo inteiro; `errors='replace'` pro mojibake real `'Ã§Ã£o'`), `lock_state()`, `list_proposals()`. Path por `BFF_NOC_ROOT` (default = `ENGINE_ROOT/.ai_bridge/noc`). Arquivo ausente/vazio → `{live:false, reason}` explícito, **nunca mock**.
- Montar `/api/noc/*` em `cockpit_api.dispatch` **antes do proxy**; cada read → `fa.emit(...,'noc')`.
- SSE por **cursor de nº-de-linhas** (não mtime — evita perder a corrida).
- Frontend: `client.ts` + telas `noc-queue.tsx`, `noc-ledger.tsx`, `visual-review-inbox.tsx` (badge LIVE, estado-vazio honesto); selo NOC no `conn-badge.tsx`.
- **Entregável:** abrir `localhost:8782` → fila/ledger REAIS (T1/T2 `COMMITTED` com branch/worktree/verify, do disco); envelhecer o lock muda o selo p/ "stale há Xs"; NOC aceso no Live System Map.
- **Honesty gate:** LIVE = NOC do disco; STUB intacto e rotulado "simulado"; veredito visual só exibido.

### Fase 2 — Runs LIVE do ledger + selo :8765/health
- `runs_view()`: projeta `actions.jsonl` como runs (durabilidade entre restarts do BFF — a verdade vira o disco). `runs.tsx`/`run-detail.tsx` ganham aba "NOC (LIVE)" ao lado do "STUB/simulado".
- Selo `:8765` no topbar: `GET /health` com try/except → verde/cinza, **nunca `POST /ask`**.
- Triplo **online/stalled/offline** (enxerto C) derivado por **leitura pura do TTL**, sem escrever heartbeat.
- **Entregável:** reiniciar o BFF e os runs persistirem; selo :8765 verde/cinza honesto.

### Fase 3 — Write-path: enqueue com allowlist + aposentar o stub
- `enqueue(kind,payload)`: **append atômico** de 1 linha em `queue.jsonl` (`O_APPEND`, nunca rewrite).
- **Allowlist server-side** (enxerto B, como trava): só kinds seguros-e-sem-aparência (`docs`, `summarize_log`, `local_llm`…). Defesa em profundidade: `_appearance_changed` no motor já manda qualquer diff de `.skp/.png/consensus` pra `VISUAL_REVIEW_QUEUED`.
- `_start_run` passa a chamar `enqueue`; aposentar `_runner`/`_seed_runs`/`RUNS{}`; `_problems()` troca "runner-stub" por "NOC fila inacessível" honesto.
- **Entregável:** clicar "Enfileirar" → 1 linha nova em `queue.jsonl` → o dispatcher pega no próximo sweep; kind de aparência → rejeitado server-side. Nenhum dado STUB resta.

### Fase 4 (opcional, gated) — Registrar veredito visual humano
- **Pré-requisito no repo `sketchup-mcp` (tarefa separada):** o dispatcher passar a **consumir** `reviews.jsonl` (IMPROVED=promovível; SAME/WORSE=descarta a BRANCH). **Sem isso, o botão NÃO aparece** (corrige o contrato-fantasma).
- Servir os PNGs do branch via `/img` p/ julgar lado-a-lado; `POST /api/noc/visual-review/<id>` só de clique humano. A máquina **nunca** escreve verdict.

## First slice (ROI máximo, risco mínimo)

`noc_mirror.py` com `load_ledger()` + `lock_state()`, `GET /api/noc/ledger` + `/api/noc/status`,
e uma única tela `noc-ledger.tsx`. Abrir `localhost:8782` e ver os **runs REAIS do NOC** (T1/T2
`COMMITTED` com branch/worktree/verify, lidos do disco) no lugar dos seed STUB, + selo "NOC vivo /
lock stale há Xs". Zero escrita, zero :8765, zero motor. Verificável a olho contra `actions.jsonl`.

## Riscos

- `actions.jsonl` cresce indefinidamente → `load_ledger` **só últimas N linhas** (seek do fim).
- Mojibake real no `out_tail` → `errors='replace'`, não quebrar a serialização JSON.
- SSE por mtime perde a corrida → **cursor por nº-de-linhas/seq**.
- `dispatcher.lock` só renovado em `--loop` → o selo diz "stale há Xs" (interpretação), nunca "morto".
- `BFF_NOC_ROOT` configurável → evita o BFF olhar o `.ai_bridge` de outro worktree.

## Referência
- Estado real × stub: `../../sketchup-mcp/.claude/specs/autonomous_planta_prep.md` (NOC night-shift)
- Cockpit atual: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- NOC/atuador: memória `reference_noc_dispatcher`, `reference_sketchup_cockpit_gate`
