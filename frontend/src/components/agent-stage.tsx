// agent-stage.tsx — "Estúdio ao vivo": o time de agentes como bonequinhos num
// cenário, conversando SOZINHOS num fluxo automático (PM → Team Lead → Arquiteto):
// quem fala ANDA até o outro, mostra um balão, e a conversa sai no chat ao lado.
// Status real (online/offline iff o modelo está vivo no Ollama). Clicar = rodar (stub).
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MessagesSquare, Wifi, WifiOff, Play, Pause } from "lucide-react";
import type { Agent } from "@/api/types";
import { cn } from "@/lib/utils";

const FACE: Record<string, { emoji: string; tint: string }> = {
  PM: { emoji: "🧭", tint: "from-blue/30 to-blue/5 text-blue" },
  "Team Lead": { emoji: "🛠️", tint: "from-primary/30 to-primary/5 text-primary" },
  Arquiteto: { emoji: "📐", tint: "from-purple/30 to-purple/5 text-purple" },
};
const DEFAULT_FACE = { emoji: "🤖", tint: "from-secondary to-secondary text-muted-foreground" };
const face = (role: string) => FACE[role] ?? DEFAULT_FACE;

interface Step { from: string; fromName: string; to: string; toName: string; text: string }
interface ChatLine extends Step { id: number }

/** Monta a conversa do estúdio a partir dos agentes presentes (PM/Team Lead/Arquiteto). */
function buildDialogue(pm?: Agent, lead?: Agent, arch?: Agent): Step[] {
  if (!pm || !lead || !arch) return [];
  const s = (from: Agent, to: Agent, text: string): Step => ({ from: from.id, fromName: from.name, to: to.id, toName: to.name, text });
  return [
    s(pm, lead, "Bora a sala de estar — preciso do programa."),
    s(lead, arch, "Arquiteto, propõe o layout?"),
    s(arch, lead, "Sofá + rack, circulação 0,80 m. Fechado."),
    s(lead, pm, "Programa pronto pra aprovação."),
    s(pm, lead, "Aprovado. Próxima: cozinha."),
    s(lead, arch, "Cozinha linear — bancada + torre quente?"),
    s(arch, lead, "Isso. Geladeira na ponta, coifa no cooktop."),
    s(lead, pm, "Cozinha ok, dá pra renderizar."),
  ];
}

