import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Cpu, Clock, Terminal } from "lucide-react";
import { useRun, useRunLogs, useRunLogStream } from "@/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Timeline } from "@/components/timeline";
import { LogViewer } from "@/components/log-viewer";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

function fmtDur(ms?: number) {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function RunDetail() {
  const { id = "" } = useParams();
  const { data, isLoading, isError, error } = useRun(id);
  const run = data?.run;
  const isRunning = run?.status === "running" || run?.status === "queued";

  const stream = useRunLogStream(id, !!isRunning);
  const logsQuery = useRunLogs(id, !isRunning);
  // na transição running→done, mantém as linhas já transmitidas até a query final resolver
  const lines = (isRunning ? stream.lines : logsQuery.data?.logs) ?? stream.lines;

  return (
    <>
      <Link to="/runs" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Runs
      </Link>

      {isError ? (
        <ErrorState message={error?.message} />
      ) : isLoading || !run ? (
        <LoadingState label="Carregando run…" />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight">{run.title}</h2>
            <StatusPill status={run.status} pulse={isRunning} />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="capitalize">{run.kind}</span>
              {run.model && <span className="inline-flex items-center gap-1"><Cpu className="size-3.5" /> {run.model}</span>}
              <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {timeAgo(run.startedAt)} · {fmtDur(run.durationMs)}</span>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4">
            <Card className="col-span-12 lg:col-span-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Terminal className="size-4 text-muted-foreground" /> Logs</CardTitle>
                {isRunning && <StatusPill tone="info" label="ao vivo" pulse />}
              </CardHeader>
              <CardContent>
                <LogViewer lines={lines} live={isRunning && !stream.done} emptyHint={isRunning ? "Aguardando logs…" : "Sem logs."} />
              </CardContent>
            </Card>

            <div className="col-span-12 space-y-4 lg:col-span-4">
              <Card>
                <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
                <CardContent><Timeline steps={run.steps} /></CardContent>
              </Card>

              {(run.inputs && Object.keys(run.inputs).length > 0) && (
                <Card>
                  <CardHeader><CardTitle>Inputs</CardTitle></CardHeader>
                  <CardContent>
                    <pre className="overflow-x-auto rounded-md border border-border bg-popover p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {JSON.stringify(run.inputs, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {(run.outputs && Object.keys(run.outputs).length > 0) && (
                <Card>
                  <CardHeader><CardTitle>Outputs</CardTitle></CardHeader>
                  <CardContent>
                    <pre className="overflow-x-auto rounded-md border border-border bg-popover p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {JSON.stringify(run.outputs, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {run.artifactIds.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Artefatos</CardTitle></CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {run.artifactIds.map((a) => (
                      <Link key={a} to="/artifacts" className="rounded-md border border-border bg-secondary px-2 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground">
                        {a}
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
