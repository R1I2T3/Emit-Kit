import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  GitCommit,
  GitBranch,
  Tag,
  Clock,
  Play,
  Cpu,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

import { orpc } from "@/utils/orpc";
import { LogStream } from "@/components/projects/log-stream";
import { RunStatusBadge } from "@/components/projects/run-status-badge";
import { Card } from "@Emitkit/ui/components/card";

export const Route = createFileRoute("/_auth/runs/$runId")({
  component: RunDetailComponent,
});

function RunDetailComponent() {
  const { runId } = Route.useParams();

  // Query run details
  const { data: run, isLoading: isLoadingRun, error: runError } = useQuery({
    ...orpc.projects.runs.get.queryOptions({ input: { runId } }),
    refetchInterval: (query) => {
      const runData = query.state.data;
      return runData?.status === "queued" || runData?.status === "running" ? 2000 : false;
    },
  });

  // Query project details (when run is loaded)
  const { data: project } = useQuery({
    ...orpc.projects.get.queryOptions({ input: { projectId: run?.projectId ?? "" } }),
    enabled: !!run?.projectId,
  });

  if (isLoadingRun) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading run details...</p>
        </div>
      </div>
    );
  }

  if (runError || !run) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center p-4">
        <div className="max-w-[480px] w-full text-center space-y-6 bg-destructive/5 border border-destructive/20 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center justify-center mx-auto w-16 h-16 rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Run not found</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We couldn't retrieve the details for this generation run. It may not exist, or you might not have permission to view it.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center h-9 px-4 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold no-underline"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const durationMs = run.finishedAt
    ? new Date(run.finishedAt).getTime() - new Date(run.createdAt).getTime()
    : null;

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pt-4 pb-12">
      {/* Back Button */}
      <Link
        to="/projects/$projectId"
        params={{ projectId: run.projectId }}
        className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors no-underline cursor-pointer group"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
        Back to {project?.repoFullName || "Project"}
      </Link>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground font-mono">
              Run: {run.id}
            </h1>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            Project: <span className="text-foreground font-semibold">{project?.repoFullName || "Loading..."}</span>
          </p>
        </div>

        {run.prUrl && (
          <a
            href={run.prUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <span>View Pull Request</span>
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      {/* Metadata Grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {/* Metadata Card 1: Trigger & SDK Version */}
        <Card className="border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Trigger</h3>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400">
                {run.triggeredBy === "webhook" ? <Cpu className="size-4" /> : <Play className="size-4" />}
              </span>
              <span className="text-sm font-semibold capitalize text-foreground">{run.triggeredBy}</span>
            </div>
          </div>
          {run.sdkVersion && (
            <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Tag className="size-3.5 text-purple-400" />
              <span>SDK: {run.sdkVersion}</span>
            </div>
          )}
        </Card>

        {/* Metadata Card 2: Branch & Commit */}
        <Card className="border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Source</h3>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400">
                <GitBranch className="size-4" />
              </span>
              <span className="text-sm font-semibold text-foreground truncate max-w-[150px]" title={run.branchName || "main"}>
                {run.branchName || "main"}
              </span>
            </div>
          </div>
          {run.commitSha && (
            <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-1.5 text-xs text-muted-foreground">
              <GitCommit className="size-3.5 text-indigo-400" />
              <span className="font-mono text-[10px]" title={run.commitSha}>
                {run.commitSha.substring(0, 7)}
              </span>
            </div>
          )}
        </Card>

        {/* Metadata Card 3: Created At */}
        <Card className="border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Created At</h3>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400">
                <Calendar className="size-4" />
              </span>
              <span className="text-xs font-semibold text-foreground">
                {new Date(run.createdAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/40 text-[10px] text-muted-foreground">
            {new Date(run.createdAt).toLocaleDateString()}
          </div>
        </Card>

        {/* Metadata Card 4: Timing & Duration */}
        <Card className="border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Duration</h3>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400">
                <Clock className="size-4" />
              </span>
              <span className="text-sm font-semibold text-foreground">
                {durationMs ? formatDuration(durationMs) : run.status === "failed" ? "Aborted" : "In progress..."}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/40 text-[10px] text-muted-foreground">
            {run.finishedAt ? `Finished: ${new Date(run.finishedAt).toLocaleTimeString()}` : "Active"}
          </div>
        </Card>
      </div>

      {/* Log Terminal section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <span>Execution Logs</span>
        </h2>
        <LogStream runId={run.id} status={run.status} initialLogs={run.logs} />
      </div>
    </div>
  );
}
