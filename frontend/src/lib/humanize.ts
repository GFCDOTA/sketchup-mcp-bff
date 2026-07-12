// humanize.ts — tradução central de jargão do motor pra resultado humano.
// Regra do design (GPT 2026-07-12): o Felipe NUNCA deve precisar entender
// feeder/dispatcher/COMMITTED — todo status vira "o que aconteceu" + "quem age".
import type { HojeEtiqueta } from "@/api/types";

/** Status do ledger do atuador → resultado humano. */
export const STATUS_HUMANO: Record<string, string> = {
  COMMITTED: "concluído e salvo",
  VISUAL_REVIEW_QUEUED: "mudou a aparência — esperando seu olho",
  NOOP: "rodou, nada a mudar",
  VERIFY_FAILED: "a verificação falhou — não foi salvo",
  WT_ADD_FAILED: "não conseguiu preparar a área de trabalho",
  PUSH_FAILED: "não conseguiu salvar no repositório",
  DRY_RUN: "ensaio (nada gravado)",
  SKIPPED_WT_EXISTS: "pulado — outra tarefa usa a área",
  SKIPPED_BRANCH_HAS_WORK: "pulado — havia trabalho a preservar",
  LOCAL_LLM_DONE: "resolvido pelo modelo local",
  LOCAL_LLM_OFFLINE: "modelo local fora do ar",
  GALLERY_EMIT_SKIPPED: "galeria não atualizada (não-fatal)",
};

/** Kind de task da fila → o que o sistema vai fazer. */
export const KIND_HUMANO: Record<string, string> = {
  correction_cycle: "ciclo de correção automática",
  "variant-sweep": "gerar variantes novas",
  "variant-vision-drain": "julgar variante no painel de visão",
  curation_fix: "corrigir o gerador (sessão Claude)",
  local_llm: "tarefa do modelo local",
  claude: "tarefa do agente Claude",
};

export const ETIQUETA_META: Record<HojeEtiqueta, { label: string; cls: string; dot: string }> = {
  SISTEMA_AGINDO: { label: "sistema agindo", cls: "border-blue/30 bg-blue/10 text-blue", dot: "bg-blue" },
  ESPERA_VOCE: { label: "espera você", cls: "border-primary/40 bg-primary/15 text-primary", dot: "bg-primary" },
  BLOQUEADO: { label: "bloqueado", cls: "border-danger/40 bg-danger/10 text-danger", dot: "bg-danger" },
};

export const humanStatus = (s?: string | null) =>
  (s && STATUS_HUMANO[s]) || s || "—";
export const humanKind = (k?: string | null) =>
  (k && KIND_HUMANO[k]) || k || "tarefa";

export const hhmm = (t?: number | null) =>
  t ? new Date(t * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

export const relTime = (t?: number | null): string => {
  if (!t) return "—";
  const s = Math.max(0, Date.now() / 1000 - t);
  if (s < 90) return "agora há pouco";
  if (s < 3600) return `há ${Math.round(s / 60)}min`;
  if (s < 86400) return `há ${Math.round(s / 3600)}h`;
  return `há ${Math.round(s / 86400)}d`;
};
