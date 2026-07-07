import type { Recipe } from "./types";

export const recipes: Recipe[] = [
  {
    "id": "cycle-esteira-asset",
    "name": "Esteira do ciclo de asset (PM → Team Lead → Scout → Felipe curadoria → Architect → Gates → Consult → Learning)",
    "whenToUse": "Quando um asset de móvel (sofá, cama, etc.) precisa avançar no pipeline de fidelidade do cômodo: da referência visual até o build/render aprovado. É o LOOP canônico do Interior Studio, rastreado como entidade CYCLE.",
    "inputs": [
      "asset (ex.: sofa)",
      "microtask (ex.: MT-SOFA-004)",
      "room/project (planta_74, living)",
      "referências visuais (links/imagens) para o Reference Pack"
    ],
    "outputs": [
      "CYCLE-NNN.json em .ai_bridge/interior_cycles/ com timeline das 8 etapas",
      "Reference Pack curado (references/felipe/<bucket>/<ref_id>.json + status no pack)",
      "furniture_program proposal aprovada",
      "build spec / classe de móvel + renders quando destravado"
    ],
    "tools": [
      "tools/interior_studio/cycles.py",
      "tools/interior_studio/reference_packs.py",
      "tools/interior_studio/architect_program.py",
      "tools/interior_studio/interns.py",
      "tools/interior_studio/render_judge.py",
      "tools/ollama_bridge.py",
      "tools/interior_studio/gpt_review_bundle.py"
    ],
    "checklist": [
      "Reference Scout buscou referências e gerou o pack (references.pack_id preenchido)",
      "Felipe curou: marcou ⭐ PRINCIPAL (👍 aprovar NÃO basta) — senão architect_blocked=true",
      "Arquiteto (deepseek) propôs furniture_program; gate determinístico normalize_program corrigiu CORE/cross-cômodo",
      "Estagiários (interns.py) revisaram o programa (pertencimento/completude/nomenclatura/capacidade/redundância/estilo)",
      "Consult GPT: pergunta gerada e resposta ingerida → vira Learning Patch",
      "Veredito visual final pelo Felipe/GPT (NUNCA auto)"
    ],
    "risks": [
      "Arquiteto fica BLOQUEADO permanentemente se Felipe nunca marcar ⭐ principal (regra-trava em cycles.architect_blocked)",
      "LLM local (deepseek-r1) cospe JSON sujo / item cross-cômodo — mitigado por normalize_program + fallback qwen-format",
      "Auto-julgar aparência é proibido: IMPROVED/SAME/WORSE/PASS só do Felipe/GPT",
      "Ollama offline degrada estagiário de estilo e architect_program para SKIPPED/erro"
    ],
    "runbook": [
      "cycles.new_cycle(asset=..., microtask=..., mode=..., room=..., project=...) cria o CYCLE-NNN",
      "reference_packs.curate(pack_id, ref_id, 'main') marca a ⭐ principal (destrava o Arquiteto)",
      "python -m tools.interior_studio.architect_program <room_id> deepseek --save → furniture_program pending",
      "interns.review_program(prog) / gaps_for_program(prog) para vereditos por tema",
      "gpt_review_bundle.build(state) gera o pacote pro Consult GPT; resposta ingerida vira learning patch",
      "cycles.set_step(cid, agent, status, ...) registra avanço; cycles.derive_status recalcula o estado ao vivo"
    ],
    "status": "implemented"
  },
  {
    "id": "furniture-program-proposal",
    "name": "Proposta de programa de mobiliário do cômodo (Arquiteto LLM + gate determinístico)",
    "whenToUse": "Quando um cômodo da planta_74 precisa decidir QUE móveis existem nele (não como renderizar), respeitando área real e DNA de estilo. Substitui o ROOMS hardcoded por uma PROPOSAL que o Felipe aprova.",
    "inputs": [
      "room_id do consensus (ex.: r002, r004)",
      "dims reais da planta (consensus_regenerated.json × PT_TO_M=0.0259)",
      "felipe_style_dna.md (DNA canônico, RESTRIÇÃO)",
      "assets já existentes no cômodo (project_state)"
    ],
    "outputs": [
      "proposal furniture_program_<room_id>.json em .ai_bridge/proposals/pending/",
      "items[] {asset, priority, reason}",
      "gate report {removed (cross-cômodo), injected (CORE faltante)}"
    ],
    "tools": [
      "tools/interior_studio/architect_program.py",
      "tools/interior_studio/proposals.py",
      "tools/interior_studio/project_state.py",
      "tools/ollama_bridge.py (deepseek-r1:14b + qwen2.5-coder format)"
    ],
    "checklist": [
      "room_context lido (dims + DNA + existing)",
      "LLM (deepseek) propôs items; se JSON sujo, qwen reformata o raciocínio",
      "normalize_program removeu item exclusivo de outro cômodo e injetou CORE faltante",
      "proposal salva como pending (requires_approval=True — nada entra direto)",
      "Felipe aprova/rejeita no dashboard (proposals.approve/reject)"
    ],
    "risks": [
      "deepseek prefixa item com cômodo errado (banheiro_cooktop) — _strip_room_prefix trata",
      "CORE ausente (cozinha sem bancada/cooktop/geladeira) — injetado pelo gate",
      "timeout do Ollama (240s) em máquina lenta",
      "área/dims dependem de consensus_regenerated.json existir"
    ],
    "runbook": [
      "python -m tools.interior_studio.architect_program r002 deepseek (preview)",
      "python -m tools.interior_studio.architect_program r002 deepseek --save (salva proposal pending)",
      "proposals.approve('furniture_program_r002') após ok do Felipe",
      "project_state.room_asset_keys lê o programa aprovado e sobrepõe o ROOMS default"
    ],
    "status": "implemented"
  },
  {
    "id": "render-judge-por-tema",
    "name": "Juiz de render por tema (fingerprint + visão local + checks do tema)",
    "whenToUse": "Checkpoint LOCAL após gerar um render (PNG) de um asset/cômodo, para traduzir o render em números + descrição e julgar contra o schema do tema (ex.: black_wood_gold) antes do veredito humano.",
    "inputs": [
      "render.png",
      "theme_id (ex.: black_wood_gold)"
    ],
    "outputs": [
      "verdict estruturado {overall, checks[], fingerprint, synthesis}",
      "linha no ledger .ai_bridge/interior_studio/render_judge_verdicts.jsonl (com --log)"
    ],
    "tools": [
      "tools/interior_studio/render_judge.py",
      "tools/interior_studio/render_fingerprint.py",
      "tools/interior_studio/vision_describe.py (qwen2.5vl:7b)",
      "tools/interior_studio/theme_registry.py"
    ],
    "checklist": [
      "fingerprint determinístico calculado (exposure/paleta/clipping)",
      "visão local respondeu as theme vision_questions (ou degradou)",
      "checks do tema avaliados → overall_status (qualquer FAIL=FAIL)",
      "síntese do juiz LLM (taste 0-10 + porquê + next_action) — explica, não substitui o gate",
      "veredito FINAL de aparência continua sendo do Felipe/GPT"
    ],
    "risks": [
      "juiz LLM é consultivo, NÃO autoritativo — não pode emitir PASS final de aparência",
      "Ollama offline: visão/síntese degradam (vision_ok=false, synthesis vazia)",
      "fingerprint depende de Pillow/leitura do PNG"
    ],
    "runbook": [
      "python -m tools.interior_studio.render_judge <render.png> --theme black_wood_gold",
      "flags: --no-judge / --no-vision / --log (grava no ledger)",
      "exit code 0 se overall in (PASS,WARN), 1 se FAIL"
    ],
    "status": "implemented"
  },
  {
    "id": "curate-refpack",
    "name": "Curadoria de Reference Pack (card do cockpit)",
    "whenToUse": "Card exposto no /api/workflows do cockpit ao receber novas referências visuais de um asset. Representa a etapa de curadoria do Felipe (👍/👎/⭐/🚫) dentro da esteira.",
    "inputs": [
      "links/imagens de referência"
    ],
    "outputs": [
      "pack curado (status por referência + ⭐ principal)"
    ],
    "tools": [
      "reference-scout (planejado)",
      "gpt-visual",
      "tools/interior_studio/reference_packs.py (backend real da curadoria)"
    ],
    "checklist": [
      "card aparece em GET /api/workflows como canned (steps fixos ingest/judge/approve)",
      "POST /api/workflows/curate-refpack/run dispara o runner STUB (não cura de verdade)",
      "a curadoria REAL acontece via reference_packs.curate no repo do motor, não pelo card"
    ],
    "risks": [
      "O card é ilustrativo: status/steps são hardcoded em _derive_workflows, não refletem um pack real",
      "Rodar o card aciona o _runner stub (plan/execute/verify simulados), não a esteira real",
      "copiar imagem em vez de extrair gramática (anti-pattern de design)"
    ],
    "runbook": [
      "GET /api/workflows → card 'curate-refpack'",
      "POST /api/workflows/curate-refpack/run → runId (run STUB)",
      "para curadoria real: reference_packs.curate(pack_id, ref_id, action) no engine"
    ],
    "status": "mock"
  },
  {
    "id": "render-vray",
    "name": "Render V-Ray (card do cockpit)",
    "whenToUse": "Card exposto no /api/workflows do cockpit quando forma + contexto de um asset foram aprovados e falta renderizar na planta e validar com o juiz visual.",
    "inputs": [
      "SKP montado"
    ],
    "outputs": [
      "PNG render"
    ],
    "tools": [
      "vray",
      "gpt-visual",
      "tools/interior_studio/render_judge.py (validação real do render)"
    ],
    "checklist": [
      "card aparece em GET /api/workflows como canned (steps camera/render/judge, todos pending)",
      "POST /api/workflows/render-vray/run dispara o runner STUB",
      "render/validação reais são feitos por tools de V-Ray (kitchen_vray.py) + render_judge no engine, não pelo card"
    ],
    "risks": [
      "O card NÃO renderiza: dispara o _runner stub",
      "anti-patterns de render: piso preto default, eletro escuro que some no fundo",
      "veredito visual final é do Felipe/GPT"
    ],
    "runbook": [
      "GET /api/workflows → card 'render-vray'",
      "POST /api/workflows/render-vray/run → runId (run STUB)",
      "render real: pipeline V-Ray do engine + render_judge.validate(png, theme)"
    ],
    "status": "mock"
  },
  {
    "id": "cycle-fidelity",
    "name": "Ciclo de fidelidade do asset (workflow principal do cockpit)",
    "whenToUse": "Workflow 'main' derivado pelo cockpit a partir do factory espelhado por ARQUIVO (studio_mirror.factory_view ← .ai_bridge/interior_cycles/). Leva um asset de referência → curadoria → build → render V-Ray validado. Reflete o ciclo ATIVO (ex.: CYCLE-003).",
    "inputs": [
      "Reference Pack",
      "planta (PDF)"
    ],
    "outputs": [
      "render V-Ray",
      "SKP"
    ],
    "tools": [
      "interior-designer",
      "consult-gpt",
      "vray"
    ],
    "checklist": [
      "GET /api/workflows monta este card com steps DERIVADOS do pipeline do foco ativo (active_focuses[0].pipeline)",
      "status 'running' se factory_state.has_cycle, senão 'idle'",
      "risks vindos de learning.anti_patterns reais lidos dos arquivos do motor",
      "disparo (POST /run) usa o runner STUB — não roda a esteira real"
    ],
    "risks": [
      "Os steps refletem o estado real do ciclo, MAS o disparo é stub (não executa o ciclo de verdade)",
      "Depende do motor legível em ENGINE_ROOT; senão o state espelhado vem vazio e o card degrada",
      "lastRunId sempre None (não liga o card a um run real)"
    ],
    "runbook": [
      "GET /api/workflows → card 'cycle-fidelity' (derivado de /api/state)",
      "POST /api/workflows/cycle-fidelity/run → runId (run STUB com os steps do card)",
      "o ciclo REAL é conduzido pelos agentes interior-* + tools/interior_studio/*"
    ],
    "status": "mock"
  }
];
