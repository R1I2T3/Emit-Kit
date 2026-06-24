import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { RunStatusBadge } from "./run-status-badge";
import { Skeleton } from "@Emitkit/ui/components/skeleton";
import { Card } from "@Emitkit/ui/components/card";
import { Play, Calendar, CheckCircle2, AlertTriangle, ArrowUpRight } from "lucide-react";

interface RunsTabProps {
  projectId: string;
}

export function RunsTab({ projectId }: RunsTabProps) {
  // Query project runs
  const { data: runs, isLoading } = useQuery({
    ...orpc.projects.runs.list.queryOptions({ input: { projectId } }),
    refetchInterval: (query) => {
      const runsData = query.state.data;
      const hasActive = runsData?.some(
        (run) => run.status === "queued" || run.status === "running"
      );
      return hasActive ? 5000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32 rounded-lg" />
          <Skeleton className="h-6 w-24 rounded-lg" />
        </div>
        <Card className="border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-1 overflow-hidden">
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </Card>
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <Card className="border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[300px]">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400">
          <Play className="size-5" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h3 className="text-sm font-bold text-foreground">No runs yet</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Trigger your first generation using the button above.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <span>Recent Runs</span>
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-zinc-900 border border-zinc-800 text-muted-foreground">
            {runs.length}
          </span>
        </h2>
      </div>

      <Card className="border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-zinc-950/20 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4 font-semibold">Run ID</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold">Trigger</th>
                <th className="py-3.5 px-4 font-semibold">Created At</th>
                <th className="py-3.5 px-4 font-semibold">Finished At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className="hover:bg-muted/10 transition-colors group"
                >
                  <td className="py-3.5 px-4 font-mono text-zinc-400 font-medium">
                    <span className="flex items-center gap-1.5">
                      {run.id}
                      {run.prUrl && (
                        <a
                          href={run.prUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="opacity-0 group-hover:opacity-100 text-indigo-400 hover:text-indigo-300 transition-opacity cursor-pointer"
                          title="View Pull Request"
                        >
                          <ArrowUpRight className="size-3.5" />
                        </a>
                      )}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <RunStatusBadge status={run.status} />
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="capitalize px-2 py-0.5 rounded-md bg-zinc-900/60 border border-zinc-800/80 text-muted-foreground text-[10px] font-semibold">
                      {run.triggeredBy}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground font-medium">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-zinc-500" />
                      {new Date(run.createdAt).toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground font-medium">
                    {run.finishedAt ? (
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-emerald-500/80" />
                        {new Date(run.finishedAt).toLocaleString()}
                      </span>
                    ) : run.status === "failed" ? (
                      <span className="flex items-center gap-1.5 text-rose-500/80">
                        <AlertTriangle className="size-3.5" />
                        Aborted
                      </span>
                    ) : (
                      <span className="text-zinc-500 italic">In progress...</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
