// curation.tsx — fase CURADORIA (KICKOFF_CURADORIA): o veredito humano ganha tela.
// Fatia 1: galeria do corpus julgado (last-wins) · Fatia 2: o CLIQUE grava
// human_verdicts.jsonl (append-only; o corpus do motor nunca é reescrito) ·
// Fatia 3: card "o que já aprendemos" (patterns agregados, pré-FP-035).
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Stamp, Sparkles, CircleCheck, CircleX, CircleDashed,
  ThumbsUp, ThumbsDown, Check, ListChecks, X,
} from "lucide-react";
import { useCuration, useCurationVerdict, useCurationVerdicts } from "@/api/hooks";
import { DEFAULT_PLANT } from "@/api/client";
import type {
  CurationVariant, CurationVerdictBatchResponse, DesignPattern, HumanVerdictValue,
  MachineVerdict, PatternAgg,
} from "@/api/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardEyebrow, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/states";
import { SkeletonText } from "@/components/ui/skeleton";
import { staggerContainer, staggerItem } from "@/components/flow/animated-section";
import { GptReviewBadge } from "@/components/gpt-review-badge";
import { CurationAutonomyCard } from "@/components/curation-autonomy-card";
import { cn } from "@/lib/utils";

/* verdicts da MÁQUINA (CANDIDATE|FAIL|PENDING_VISION) — cores próprias */
const MACHINE_BADGE: Record<MachineVerdict, "gold" | "danger" | "info"> = {
  CANDIDATE: "gold", FAIL: "danger", PENDING_VISION: "info",
};
/* verdicts do HUMANO (IMPROVED|SAME|WORSE) — exclusivos do clique */
const HUMAN_BADGE: Record<HumanVerdictValue, "ok" | "info" | "danger"> = {
  IMPROVED: "ok", SAME: "info", WORSE: "danger",
};
const AXIS_SHORT: Record<string, string> = {
  wall_fidelity: "wall", door_fidelity: "door", window_fidelity: "win",
  room_fidelity: "room", scale_rotation: "scale", global_visual: "visual",
  material_light: "mat",
};
const AXIS_DOT: Record<string, string> = {
  PASS: "bg-ok", WARN: "bg-warn", FAIL: "bg-danger",
};

/* agrupa variantes por ASSINATURA DE ERRO (eixos em FAIL, senão WARN) — o Felipe
   ataca "tudo do mesmo erro de uma vez". FAIL primeiro, depois WARN, sem-erro,
   e por último as que ainda aguardam o painel de visão. */
type ErrorGroup = { key: string; label: string; dot: string; variants: CurationVariant[] };
function groupByError(variants: CurationVariant[]): ErrorGroup[] {
  const meta = (v: CurationVariant) => {
    if (v.verdict === "PENDING_VISION")
      return { key: "z_pending", label: "Aguardando o painel de visão", dot: "bg-info", rank: 4 };
    const pick = (verdict: string) =>
      Object.entries(v.axes).filter(([, a]) => a?.verdict === verdict)
        .map(([ax]) => AXIS_SHORT[ax] ?? ax).sort();
    const fails = pick("FAIL");
    if (fails.length)
      return { key: `a_fail:${fails.join(",")}`, label: `Erro: ${fails.join(" + ")}`, dot: "bg-danger", rank: 0 };
    const warns = pick("WARN");
    if (warns.length)
      return { key: `b_warn:${warns.join(",")}`, label: `Atenção: ${warns.join(" + ")}`, dot: "bg-warn", rank: 1 };
    return { key: "c_ok", label: "Sem erro detectado", dot: "bg-ok", rank: 2 };
  };
  const byKey = new Map<string, ErrorGroup & { rank: number }>();
  for (const v of variants) {
    const m = meta(v);
    let g = byKey.get(m.key);
    if (!g) { g = { key: m.key, label: m.label, dot: m.dot, variants: [], rank: m.rank }; byKey.set(m.key, g); }
    g.variants.push(v);
  }
  return [...byKey.values()]
    .sort((a, b) => a.rank - b.rank || b.variants.length - a.variants.length)
    .map(({ rank: _rank, ...g }) => g);
}

