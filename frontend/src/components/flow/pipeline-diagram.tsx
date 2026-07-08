// pipeline-diagram.tsx — o PIPELINE PDF → .skp em 7 etapas, num diagrama só.
// Substitui a timeline interativa densa (era 7 passos × 9 campos de texto). Fiel ao
// flow-steps.ts: Entrada(mock, consensus vem pronto) → Interpretação → Geração →
// Gates → Render+Visual → Oráculo → Aprovado. Pacotes fluindo entre as etapas.
import { motion } from "framer-motion";
import { Packet } from "./decision-flow-diagram";

const STEPS = [
  { n: 1, name: "Entrada", sub: "PDF + consensus", mock: true },
  { n: 2, name: "Interpreta.", sub: "escala + valida" },
  { n: 3, name: "Geração", sub: "→ .skp (2D+3D)" },
  { n: 4, name: "Gates", sub: "fidelidade" },
  { n: 5, name: "Render", sub: "V-Ray + visual" },
  { n: 6, name: "Oráculo", sub: ":8765 decide" },
  { n: 7, name: "Aprovado", sub: "artifacts/" },
];

const W = 100, GAP = 20, X0 = 10, Y = 44, H = 66, MID = Y + H / 2;
const xOf = (i: number) => X0 + i * (W + GAP);

export function PipelineDiagram() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card/40 p-3 sm:p-4">
      <svg viewBox="0 0 840 148" className="h-auto w-full min-w-[720px]"
        role="img" aria-labelledby="pl-t pl-d" fontFamily="ui-sans-serif, system-ui, sans-serif">
        <title id="pl-t">Pipeline do PDF ao .skp</title>
        <desc id="pl-d">
          Sete etapas: Entrada (PDF e consensus, hoje pré-construído), Interpretação,
          Geração do .skp, Gates de fidelidade, Render e revisão visual, Oráculo de decisão,
          e o artefato Aprovado.
        </desc>
        <style>{`
          .pl-box{fill:hsl(var(--card));stroke:hsl(var(--border));stroke-width:1.4}
          .pl-mock{stroke:hsl(var(--warn));stroke-dasharray:5 4}
          .pl-num{fill:hsl(var(--primary));font-weight:700;font-size:10px}
          .pl-name{fill:hsl(var(--foreground));font-weight:650;font-size:12px}
          .pl-sub{fill:hsl(var(--muted-foreground));font-size:10px}
          .pl-flow{stroke:hsl(var(--muted-foreground)/.55);stroke-width:1.5;fill:none;marker-end:url(#pl-ar)}
          .pl-s{fill:hsl(var(--muted-foreground));font-size:10.5px}
        `}</style>
        <defs>
          <marker id="pl-ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="hsl(var(--muted-foreground)/.7)" />
          </marker>
        </defs>

        {STEPS.map((s, i) => {
          const x = xOf(i);
          return (
            <g key={s.n}>
              <rect className={`pl-box${s.mock ? " pl-mock" : ""}`} x={x} y={Y} width={W} height={H} rx={10} />
              <circle cx={x + 15} cy={Y + 16} r={8} fill="hsl(var(--primary)/.14)" stroke="hsl(var(--primary)/.5)" strokeWidth="1" />
              <text className="pl-num" x={x + 15} y={Y + 19.5} textAnchor="middle">{s.n}</text>
              {/* status dot */}
              <circle cx={x + W - 12} cy={Y + 14} r={3.5}
                fill={s.mock ? "hsl(var(--warn))" : "hsl(var(--ok))"} />
              <text className="pl-name" x={x + 12} y={Y + 44}>{s.name}</text>
              <text className="pl-sub" x={x + 12} y={Y + 59}>{s.sub}</text>
              {/* seta + pacote pro próximo */}
              {i < STEPS.length - 1 && (
                <>
                  <path id={`pl-c${i}`} className="pl-flow"
                    d={`M${x + W},${MID} L${xOf(i + 1)},${MID}`} />
                  <Packet path={`M${x + W},${MID} L${xOf(i + 1)},${MID}`} dur={1.1} delay={i * 0.18} />
                </>
              )}
            </g>
          );
        })}

        {/* legenda */}
        <g transform="translate(10,132)">
          <circle cx="4" cy="-3" r="3.5" fill="hsl(var(--ok))" />
          <text className="pl-s" x="14" y="0">implementado</text>
          <circle cx="118" cy="-3" r="3.5" fill="hsl(var(--warn))" />
          <text className="pl-s" x="128" y="0">mock (o consensus já chega pronto — sem extrator PDF rodável)</text>
        </g>
      </svg>
    </div>
  );
}

export function PipelineSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }} className="space-y-3"
    >
      <PipelineDiagram />
      <p className="text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground/90">Do PDF ao .skp em 7 etapas.</strong> O{" "}
        <strong>consensus</strong> (paredes/aberturas/cômodos) é a fonte de verdade — hoje já chega
        pronto nas fixtures (por isso a Entrada é <span className="text-warn">mock</span>). Daí é
        determinístico: interpreta → gera o <strong>.skp</strong> → passa pelos gates de fidelidade →
        renderiza e compara com o PDF → o <strong>oráculo</strong> decide (só o veredito visual é seu) →
        vira <strong>artefato aprovado</strong>. Os detalhes de cada etapa (scripts, gates, erros comuns)
        estão em <em>Detalhes técnicos</em>, no fim.
      </p>
    </motion.div>
  );
}