export function AgentStage({
  agents,
  onRun,
  runningId,
}: {
  agents: Agent[];
  onRun: (id: string) => void;
  runningId?: string | null;
}) {
  const reduce = useReducedMotion();
  const online = agents.filter((a) => a.online).length;
  const n = Math.max(agents.length, 1);

  const find = (role: string, idx: number) => agents.find((a) => a.role === role) ?? agents[idx];
  const pm = find("PM", 0), lead = find("Team Lead", 1), arch = find("Arquiteto", 2);
  const ids = `${pm?.id}|${lead?.id}|${arch?.id}`;
  const dialogue = useMemo(() => buildDialogue(pm, lead, arch), [ids]); // eslint-disable-line react-hooks/exhaustive-deps
  const canAuto = dialogue.length > 0 && [pm, lead, arch].every((a) => a?.online);

  const [playing, setPlaying] = useState(true);
  const [active, setActive] = useState<Step | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const step = useRef(0);
  const seq = useRef(0);

  // loop automático da conversa
  useEffect(() => {
    if (!playing || !canAuto) { setActive(null); return; }
    let alive = true;
    let t1 = 0, t2 = 0;
    const tick = () => {
      if (!alive) return;
      const d = dialogue[step.current % dialogue.length];
      step.current += 1;
      setActive(d);
      setChat((c) => [...c.slice(-14), { ...d, id: ++seq.current }]);
      t1 = window.setTimeout(() => alive && setActive(null), 2500);
      t2 = window.setTimeout(tick, 3600);
    };
    t2 = window.setTimeout(tick, 700);
    return () => { alive = false; clearTimeout(t1); clearTimeout(t2); };
  }, [playing, canAuto, dialogue, ids]);

  const idxOf = (id?: string) => agents.findIndex((a) => a.id === id);
  const homeLeft = (i: number) => ((i + 0.5) / n) * 100;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      {/* cenário */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-b from-card to-background/40 p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Estúdio — time ao vivo</div>
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
              online ? "border-ok/25 bg-ok/10 text-ok" : "border-border bg-secondary text-muted-foreground")}>
              {online ? <Wifi className="size-3" /> : <WifiOff className="size-3" />} {online}/{agents.length} online
            </span>
            <button
              onClick={() => setPlaying((v) => !v)}
              disabled={!canAuto}
              className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50",
                playing ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground")}
            >
              {playing ? <Pause className="size-3" /> : <Play className="size-3" />} {playing ? "conversa auto" : "pausado"}
            </button>
          </div>
        </div>
        <p className="mb-2 text-[11px] text-muted-foreground/60">
          Online = o modelo do agente está vivo no Ollama. A conversa abaixo é uma{" "}
          <b className="text-warn/90">demonstração do fluxo</b> (roteiro) — a conversa REAL entra quando o ciclo do
          motor estiver rodando (o feed é lido do studio_activity.jsonl, por arquivo).
        </p>

        {/* palco — bonequinhos posicionados, andam quando falam */}
        <div className="relative h-[210px] rounded-lg bg-[radial-gradient(130%_90%_at_50%_120%,hsl(var(--primary)/0.07),transparent)]">
          {/* "chão" */}
          <div className="absolute inset-x-3 bottom-7 h-px bg-border/60" />
          {agents.length === 0 ? (
            <div className="grid h-full place-items-center text-xs text-muted-foreground/50">sem agentes</div>
          ) : (
            agents.map((a, i) => {
              const f = face(a.role);
              const isSpeaking = active?.from === a.id;
              const isTarget = active?.to === a.id;
              const isBusy = isSpeaking || runningId === a.id || a.status === "working";
              const bubble = isSpeaking ? active?.text : (a.status === "working" ? a.message : undefined);
              // posição: anda 62% do caminho até o alvo quando está falando
              const home = homeLeft(i);
              const left = isSpeaking && active ? home + 0.62 * (homeLeft(idxOf(active.to)) - home) : home;
              const ring = a.online ? (isBusy ? "ring-warn shadow-[0_0_16px] shadow-warn/40" : isTarget ? "ring-blue/70" : "ring-ok/70")
                : "ring-muted-foreground/30";
              return (
                <motion.div
                  key={a.id}
                  className="absolute bottom-7 -translate-x-1/2"
                  initial={false}
                  animate={{ left: `${left}%` }}
                  transition={{ duration: reduce ? 0 : 0.9, ease: "easeInOut" }}
                  style={{ zIndex: isSpeaking ? 20 : 10 }}
                >
                  <div className="relative flex flex-col items-center gap-1">
                    {/* balão */}
                    <AnimatePresence>
                      {bubble && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.95 }}
                          className="absolute bottom-full mb-1 w-max max-w-[170px] rounded-xl border border-border bg-popover px-2.5 py-1.5 text-[11px] leading-snug text-foreground shadow-pop"
                        >
                          {bubble}
                          <span className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 border-b border-r border-border bg-popover" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.button
                      onClick={() => a.online && onRun(a.id)}
                      disabled={!a.online}
                      title={a.online ? `Rodar ${a.name}` : `${a.name} offline`}
                      animate={reduce ? undefined : { y: isBusy ? [-1, -7, -1] : [0, -4, 0] }}
                      transition={{ duration: isBusy ? 0.6 : 2.6 + i * 0.3, repeat: Infinity, ease: "easeInOut" }}
                      className={cn("grid size-14 place-items-center rounded-full bg-gradient-to-b text-xl ring-2 transition-transform disabled:opacity-50",
                        f.tint, ring, a.online && "hover:scale-105")}
                    >
                      {f.emoji}
                    </motion.button>
                    <div className="-mt-0.5 h-1 w-9 rounded-full bg-black/40 blur-[2px]" />
                    <div className="text-center">
                      <div className="text-[11px] font-semibold leading-none">{a.name}</div>
                      <div className="mt-0.5 text-[9.5px] text-muted-foreground/60">{a.role}</div>
                      {a.model && (
                        <div className="mt-0.5 inline-block rounded bg-secondary px-1 py-px font-mono text-[8.5px] text-muted-foreground/70">
                          {a.model.split(":")[0]}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* chat do time */}
      <div className="flex h-full min-h-[230px] flex-col rounded-xl border border-border bg-popover/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MessagesSquare className="size-4 text-muted-foreground" /> Conversa do time
            <span className="rounded-full border border-warn/30 bg-warn/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-warn">demo</span>
          </div>
          {playing && canAuto && <span className="size-1.5 rounded-full bg-ok animate-pulse-dot" />}
        </div>
        <div ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }} className="flex-1 space-y-2 overflow-y-auto">
          {chat.length === 0 ? (
            <div className="grid h-full place-items-center px-3 text-center text-[11px] text-muted-foreground/50">
              {canAuto ? "iniciando a conversa do time…" : "o time aparece online quando os modelos estão no Ollama."}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {chat.map((m) => {
                const fromAgent = agents.find((a) => a.id === m.from);
                const f = face(fromAgent?.role ?? "");
                const model = fromAgent?.model?.split(":")[0];
                return (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-full bg-gradient-to-b text-xs", f.tint)}>{f.emoji}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground/60">
                        <span className="font-medium text-muted-foreground/85">{m.fromName}</span>
                        {model && <span className="rounded bg-secondary px-1 font-mono text-[9px] text-primary/80">{model}</span>}
                        <span className="text-muted-foreground/40">→ {m.toName}</span>
                      </div>
                      <div className="rounded-lg rounded-tl-sm border border-border bg-card px-2.5 py-1.5 text-xs text-foreground/90">{m.text}</div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