export default function Curation() {
  const plant = DEFAULT_PLANT;
  const { data, isLoading, isError, error } = useCuration(plant);
  const [verdictFilter, setVerdictFilter] = useState<string>("ALL");
  const [themeFilter, setThemeFilter] = useState<string>("ALL");
  const [zoom, setZoom] = useState<CurationVariant | null>(null);
  // seleção múltipla p/ curadoria em LOTE (o Felipe julga N variantes de uma vez)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastBatch, setLastBatch] = useState<CurationVerdictBatchResponse | null>(null);
  // rastro sintético do dispatcher (variant_id "__noc-"): não-revisável, fica em
  // QUARENTENA fora da vista por default — era a "tralha" que confundia a tela.
  const [showSynthetic, setShowSynthetic] = useState(false);
  const nSynthetic = (data?.variants ?? []).filter((v) => v.synthetic).length;

  const variants = (data?.variants ?? []).filter(
    (v) => (verdictFilter === "ALL" || v.verdict === verdictFilter)
        && (themeFilter === "ALL" || v.theme === themeFilter)
        && (showSynthetic || !v.synthetic),
  );
  // só variantes já julgadas pela máquina entram no lote (PENDING_VISION não é julgável)
  const judgeableVisible = variants.filter((v) => v.verdict !== "PENDING_VISION");
  const allSelected = judgeableVisible.length > 0
    && judgeableVisible.every((v) => selected.has(v.variant_id));

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      judgeableVisible.forEach((v) => allSelected ? next.delete(v.variant_id) : next.add(v.variant_id));
      return next;
    });
  // seleciona o GRUPO DE ERRO inteiro (só as julgáveis) — atacar tudo do mesmo erro de uma vez
  const selectGroup = (g: ErrorGroup) =>
    setSelected((prev) => {
      const next = new Set(prev);
      g.variants.filter((v) => v.verdict !== "PENDING_VISION").forEach((v) => next.add(v.variant_id));
      return next;
    });
  // pós-lote: mantém só as que FALHARAM selecionadas (reenvio); sucesso total fecha a barra
  const onBatchApplied = (res: CurationVerdictBatchResponse) => {
    setLastBatch(res);
    const failed = new Set(
      (res.errors ?? []).map((e) => e.variant_id).filter((x): x is string => !!x),
    );
    setSelected(failed);
  };

  return (
    <>
      <PageHeader
        title="Curadoria"
        subtitle={`O veredito que é SEU por regra dura — IMPROVED / SAME / WORSE por variante julgada (${plant})`}
      />

      {isError ? (
        <ErrorState message={error?.message} />
      ) : isLoading ? (
        <Card className="p-4"><SkeletonText lines={5} /></Card>
      ) : !data?.live ? (
        <Card><EmptyState icon={Stamp} title="Sem corpus julgado"
          sub={data?.reason ?? "o loop autônomo ainda não produziu variantes"} /></Card>
      ) : (
        <div className="space-y-4">
          {/* o que a revisão autônoma fez a cada tick (últimas passadas + fila) */}
          <CurationAutonomyCard autonomy={data.autonomy} />

          {/* fotos em EVIDÊNCIA no topo (pedido do Felipe): filtros + grid agrupado por
              erro; a memória de design desce recolhida pro rodapé. */}
          {/* filtros por verdict máquina e por tema (kickoff, Fatia 1) */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterChips
              value={verdictFilter} onChange={setVerdictFilter}
              options={[["ALL", `Todos (${data.variants.length})`],
                ...Object.entries(data.counts).map(([k, n]) => [k, `${k} (${n})`] as [string, string])]}
            />
            {data.themes.length > 1 && (
              <FilterChips
                value={themeFilter} onChange={setThemeFilter}
                options={[["ALL", "todos os temas"], ...data.themes.map((t) => [t, t] as [string, string])]}
              />
            )}
            {judgeableVisible.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={toggleAll}>
                <ListChecks className="mr-1 size-3.5" />
                {allSelected ? "limpar seleção" : `selecionar ${judgeableVisible.length}`}
              </Button>
            )}
            {nSynthetic > 0 && (
              <button
                onClick={() => setShowSynthetic((s) => !s)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                  showSynthetic
                    ? "border-warn/40 bg-warn/15 text-warn"
                    : "border-border text-muted-foreground/60 hover:text-foreground",
                )}
                title="rastros sintéticos do dispatcher (não-revisáveis) — fora da vista por default">
                quarentena ({nSynthetic})
              </button>
            )}
            {(data.awaiting_human ?? 0) > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">
                <span className="font-semibold text-primary">{data.awaiting_human}</span> aguardando seu veredito
              </span>
            )}
          </div>

          {/* eco do último lote — quantas gravaram, quantas foram recusadas */}
          {lastBatch && (
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs">
              <ListChecks className="size-4 shrink-0 text-primary" />
              <span>
                Lote gravado: <span className="font-semibold">{lastBatch.recorded?.length ?? 0}</span> veredito(s)
                {(lastBatch.errors?.length ?? 0) > 0 && (
                  <> · <span className="text-warn">{lastBatch.errors!.length} recusada(s)</span></>
                )}
              </span>
              <button className="ml-auto text-muted-foreground hover:text-foreground"
                onClick={() => setLastBatch(null)} aria-label="fechar">
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {variants.length === 0 ? (
            <Card><EmptyState icon={Stamp} title="Nada nesse filtro" /></Card>
          ) : (
            <div className="space-y-6">
              {groupByError(variants).map((g) => {
                const judgeable = g.variants.filter((v) => v.verdict !== "PENDING_VISION");
                return (
                  <div key={g.key} className="space-y-2">
                    <div className="flex items-center gap-2 border-b border-border/50 pb-1">
                      <span className={cn("size-2 shrink-0 rounded-full", g.dot)} />
                      <h3 className="text-sm font-semibold">{g.label}</h3>
                      <Badge variant="outline">{g.variants.length}</Badge>
                      {judgeable.length > 0 && (
                        <Button variant="ghost" size="sm" className="ml-auto h-6 text-[11px]"
                          onClick={() => selectGroup(g)}>
                          <ListChecks className="mr-1 size-3.5" />
                          selecionar grupo ({judgeable.length})
                        </Button>
                      )}
                    </div>
                    <motion.div variants={staggerContainer} initial="hidden" animate="show"
                      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {g.variants.map((v) => (
                        <motion.div key={v.variant_id} variants={staggerItem}>
                          <VariantCard v={v} plant={plant} onZoom={setZoom}
                            selected={selected.has(v.variant_id)} onToggleSelect={toggleSelect} />
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
                );
              })}
            </div>
          )}

          {/* memória de design — RECOLHIDA, no rodapé (fotos em evidência no topo) */}
          <PatternsCard patterns={data.patterns} />
        </div>
      )}

      {/* barra de ação em LOTE — só aparece com ≥1 selecionada */}
      {selected.size > 0 && (
        <BatchActionBar plant={plant} selectedIds={[...selected]}
          onApplied={onBatchApplied} onClear={() => setSelected(new Set())} />
      )}

      {/* lightbox — o iso.png em tamanho real */}
      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="top-[6vh] max-w-4xl p-2">
          <DialogTitle className="px-2 py-1 font-mono text-sm">{zoom?.variant_id}</DialogTitle>
          {zoom?.img && (
            <img src={zoom.img} alt={zoom.variant_id}
              className="max-h-[78vh] w-full rounded-md bg-black object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FilterChips({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === k
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
          )}>
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── Fatia 3: "o que já aprendemos" ─────────────────────────────────────────*/
function PatternsCard({ patterns }: { patterns: { total: number; works: number; fails: number; neutral: number; patterns: PatternAgg[] } }) {
  const [open, setOpen] = useState(false);   // recolhida por padrão (rodapé) — fotos em evidência no topo
  if (patterns.total === 0) return null;
  return (
    <Card accent="purple">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardEyebrow><Sparkles className="mr-1 inline size-3" />memória de design (pré-FP-035)</CardEyebrow>
          <CardTitle>O que já aprendemos — {patterns.total} padrões</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="ok">{patterns.works} works</Badge>
          <Badge variant="danger">{patterns.fails} fails</Badge>
          {patterns.neutral > 0 && <Badge variant="outline">{patterns.neutral} neutral</Badge>}
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? "recolher" : "expandir"}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-1.5">
          {patterns.patterns.map((p) => (
            <div key={p.pattern} className="flex items-start gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
              <PatternIcon works={p.works} fails={p.fails} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] leading-snug">{p.pattern}</div>
                {p.why[0] && (
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground/70" title={p.why.join(" · ")}>
                    {p.why[0]}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1 pt-0.5 font-mono text-[10.5px] text-muted-foreground/60">
                {p.works > 0 && <span className="text-ok">✓{p.works}</span>}
                {p.fails > 0 && <span className="text-danger">✗{p.fails}</span>}
                {p.neutral > 0 && <span>○{p.neutral}</span>}
                {p.themes.length > 0 && <span title={p.variants.join("\n")}>· {p.themes.join(", ")}</span>}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function PatternIcon({ works, fails }: { works: number; fails: number }) {
  if (works > 0 && fails === 0) return <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" />;
  if (fails > 0 && works === 0) return <CircleX className="mt-0.5 size-4 shrink-0 text-danger" />;
  return <CircleDashed className="mt-0.5 size-4 shrink-0 text-warn" />;
}

/* ── Fatia 1 + 2: card da variante com o CLIQUE ─────────────────────────────*/
function VariantCard({ v, plant, onZoom, selected, onToggleSelect }: {
  v: CurationVariant; plant: string; onZoom: (v: CurationVariant) => void;
  selected: boolean; onToggleSelect: (id: string) => void;
}) {
  const verdict = useCurationVerdict(plant);
  const [note, setNote] = useState("");
  const judgeable = v.verdict !== "PENDING_VISION";

  const judge = (value: HumanVerdictValue) =>
    verdict.mutate({ variant_id: v.variant_id, verdict: value, note: note || undefined },
      { onSuccess: () => setNote("") });

  const shortId = v.variant_id.startsWith(`${plant}__`)
    ? v.variant_id.slice(plant.length + 2) : v.variant_id;

  return (
    <Card className={cn("relative overflow-hidden", selected && "ring-2 ring-primary")}>
      {judgeable && (
        <button type="button" onClick={() => onToggleSelect(v.variant_id)}
          aria-label={selected ? "desmarcar do lote" : "marcar para o lote"}
          aria-pressed={selected}
          className={cn(
            "absolute left-2 top-2 z-10 grid size-6 place-items-center rounded-md border transition-colors",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background/80 text-transparent hover:text-muted-foreground",
          )}>
          <Check className="size-4" />
        </button>
      )}
      {v.img ? (
        <button onClick={() => onZoom(v)} className="block aspect-[4/3] w-full bg-black">
          <img src={v.img} alt={v.variant_id} loading="lazy" className="h-full w-full object-contain" />
        </button>
      ) : (
        <div className="grid aspect-[4/3] place-items-center bg-background/40 text-[11px] text-muted-foreground/50">
          sem render (build abortou antes do iso)
        </div>
      )}

      <div className="space-y-2.5 p-3">
        {/* laço autônomo de revisão: status VIVO (em análise/revisado/corrigindo) +
            nota/crítica do GPT-no-Docker. Só aparece quando o item passou pelo laço. */}
        <GptReviewBadge v={v} />
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={MACHINE_BADGE[v.verdict] ?? "outline"}>{v.verdict}</Badge>
          {v.discriminated && <Badge variant="purple">DISCRIMINATED</Badge>}
          {v.machine_score?.value != null && (
            <span className="font-mono text-[11px] text-muted-foreground/60"
              title={v.machine_score.label}>
              score {v.machine_score.value} <span className="opacity-60">(provisional)</span>
            </span>
          )}
          <span className="ml-auto font-mono text-[10.5px] text-muted-foreground/50"
            title={`${v.revisions} passe(s) no corpus — last-wins`}>
            ×{v.revisions}
          </span>
        </div>

        <div className="truncate font-mono text-xs" title={v.variant_id}>{shortId}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground/70">
          {v.theme && <span>tema <span className="text-foreground/80">{v.theme}</span></span>}
          <span>seed {v.params.layout_seed}</span>
          {v.n_boxes != null && <span>{v.n_boxes} boxes</span>}
          {v.findings_count > 0 && <span>{v.findings_count} finding(s)</span>}
        </div>

        {/* os 7 eixos do visual_findings.v1, compactos (tooltip = evidência) */}
        {Object.keys(v.axes).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(v.axes).map(([axis, a]) => (
              <span key={axis} title={`${axis}: ${a.verdict} — ${a.evidence}`}
                className="inline-flex items-center gap-1 rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", AXIS_DOT[a.verdict] ?? "bg-border")} />
                {AXIS_SHORT[axis] ?? axis}
              </span>
            ))}
          </div>
        )}

        {/* patterns observados pelo painel nesta variante */}
        {v.patterns.length > 0 && (
          <div className="space-y-0.5">
            {v.patterns.map((p) => <PatternLine key={p.pattern} p={p} />)}
          </div>
        )}

        {/* Fatia 2 — o clique. Só a tela grava human_verdict (rail do kickoff). */}
        <div className="rounded-md border border-border/60 bg-background/40 p-2">
          {v.human_verdict?.verdict ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <Badge variant={HUMAN_BADGE[v.human_verdict.verdict]}>{v.human_verdict.verdict}</Badge>
              {v.human_verdict.liked === true && <ThumbsUp className="size-3.5 text-ok" />}
              {v.human_verdict.liked === false && <ThumbsDown className="size-3.5 text-danger" />}
              {(v.human_verdict.tags ?? []).map((tg) => (
                <Badge key={tg} variant="outline">{tg}</Badge>
              ))}
              {v.human_verdict.note && <span className="text-muted-foreground">“{v.human_verdict.note}”</span>}
              {v.human_verdict.t && (
                <span className="ml-auto font-mono text-[10px] text-muted-foreground/50">
                  {new Date(v.human_verdict.t).toLocaleString("pt-BR")}
                </span>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground/70">
              {judgeable ? "seu veredito:" : "aguardando o painel de visão…"}
            </div>
          )}

          {judgeable && (
            <div className="mt-1.5 space-y-1.5">
              <div className="flex gap-1.5">
                {(["IMPROVED", "SAME", "WORSE"] as const).map((value) => (
                  <Button key={value} size="sm" variant={v.human_verdict?.verdict === value ? "primary" : "outline"}
                    className="h-7 flex-1 text-[11px]" disabled={verdict.isPending}
                    onClick={() => judge(value)}>
                    {value}
                  </Button>
                ))}
              </div>
              <Input value={note} onChange={(e) => setNote(e.target.value)}
                placeholder='nota curta opcional ("melhor pra X")'
                className="h-7 text-[11px]" maxLength={200} />
              {verdict.isError && (
                <div className="text-[11px] text-danger">{(verdict.error as Error)?.message}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ── barra de ação em LOTE (curadoria plural) ──────────────────────────────*/
function BatchActionBar({ plant, selectedIds, onApplied, onClear }: {
  plant: string; selectedIds: string[];
  onApplied: (res: CurationVerdictBatchResponse) => void; onClear: () => void;
}) {
  const verdicts = useCurationVerdicts(plant);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [tags, setTags] = useState("");

  const parseTags = (s: string) =>
    Array.from(new Set(s.split(",").map((t) => t.trim()).filter(Boolean)));

  const apply = (value: HumanVerdictValue) => {
    const tagList = parseTags(tags);
    const items = selectedIds.map((id) => ({
      variant_id: id, human_verdict: value, liked, tags: tagList,
    }));
    verdicts.mutate(items, {
      onSuccess: (res) => { setTags(""); setLiked(null); onApplied(res); },
    });
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold">
            <span className="text-primary">{selectedIds.length}</span> selecionada(s)
          </span>

          {/* gostei / não — tri-state (clicar de novo desmarca) */}
          <div className="flex gap-1">
            <Button size="sm" variant={liked === true ? "primary" : "outline"}
              className="h-7 text-[11px]" onClick={() => setLiked((p) => (p === true ? null : true))}>
              <ThumbsUp className="mr-1 size-3.5" /> gostei
            </Button>
            <Button size="sm" variant={liked === false ? "destructive" : "outline"}
              className="h-7 text-[11px]" onClick={() => setLiked((p) => (p === false ? null : false))}>
              <ThumbsDown className="mr-1 size-3.5" /> não
            </Button>
          </div>

          <Input value={tags} onChange={(e) => setTags(e.target.value)}
            placeholder="tags, separadas por vírgula"
            className="h-7 w-48 text-[11px]" maxLength={200} />

          <div className="ml-auto flex gap-1.5">
            {(["IMPROVED", "SAME", "WORSE"] as const).map((value) => (
              <Button key={value} size="sm"
                variant={value === "WORSE" ? "destructive" : value === "IMPROVED" ? "primary" : "outline"}
                className="h-7 text-[11px]" disabled={verdicts.isPending}
                onClick={() => apply(value)}>
                {value}
              </Button>
            ))}
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]"
              onClick={onClear} aria-label="limpar seleção">
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
        {verdicts.isError && (
          <div className="mt-1.5 text-[11px] text-danger">{(verdicts.error as Error)?.message}</div>
        )}
      </div>
    </div>
  );
}

function PatternLine({ p }: { p: DesignPattern }) {
  const mark = p.verdict === "works"
    ? <span className="text-ok">✓</span>
    : p.verdict === "fails" ? <span className="text-danger">✗</span>
    : <span className="text-muted-foreground/60">○</span>;
  return (
    <div className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground" title={p.why}>
      <span className="mt-px shrink-0">{mark}</span>
      <span className="min-w-0 truncate">{p.pattern}</span>
    </div>
  );
}
