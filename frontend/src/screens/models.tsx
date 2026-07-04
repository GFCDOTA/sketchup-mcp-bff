import { useEffect, useState } from "react";
import { Cpu, Send, Sparkles } from "lucide-react";
import { useModels, useChat } from "@/api/hooks";
import type { ModelInfo } from "@/api/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { cn } from "@/lib/utils";

function fmtSize(bytes?: number) {
  if (!bytes) return "";
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

/** Corpo da aba "Modelos" da tela Operação (sem header próprio). */
export function ModelsPanel() {
  const { data, isLoading, isError, error } = useModels();
  const chat = useChat();
  const [selected, setSelected] = useState<string>("");
  const [prompt, setPrompt] = useState("Sugira um sofá para uma sala de 4×3.5m em estilo industrial.");

  const models = data?.models ?? [];
  useEffect(() => {
    // default = primeiro modelo que CONVERSA (embedding dá 400 no /api/chat)
    if (!selected && models.length) setSelected((models.find((m) => m.chat !== false) ?? models[0]).name);
  }, [models, selected]);

  const selectedModel = models.find((m) => m.name === selected);
  const selectedIsEmbedding = selectedModel?.chat === false;

  const send = () => {
    if (!selected || !prompt.trim() || selectedIsEmbedding) return;
    chat.mutate({ model: selected, messages: [{ role: "user", content: prompt }] });
  };

  if (isError) return <ErrorState message={error?.message} />;
  if (isLoading) return <LoadingState label="Consultando Ollama…" />;
  if (data?.source === "none")
    return (
      <Card>
        <EmptyState icon={Cpu} title="Ollama offline" sub={data.hint ?? "Suba o Ollama (ollama serve) para listar e testar modelos."} />
      </Card>
    );

  return (
    <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 lg:col-span-5">
            <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="size-4 text-muted-foreground" /> {models.length} modelos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {models.map((m) => (
                <ModelRow key={m.name} m={m} active={m.name === selected} onClick={() => setSelected(m.name)} />
              ))}
            </CardContent>
          </Card>

          <Card className="col-span-12 lg:col-span-7" accent="blue">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-muted-foreground" /> Testar prompt</CardTitle>
              {selected && <Badge variant="info" className="normal-case">{selected}</Badge>}
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="Digite um prompt…" />
              {selectedIsEmbedding && (
                <div className="rounded-md border border-warn/30 bg-warn/[0.06] p-2.5 text-xs text-muted-foreground">
                  <code className="text-foreground/80">{selected}</code> é um modelo de <b>embedding</b> — ele
                  vetoriza texto pro RAG (banco de memória do projeto), não conversa. Escolha um modelo de
                  geração ao lado (qwen2.5-coder, llama3.1, deepseek-r1…).
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={send} disabled={chat.isPending || !selected || selectedIsEmbedding}>
                  <Send className="size-3.5" /> {chat.isPending ? "Gerando…" : "Enviar"}
                </Button>
                {chat.data && <span className="text-xs text-muted-foreground">{chat.data.tookMs} ms</span>}
              </div>

              {chat.isError && <ErrorState message={(chat.error as Error)?.message} />}
              {chat.data && (
                <div className="rounded-md border border-border bg-background/60 p-3 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {chat.data.message.content}
                </div>
              )}
              {chat.isPending && <LoadingState label="O modelo está pensando…" />}
            </CardContent>
          </Card>
        </div>
  );
}

function ModelRow({ m, active, onClick }: { m: ModelInfo; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
        active ? "border-primary/40 bg-primary/5" : "border-border bg-background/40 hover:border-border/80",
      )}
    >
      <Cpu className={cn("size-4", active ? "text-primary" : "text-muted-foreground/60")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-sm">{m.name}</span>
          {m.chat === false && <Badge variant="outline" className="shrink-0 text-[10px]">embedding · sem chat</Badge>}
        </div>
        <div className="text-[11px] text-muted-foreground/60">
          {[m.parameterSize, m.quantization, fmtSize(m.sizeBytes)].filter(Boolean).join(" · ")}
        </div>
      </div>
    </button>
  );
}
