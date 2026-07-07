import type { AgentDoc } from "./types";

export const agentDocs: AgentDoc[] = [
  {
    "id": "interior-pm",
    "name": "PM",
    "role": "PM / dono do backlog (KITCHEN_TO_100.md) e dos claims; diz O QUE FAZER AGORA, QUEM é dono, ONDE há colisão. Não executa código/geometria; só roteia e edita SESSION_COORDINATION.md (via texto).",
    "model": "inherit (Claude do harness; cockpit rótula como llama3.1:8b). Status online = modelo llama no Ollama",
    "inputs": [
      "git fetch/worktree list",
      "KITCHEN_TO_100.md (backlog MT-01..MT-32)",
      "SESSION_COORDINATION.md (claims/colisões)",
      ".ai_bridge/lessons/interior-pm.md"
    ],
    "outputs": [
      "lista priorizada PELE-pode-já / GEO-bloqueado",
      "colisões nomeadas (arquivo + 2 branches)",
      "bloco de texto pra SESSION_COORDINATION.md"
    ],
    "tools": [
      "Read",
      "Grep",
      "Glob",
      "Bash(git worktree*/log*/fetch*/branch*)"
    ],
    "status": "implemented"
  },
  {
    "id": "interior-orchestrator",
    "name": "Team Lead",
    "role": "ORQUESTRADOR: roda o loop PM → designer → executor → gate → dashboard, sequencia as 4 fases (0 infra / 1 paleta / 2 GEO / 3 PELE), aplica anti-colisão. NUNCA executa geometria — despacha via Task/Skill.",
    "model": "inherit (Claude do harness; cockpit rótula como qwen2.5-coder:7b). Status online = modelo qwen no Ollama",
    "inputs": [
      "KITCHEN_TO_100.md + SESSION_COORDINATION.md",
      "git fetch/worktree",
      "DesignDirectiveSpec do designer",
      ".ai_bridge/lessons/interior-orchestrator.md"
    ],
    "outputs": [
      "PLANO-DE-CICLO (tabela MT/fase/executor/gate/branch)",
      "DISPATCH (chamadas Task/Skill ou BLOCKED_NEEDS_FELIPE_GEO)",
      "NOTA DE STATUS (PROGREDINDO/PATINANDO/BLOCKED)"
    ],
    "tools": [
      "Read",
      "Grep",
      "Glob",
      "Task",
      "Bash(git *)"
    ],
    "status": "implemented"
  },
  {
    "id": "interior-designer",
    "name": "Arquiteto",
    "role": "DESIGNER com autoridade de design: decide o 'toque' ANTES de renderizar (paleta, tom de parede, luz, materialidade). Reprova caverna e fake-luxury. Produz DesignDirectiveSpec (JSON) + design review. Não dá veredito visual FINAL.",
    "model": "inherit (Claude do harness; cockpit rótula como deepseek-r1:14b). Status online = modelo deepseek no Ollama",
    "inputs": [
      "felipe_style_dna.md + felipe_visual_judge_rules.json",
      "KITCHEN_DECISIONS_FELIPE_V1.md (D1-D9)",
      "COMPLETE_KITCHEN_SPEC.md + references/materials/*",
      "render/variante atual (se houver)"
    ],
    "outputs": [
      "DesignDirectiveSpec (JSON com tokens ancorados em fonte)",
      "Design Review (aprovo/reprovo + classificação + conserto)",
      "gates_expected (PREVISÃO, não veredito)"
    ],
    "tools": [
      "Read",
      "Grep",
      "Glob"
    ],
    "status": "implemented"
  },
  {
    "id": "reference-scout",
    "name": "Scout",
    "role": "Reference Scout: busca referências visuais e monta o Reference Pack inicial (etapa 'Reference Scout' da timeline do ciclo). Aparece no ROSTER do dashboard e na esteira.",
    "model": "não fixado (LLM/busca; sem agente .claude/agents dedicado)",
    "inputs": [
      "asset/tema alvo",
      "fontes de referência (Pinterest/board/links)"
    ],
    "outputs": [
      "Reference Pack (.ai_bridge/reference_packs/<asset>_reference_pack_001.json)"
    ],
    "tools": [
      "(scout de referências — backend de busca; não há módulo dedicado lido)"
    ],
    "status": "planned"
  },
  {
    "id": "ollama-deepseek",
    "name": "DeepSeek",
    "role": "LLM local de RACiocínio: propõe o furniture_program (architect_program) e sintetiza o juiz de render. Sub do guarda-chuva 'Arquiteto'.",
    "model": "deepseek-r1:14b (ROLE_MODEL['deepseek'] em ollama_bridge.py)",
    "inputs": [
      "prompt de programa de mobiliário (dims + DNA + existing)",
      "fatos traduzidos do render (fingerprint + visão + checks)"
    ],
    "outputs": [
      "JSON furniture_program {items}",
      "síntese do juiz (verdict/taste/why/next_action)"
    ],
    "tools": [
      "tools/ollama_bridge.py (ask role=deepseek)",
      "architect_program._ollama",
      "render_judge.judge_synthesize"
    ],
    "status": "implemented"
  },
  {
    "id": "ollama-qwen",
    "name": "Qwen-coder",
    "role": "LLM local de CÓDIGO/formatação: reformata o raciocínio sujo do deepseek em JSON válido ('DeepSeek pensa, Qwen formata') e roda o estagiário de estilo. Sub do guarda-chuva 'Team Lead'.",
    "model": "qwen2.5-coder:14b (ROLE_MODEL['qwen']; cockpit _AGENT_META cita 7b)",
    "inputs": [
      "texto bruto do deepseek pra reformatar",
      "furniture_program para checar estilo"
    ],
    "outputs": [
      "JSON limpo {items} / {verdict,...}",
      "veredito de estilo (PASS/WARN/FAIL + off_style)"
    ],
    "tools": [
      "tools/ollama_bridge.py (ask role=qwen)",
      "architect_program (fallback qwen)",
      "interns.intern_estilo"
    ],
    "status": "implemented"
  },
  {
    "id": "ollama-llama",
    "name": "Llama",
    "role": "LLM local de chat/leve. Sub do guarda-chuva 'PM'. Também alvo do chat REAL do cockpit (POST /api/models/chat proxy p/ Ollama).",
    "model": "llama3.1:8b (ROLE_MODEL['llama'])",
    "inputs": [
      "mensagens de chat (cockpit)",
      "prompts leves"
    ],
    "outputs": [
      "resposta de chat (REAL via /api/chat do Ollama)"
    ],
    "tools": [
      "tools/ollama_bridge.py (ask role=llama)",
      "cockpit_api._ollama_chat (REAL)"
    ],
    "status": "implemented"
  },
  {
    "id": "ollama-spec",
    "name": "Especialista-Spec",
    "role": "Modelo especialista (designer/spec) do ROSTER — mapeado ao modelo 'interior-designer:latest' do Ollama. Status online derivado de ROLE_MODEL['designer'].",
    "model": "interior-designer:latest (ROLE_MODEL['designer'] em ollama_bridge.py)",
    "inputs": [
      "prompts de spec/diretriz"
    ],
    "outputs": [
      "saídas de spec (quando o modelo custom estiver instalado)"
    ],
    "tools": [
      "tools/ollama_bridge.py (ask role=designer)"
    ],
    "status": "planned"
  },
  {
    "id": "gpt-visual",
    "name": "GPT (visão)",
    "role": "Juiz VISUAL externo: único que emite veredito de aparência (IMPROVED/SAME/WORSE/PASS) junto com o Felipe. Consultado via bridge/Chrome (gpt-review-gate, :8765), nunca auto. Sub do guarda-chuva 'Arquiteto'.",
    "model": "gpt-4o (cockpit _AGENT_META; via ChatGPT bridge / Chrome / :8765)",
    "inputs": [
      "GPT_REVIEW_BUNDLE (md+json) com links raw",
      "render/montagem (imagem) para veredito visual"
    ],
    "outputs": [
      "veredito visual (PASS/IMPROVED/SAME/WORSE)",
      "resposta de consult → Learning Patch"
    ],
    "tools": [
      "tools/interior_studio/gpt_review_bundle.py",
      "consult_gpt_bridge",
      "tools/ask_gpt_gate.py (:8765)"
    ],
    "status": "mock"
  }
];
