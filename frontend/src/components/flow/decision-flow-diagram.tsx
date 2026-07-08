// decision-flow-diagram.tsx — o diagrama do FLUXO DE DECISÕES do estúdio, animado.
// Nascido do desenho que o Felipe curtiu (2026-07-07): responde "quem decide o quê e
// pra onde vão os rejeitados" de uma vez. Cores 100% do design system (hsl(var(--…)))
// → segue o tema. Setas com pacotes fluindo (SMIL) + pulso no hub = "vivo" sem dado
// ao vivo (é documentação). Zona ① decisão · Zona ② aprendizado (laço do RAG).
import { motion } from "framer-motion";

/** um pacote que percorre um path (efeito "dado fluindo"). Reusado pelos outros diagramas. */
export function Packet({ path, dur, delay = 0, color = "hsl(var(--primary))" }: {
  path: string; dur: number; delay?: number; color?: string;
}) {
  return (
    <circle r="3" fill={color}>
      <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} />
    </circle>
  );
}

export function DecisionFlowDiagram() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card/40 p-3 sm:p-4">
      <svg viewBox="0 0 840 512" className="h-auto w-full min-w-[680px]"
        role="img" aria-labelledby="dfd-t dfd-d"
        fontFamily="ui-sans-serif, system-ui, sans-serif">
        <title id="dfd-t">Fluxo de decisões do estúdio</title>
        <desc id="dfd-d">
          Arquiteto e Auditor enchem a fila; o juiz automático decide as objetivas
          (aprova/rejeita) e deixa gaps e gosto para você. Um laço separado
          (Curadoria → Qdrant) é o aprendizado; hoje os rejeitados ainda não o alimentam.
        </desc>

        <style>{`
          .dfd-box{fill:hsl(var(--card));stroke:hsl(var(--border));stroke-width:1.4}
          .dfd-hub{fill:hsl(var(--secondary));stroke:hsl(var(--primary));stroke-width:2}
          .dfd-t{fill:hsl(var(--foreground));font-weight:650;font-size:14px}
          .dfd-s{fill:hsl(var(--muted-foreground));font-size:11.5px}
          .dfd-mono{font-family:ui-monospace,monospace;font-size:11px}
          .dfd-lbl{fill:hsl(var(--muted-foreground));font-weight:700;font-size:11px;letter-spacing:.06em}
          .dfd-flow{stroke:hsl(var(--muted-foreground)/.5);stroke-width:1.5;fill:none;marker-end:url(#dfd-ar)}
          .dfd-plan{stroke:hsl(var(--danger)/.7);stroke-width:1.5;fill:none;stroke-dasharray:5 4;marker-end:url(#dfd-arr)}
          @keyframes dfdPulse{0%,100%{opacity:.35}50%{opacity:.9}}
          .dfd-pulse{animation:dfdPulse 2.4s ease-in-out infinite}
          @media (prefers-reduced-motion: reduce){.dfd-pulse{animation:none}}
        `}</style>

        <defs>
          <marker id="dfd-ar" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto">
            <path d="M0,0 L6.5,3 L0,6 z" fill="hsl(var(--muted-foreground)/.7)" />
          </marker>
          <marker id="dfd-arr" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto">
            <path d="M0,0 L6.5,3 L0,6 z" fill="hsl(var(--danger)/.7)" />
          </marker>
        </defs>

        {/* ───────── ZONA ① — a decisão ───────── */}
        <text className="dfd-lbl" x="16" y="20">① O QUE DECIDE O QUÊ</text>

        {/* produtores */}
        <rect className="dfd-box" x="16" y="40" width="152" height="54" rx="10" />
        <text className="dfd-t" x="30" y="64">Arquiteto</text>
        <text className="dfd-s" x="30" y="82">propõe programas</text>

        <rect className="dfd-box" x="16" y="110" width="152" height="54" rx="10" />
        <text className="dfd-t" x="30" y="134">Auditor</text>
        <text className="dfd-s" x="30" y="152">levanta gaps</text>

        {/* fila */}
        <rect className="dfd-box" x="206" y="76" width="120" height="54" rx="10" />
        <text className="dfd-t" x="219" y="100">Fila</text>
        <text className="dfd-s dfd-mono" x="219" y="118">…/pending</text>

        {/* hub — o juiz */}
        <rect className="dfd-hub" x="364" y="55" width="170" height="86" rx="12" />
        <rect className="dfd-hub dfd-pulse" x="364" y="55" width="170" height="86" rx="12" fill="none" />
        <text className="dfd-t" x="379" y="82">Juiz automático</text>
        <text className="dfd-s" x="379" y="101">decide só o</text>
        <text className="dfd-s" x="379" y="118" fill="hsl(var(--foreground))" fontWeight="600">OBJETIVO</text>

        {/* saídas */}
        <g>
          <rect x="574" y="42" width="250" height="46" rx="10" fill="hsl(var(--ok)/.12)" stroke="hsl(var(--ok))" strokeWidth="1.4" />
          <text className="dfd-t" x="588" y="64">Aprova ✓</text>
          <text className="dfd-mono" x="588" y="80" fill="hsl(var(--ok))" fontWeight="600">→ approved/ + log</text>
        </g>
        <g>
          <rect x="574" y="98" width="250" height="46" rx="10" fill="hsl(var(--danger)/.12)" stroke="hsl(var(--danger))" strokeWidth="1.4" />
          <text className="dfd-t" x="588" y="120">Rejeita ✗</text>
          <text className="dfd-mono" x="588" y="136" fill="hsl(var(--danger))" fontWeight="600">→ rejected/ + log</text>
        </g>
        <g>
          <rect x="574" y="154" width="250" height="54" rx="10" fill="hsl(var(--warn)/.12)" stroke="hsl(var(--warn))" strokeWidth="1.4" />
          <text className="dfd-t" x="588" y="177">Deixa pra VOCÊ</text>
          <text className="dfd-s" x="588" y="195" fill="hsl(var(--warn))" fontWeight="600">→ “Aguardando você” (as 7)</text>
        </g>

        {/* fluxos ① + pacotes */}
        <path id="dfdA1" className="dfd-flow" d="M168,63 C190,63 186,96 206,98" />
        <path id="dfdA2" className="dfd-flow" d="M168,137 C190,137 186,106 206,104" />
        <path id="dfdA3" className="dfd-flow" d="M326,103 L364,99" />
        <path id="dfdA4" className="dfd-flow" d="M534,88 C554,88 554,65 574,65" />
        <path id="dfdA5" className="dfd-flow" d="M534,98 C558,98 558,121 574,121" />
        <path id="dfdA6" className="dfd-flow" d="M534,110 C554,110 554,181 574,181" />
        <Packet path="M168,63 C190,63 186,96 206,98" dur={2.2} />
        <Packet path="M168,137 C190,137 186,106 206,104" dur={2.6} delay={0.6} />
        <Packet path="M326,103 L364,99" dur={1.3} delay={0.3} />
        <Packet path="M534,88 C554,88 554,65 574,65" dur={1.6} delay={0.2} color="hsl(var(--ok))" />
        <Packet path="M534,98 C558,98 558,121 574,121" dur={1.7} delay={0.9} color="hsl(var(--danger))" />
        <Packet path="M534,110 C554,110 554,181 574,181" dur={1.9} delay={0.5} color="hsl(var(--warn))" />

        {/* legenda */}
        <g transform="translate(16,188)">
          <rect x="0" y="-9" width="11" height="11" rx="2" fill="hsl(var(--ok))" />
          <text className="dfd-s" x="16" y="0">aprova</text>
          <rect x="70" y="-9" width="11" height="11" rx="2" fill="hsl(var(--danger))" />
          <text className="dfd-s" x="86" y="0">rejeita</text>
          <rect x="140" y="-9" width="11" height="11" rx="2" fill="hsl(var(--warn))" />
          <text className="dfd-s" x="156" y="0">vai pra você</text>
        </g>

        {/* divisória */}
        <line x1="16" y1="248" x2="824" y2="248" stroke="hsl(var(--border))" strokeWidth="1" />

        {/* ───────── ZONA ② — o aprendizado (laço do RAG) ───────── */}
        <text className="dfd-lbl" x="16" y="286">② O APRENDIZADO — laço SEPARADO (o RAG)</text>

        <rect className="dfd-box" x="16" y="306" width="168" height="54" rx="10" />
        <text className="dfd-t" x="30" y="330">Você · Curadoria</text>
        <text className="dfd-s" x="30" y="348">seu gosto 👍 / 👎</text>

        <rect className="dfd-box" x="206" y="306" width="132" height="54" rx="10" />
        <text className="dfd-t" x="220" y="330">write-back</text>
        <text className="dfd-s" x="220" y="348">vira contexto</text>

        <g>
          <rect x="360" y="306" width="150" height="54" rx="10" fill="hsl(var(--purple)/.12)" stroke="hsl(var(--purple))" strokeWidth="1.4" />
          <text className="dfd-t" x="374" y="330">Qdrant :6333</text>
          <text className="dfd-s" x="374" y="348" fill="hsl(var(--purple))" fontWeight="600">docker no ar ✓</text>
        </g>

        <rect className="dfd-box" x="534" y="306" width="180" height="54" rx="10" />
        <text className="dfd-t" x="548" y="330">Arquiteto recupera</text>
        <text className="dfd-s" x="548" y="348">melhora a próxima</text>

        <path id="dfdB1" className="dfd-flow" d="M184,333 L206,333" />
        <path id="dfdB2" className="dfd-flow" d="M338,333 L360,333" />
        <path id="dfdB3" className="dfd-flow" d="M510,333 L534,333" />
        <Packet path="M184,333 L206,333" dur={1.1} color="hsl(var(--purple))" />
        <Packet path="M338,333 L360,333" dur={1.1} delay={0.4} color="hsl(var(--purple))" />
        <Packet path="M510,333 L534,333" dur={1.1} delay={0.8} color="hsl(var(--purple))" />

        {/* planejado: rejeitado → RAG (dashed = ainda não existe) */}
        <path className="dfd-plan" d="M700,144 C700,235 520,250 445,306" />
        <text x="470" y="238" className="dfd-s" fill="hsl(var(--danger))" fontWeight="600">planejado:</text>
        <text x="470" y="253" className="dfd-s" fill="hsl(var(--danger))">rejeitado → RAG</text>
      </svg>
    </div>
  );
}

/** wrapper com título + legenda de leitura, pro topo da doc. */
export function DecisionFlowSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="space-y-3"
    >
      <DecisionFlowDiagram />
      <p className="text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground/90">Como ler:</strong> o <strong>Arquiteto</strong> e o{" "}
        <strong>Auditor</strong> enchem a fila; o <strong>juiz automático</strong> decide só o que é
        objetivo — aprova as propostas 100% limpas, rejeita as que falham — e o que é subjetivo (gaps, gosto)
        ele <strong>deixa pra você</strong> em “Aguardando você”. Embaixo, o laço de aprendizado é{" "}
        <em>separado</em>: só o <strong>seu gosto</strong> na Curadoria vira memória no Qdrant. Fazer o{" "}
        <span className="text-danger">rejeitado alimentar o RAG</span> (linha tracejada) é o próximo passo.
      </p>
    </motion.div>
  );
}
