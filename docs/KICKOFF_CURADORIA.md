# KICKOFF — Dashboard fase CURADORIA (o humano entra no loop pela tela)

> Kickoff no padrão do SESSION_PLAN do sketchup-mcp: estado ancorado no código real,
> fatias com prova, rails invioláveis, prompt pronto pra colar numa sessão nova.
> Escrito 2026-07-04, logo após o loop autônomo rodar sozinho pela primeira vez.

## Por que agora (o gargalo mudou de lugar)

O pipeline autônomo está completo e PRODUZINDO sem humano no laço interno
(FP-032 olho + FP-033 correção + FP-034 variantes + night_feeder + painel de
3 juízes com `design_patterns_observed` — tudo em produção, provado 2026-07-04
de madrugada: feeder enfileirou, atuador drenou, corpus ganhou vereditos).

O gargalo agora é o ÚNICO passo que é do Felipe por regra dura — o veredito
humano — e ele **não tem tela**. Hoje:
- `data/runs/noc_variant_sweep/<plant>/corpus.jsonl` acumula variantes julgadas
  (verdict máquina, 7 eixos, design_patterns_observed, render) → **zero UI**;
- `human_verdict` é `null` em 100% dos registros → **não existe onde preencher**;
- a saúde mostra só um contador ("N task(s) esperando VISUAL_REVIEW") sem link
  pro que revisar.

Curadoria parada = corpus que não vira golden = FP-035 (RAG) treina só com
veredito de máquina. A tela de curadoria é o multiplicador de tudo que já roda.

## Estado real (âncoras de código, verificado 2026-07-04)

- Página única `:8782` autossuficiente: `bridge_mirror.py` (:8765 por arquivo),
  `studio_mirror.py` (ex-:8781 por arquivo), `noc_mirror.py` (ledger NOC).
  Padrão canônico de integração = **ler arquivo, nunca acoplar serviço**.
- Corpus: `corpus.jsonl` append-only, **last-wins por variant_id** (mesma
  semântica de `corpus_to_rag._last_wins` no repo do motor). Registro tem:
  `variant_id, params{style,theme,layout_seed}, verdict (CANDIDATE|FAIL|
  PENDING_VISION), visual_findings{axes[7], findings, design_patterns_observed,
  discriminated}, render_refs{iso,sha256}, human_verdict (SEMPRE null hoje)`.
- Renders das variantes: `data/runs/noc_variant_sweep/<plant>/<variant_id>/iso.png`
  (+ cópias em `artifacts/variant_sweep/<plant>/` nas branches `chore/noc-*`).
- Tela "Decisões" já deriva de propostas + visual review (`_derive_decisions` no
  `cockpit_api.py`) — a curadoria ESTENDE esse conceito, não cria um paralelo.
- `/img/<n>` já serve render do disco com guard anti-traversal — reusar pro
  thumbnail da variante.

## Fatias (cada uma termina em prova na tela viva)

### Fatia 1 — Galeria de variantes julgadas (ler)
Card/tela nova lendo o corpus POR ARQUIVO (padrão mirror): grid de variantes
com thumbnail (iso.png), verdict máquina com selo DISCRIMINATED, os 7 eixos
compactos, e os `design_patterns_observed` (works/fails/neutral com o porquê).
Filtro por verdict e por tema. **Prova**: as 2 variantes reais de hoje
(`warm_compact__L0/L1`, CANDIDATE, 4+6 patterns) renderizando com dado real.

### Fatia 2 — O clique do Felipe (escrever human_verdict)
Botões por variante: `IMPROVED / SAME / WORSE` + campo curto opcional
("melhor pra X"). Gravação POR ARQUIVO no padrão append-only do workspace:
`data/runs/noc_variant_sweep/<plant>/human_verdicts.jsonl`
(`{variant_id, human_verdict, note, t}` — last-wins, mesmo idioma do corpus;
o corpus.jsonl NUNCA é reescrito). A leitura da galeria funde os dois.
⚠️ Regra dura preservada por construção: só este endpoint, acionado por clique
na tela, escreve human_verdict — nenhum job/agente chama ele.
**Prova**: Felipe (ou clique de teste seu, marcado `note:"teste"`) julga L0 na
tela → linha aparece no jsonl → galeria reflete → `corpus_to_rag` passa a ver
o veredito humano (checar se o export já lê; se não, 3 linhas lá).

### Fatia 3 — Padrões acumulados (pré-FP-035 visível)
Card "O que já aprendemos": agregação dos `design_patterns_observed` de TODO o
corpus (contagem works/fails por pattern, agrupado por tema/cômodo quando
inferível do variant_id). É a memória de design ficando visível ANTES do RAG
existir — e vira a spec de fato do que o FP-035 vai indexar.
**Prova**: os ~10 patterns reais de hoje agregados na tela.

## Rails (quebrar = RED)
1. Integração SÓ por leitura de arquivo (padrão mirror). `:8765` nunca tocado.
2. `corpus.jsonl` é do MOTOR — o dashboard nunca escreve nele. Veredito humano
   vive em arquivo próprio (`human_verdicts.jsonl`), append-only.
3. `human_verdict` só nasce de clique na tela. Nenhum agente/job/consult grava.
4. Máquina continua só CANDIDATE|FAIL|PENDING_VISION; IMPROVED/SAME/WORSE é
   exclusivo do humano (negative_dogfood provou; não regride).
5. Deploy: build do frontend + restart :8782 via launcher (Hidden, não
   Minimized — QuickEdit congela o server; gotcha real 2026-07-03).

## Prompt de kickoff (colar numa sessão nova)
```
Contexto: workspace E:\Claude, repo apps/sketchup-mcp-bff (página única :8782,
mirrors por arquivo). Leia docs/KICKOFF_CURADORIA.md primeiro — estado, fatias
e rails estão lá, ancorados no código real.

Tarefa: implementar a fase CURADORIA em 3 fatias (galeria do corpus julgado →
clique do human_verdict em arquivo próprio append-only → card de padrões
acumulados), cada fatia provada na tela viva com o dado REAL de
data/runs/noc_variant_sweep/planta_74/ (2 variantes CANDIDATE com
design_patterns_observed existem desde 2026-07-04).

Método: worktree off origin/develop; commits atômicos; testes no padrão do
repo (tests/test_studio_mirror.py como gabarito de mirror); verificação por
preview/DOM numa instância scratch (:879x) antes de landar; deploy = merge FF
+ npm run build + restart :8782 pelo launcher. Nunca tocar :8765; corpus é
read-only; human_verdict só via clique.
```

## Fora de escopo desta fase
- FP-035 em si (RAG consultável) — a fatia 3 só EXPÕE o insumo.
- Promoção de variante a golden/canônico (continua processo humano fora da tela).
- Puxar veredito do gate/oráculo pra dentro da curadoria (curadoria é do Felipe).
