// architecture-diagram.tsx — a ARQUITETURA (browser → BFF → motor), num diagrama.
// Substitui as 9 camadas em texto do layers.ts. O ponto honesto: o React fala SÓ com
// /api/*; o BFF lê o motor por ARQUIVO (read-only); o runner é STUB; e o motor (pipeline,
// Qdrant, oráculo) roda FORA do cockpit.
import { motion } from "framer-motion";
import { Packet } from "./decision-flow-diagram";

export function ArchitectureDiagram() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card/40 p-3 sm:p-4">
      <svg viewBox="0 0 840 322" className="h-auto w-full min-w-[720px]"
        role="img" aria-labelledby="ar-t ar-d" fontFamily="ui-sans-serif, system-ui, sans-serif">
        <title id="ar-t">Arquitetura do cockpit</title>
        <desc id="ar-d">
          O browser abre só :8782; o React fala só com /api/*; o BFF (server.py) conversa com o
          Ollama de verdade e lê o motor sketchup-mcp por arquivo, read-only. O motor — pipeline,
          Qdrant e oráculo — roda fora do cockpit.
        </desc>
        <style>{`
          .ar-box{fill:hsl(var(--card));stroke:hsl(var(--border));stroke-width:1.4}
          .ar-hub{fill:hsl(var(--secondary));stroke:hsl(var(--primary));stroke-width:2}
          .ar-t{fill:hsl(var(--foreground));font-weight:650;font-size:12.5px}
          .ar-s{fill:hsl(var(--muted-foreground));font-size:10.5px}
          .ar-lbl{fill:hsl(var(--muted-foreground));font-style:italic;font-size:10px}
          .ar-flow{stroke:hsl(var(--muted-foreground)/.55);stroke-width:1.5;fill:none;marker-end:url(#ar-ar)}
          .ar-mono{font-family:ui-monospace,monospace;font-size:10px}
        `}</style>
        <defs>
          <marker id="ar-ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="hsl(var(--muted-foreground)/.7)" />
          </marker>
        </defs>

        {/* Row 1 — caminho da requisição */}
        <rect className="ar-box" x="16" y="28" width="150" height="56" rx="10" />
        <text className="ar-t" x="30" y="52">Browser</text>
        <text className="ar-s ar-mono" x="30" y="70">:8782 única origem</text>

        <rect className="ar-box" x="206" y="28" width="168" height="56" rx="10" />
        <text className="ar-t" x="220" y="52">Frontend React</text>
        <text className="ar-s" x="220" y="70">frontend/dist</text>

        <rect className="ar-hub" x="414" y="20" width="204" height="72" rx="12" />
        <text className="ar-t" x="428" y="44">BFF · server.py</text>
        <text className="ar-s ar-mono" x="428" y="61">:8782 · cockpit_api</text>
        <text className="ar-s" x="428" y="77" fill="hsl(var(--warn))">runner = STUB</text>

        <path className="ar-flow" d="M166,56 L206,56" />
        <path id="arF2" className="ar-flow" d="M374,56 L414,56" />
        <text className="ar-lbl" x="376" y="48">só /api/*</text>
        <Packet path="M166,56 L206,56" dur={1.0} />
        <Packet path="M374,56 L414,56" dur={1.0} delay={0.5} />

        {/* Row 2 — com quem o BFF fala */}
        <rect className="ar-box" x="300" y="140" width="170" height="56" rx="10" />
        <text className="ar-t" x="314" y="164">Ollama :11434</text>
        <text className="ar-s" x="314" y="182" fill="hsl(var(--ok))">chat REAL</text>

        <rect className="ar-box" x="512" y="132" width="232" height="70" rx="12" stroke="hsl(var(--blue))" />
        <text className="ar-t" x="526" y="156">Motor · sketchup-mcp</text>
        <text className="ar-s" x="526" y="174">fonte de verdade do domínio</text>
        <text className="ar-s ar-mono" x="526" y="190" fill="hsl(var(--blue))">lido por ARQUIVO (read-only)</text>

        <path id="arF3" className="ar-flow" d="M474,92 C440,112 410,120 392,140" />
        <path id="arF4" className="ar-flow" d="M556,92 C596,110 606,116 620,132" />
        <text className="ar-lbl" x="470" y="124">chat</text>
        <text className="ar-lbl" x="592" y="120">lê arquivos</text>
        <Packet path="M474,92 C440,112 410,120 392,140" dur={1.4} color="hsl(var(--ok))" />
        <Packet path="M556,92 C596,110 606,116 620,132" dur={1.4} delay={0.4} color="hsl(var(--blue))" />

        {/* Row 3 — o motor roda FORA do cockpit */}
        <rect className="ar-box" x="430" y="248" width="132" height="52" rx="10" />
        <text className="ar-t" x="444" y="270">Pipeline</text>
        <text className="ar-s" x="444" y="287">PDF → .skp</text>

        <rect className="ar-box" x="578" y="248" width="112" height="52" rx="10" stroke="hsl(var(--purple))" />
        <text className="ar-t" x="592" y="270">Qdrant</text>
        <text className="ar-s ar-mono" x="592" y="287" fill="hsl(var(--purple))">:6333 · RAG</text>

        <rect className="ar-box" x="706" y="248" width="120" height="52" rx="10" stroke="hsl(var(--blue))" />
        <text className="ar-t" x="720" y="270">Oráculo</text>
        <text className="ar-s ar-mono" x="720" y="287" fill="hsl(var(--blue))">:8765</text>

        <path className="ar-flow" d="M600,202 C540,222 520,232 500,248" />
        <path className="ar-flow" d="M628,202 L632,248" />
        <path className="ar-flow" d="M652,202 C716,222 742,232 762,248" />
        <text className="ar-lbl" x="430" y="238">rodam FORA do cockpit (o BFF não os aciona)</text>
      </svg>
    </div>
  );
}

export function ArchitectureSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }} className="space-y-3"
    >
      <ArchitectureDiagram />
      <p className="text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground/90">Uma origem só, um sentido só.</strong> Você abre{" "}
        <strong>:8782</strong>; o React fala <strong>só com /api/*</strong>; o <strong>BFF</strong>{" "}
        conversa de verdade com o Ollama e <span className="text-blue">lê o motor por ARQUIVO,
        read-only</span> — nunca o altera (a única escrita é mover uma proposta). O motor de verdade
        (pipeline, Qdrant, oráculo) roda <em>fora</em> do cockpit; o runner do BFF ainda é um{" "}
        <span className="text-warn">stub</span>.
      </p>
    </motion.div>
  );
}
