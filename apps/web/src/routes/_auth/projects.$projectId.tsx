import { useQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  GitBranch,
  FileCode,
  CheckCircle2,
  Trash2,
  Settings,
  Layout,
  ExternalLink,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Webhook,
  Activity,
  Code2,
  Play,
  SlidersHorizontal,
  Tag
} from "lucide-react";

import { orpc } from "@/utils/orpc";
import { Button } from "@Emitkit/ui/components/button";
import { Card } from "@Emitkit/ui/components/card";
import { cn } from "@Emitkit/ui/lib/utils";
import { RunsTab } from "@/components/projects/runs-tab";
import { ConfigTab } from "@/components/projects/config-tab";

export const Route = createFileRoute("/_auth/projects/$projectId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "runs" | "config" | "versions" | "settings">("overview");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load project details
  const { data: project, isLoading, error } = useQuery({
    ...orpc.projects.get.queryOptions({ input: { projectId } }),
  });

  const deleteMutation = useMutation(orpc.projects.delete.mutationOptions());

  const triggerMutation = useMutation({
    ...orpc.projects.runs.trigger.mutationOptions(),
    onSuccess: () => {
      toast.success("Generation run triggered");
      setActiveTab("runs");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to trigger generation");
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate(
      { projectId },
      {
        onSuccess: () => {
          toast.success("Project deleted successfully");
          navigate({ to: "/dashboard" });
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to delete project");
          setShowDeleteConfirm(false);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center p-4">
        <div className="max-w-[480px] w-full text-center space-y-6 bg-destructive/5 border border-destructive/20 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center justify-center mx-auto w-16 h-16 rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Project not found</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We couldn't retrieve the details for this project. It may have been deleted, or you might not have permission to view it.
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

  return (
    <div className="space-y-8 max-w-5xl mx-auto pt-4 pb-12">
      {/* Back to Dashboard */}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors no-underline cursor-pointer group"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
        Back to Dashboard
      </Link>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              {project.repoFullName}
            </h1>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold shrink-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              Active
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1">
              <GitBranch className="size-3.5 text-indigo-400" />
              {project.defaultBranch}
            </span>
            <span className="text-border/80">•</span>
            <span className="flex items-center gap-1">
              <FileCode className="size-3.5 text-purple-400" />
              {project.specPath}
            </span>
          </div>
        </div>

        {/* Action controls / Tabs */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 p-1 border border-border/80 bg-background/30 rounded-xl max-w-max">
            <button
              onClick={() => {
                setActiveTab("overview");
                setShowDeleteConfirm(false);
              }}
              className={cn(
                "flex items-center gap-1.5 py-1.5 px-3.5 text-xs font-semibold rounded-lg transition-all cursor-pointer border border-transparent",
                activeTab === "overview"
                  ? "bg-zinc-900 border-zinc-800 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/5"
              )}
            >
              <Layout className="size-3.5" />
              Overview
            </button>
            <button
              onClick={() => {
                setActiveTab("runs");
                setShowDeleteConfirm(false);
              }}
              className={cn(
                "flex items-center gap-1.5 py-1.5 px-3.5 text-xs font-semibold rounded-lg transition-all cursor-pointer border border-transparent",
                activeTab === "runs"
                  ? "bg-zinc-900 border-zinc-800 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/5"
              )}
            >
              <Activity className="size-3.5" />
              Runs
            </button>
            <button
              onClick={() => {
                setActiveTab("config");
                setShowDeleteConfirm(false);
              }}
              className={cn(
                "flex items-center gap-1.5 py-1.5 px-3.5 text-xs font-semibold rounded-lg transition-all cursor-pointer border border-transparent",
                activeTab === "config"
                  ? "bg-zinc-900 border-zinc-800 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/5"
              )}
            >
              <SlidersHorizontal className="size-3.5" />
              Config
            </button>
            <button
              onClick={() => {
                setActiveTab("versions");
                setShowDeleteConfirm(false);
              }}
              className={cn(
                "flex items-center gap-1.5 py-1.5 px-3.5 text-xs font-semibold rounded-lg transition-all cursor-pointer border border-transparent",
                activeTab === "versions"
                  ? "bg-zinc-900 border-zinc-800 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/5"
              )}
            >
              <Tag className="size-3.5" />
              Versions
            </button>
            <button
              onClick={() => {
                setActiveTab("settings");
                setShowDeleteConfirm(false);
              }}
              className={cn(
                "flex items-center gap-1.5 py-1.5 px-3.5 text-xs font-semibold rounded-lg transition-all cursor-pointer border border-transparent",
                activeTab === "settings"
                  ? "bg-zinc-900 border-zinc-800 text-foreground shadow-sm animate-none"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/5"
              )}
            >
              <Settings className="size-3.5" />
              Settings
            </button>
          </div>

          <Button
            onClick={() => triggerMutation.mutate({ projectId })}
            disabled={triggerMutation.isPending}
            className="rounded-xl font-semibold cursor-pointer shadow-xs border border-transparent hover:brightness-110 active:scale-[0.98] transition-all bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            {triggerMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
                Triggering...
              </>
            ) : (
              <>
                <Play className="size-3.5 mr-1.5" />
                Trigger Generation
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Tab Switcher Display */}
      {activeTab === "overview" && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Card 1: Repository details */}
          <Card className="relative overflow-hidden border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-6 shadow-xs flex flex-col justify-between group">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Repository</h3>
                <GitBranch className="size-5 text-indigo-400" />
              </div>
              <div className="space-y-2">
                <p className="text-base font-bold text-foreground break-all">{project.repoFullName}</p>
                <p className="text-xs text-muted-foreground">Default branch is set to <span className="font-semibold text-foreground">{project.defaultBranch}</span>.</p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
              <a
                href={`https://github.com/${project.repoFullName}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 no-underline cursor-pointer"
              >
                View GitHub
                <ExternalLink className="size-3" />
              </a>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="size-3" />
                {new Date(project.createdAt).toLocaleDateString()}
              </span>
            </div>
          </Card>

          {/* Card 2: OpenAPI configuration */}
          <Card className="relative overflow-hidden border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-6 shadow-xs flex flex-col justify-between group">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">API Spec</h3>
                <Code2 className="size-5 text-purple-400" />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-mono bg-zinc-900/60 border border-zinc-800 px-2 py-1.5 rounded-lg text-purple-300 break-all select-all max-w-max">
                  {project.specPath}
                </p>
                <p className="text-xs text-muted-foreground">This path points to your OpenAPI specification schema in the repository.</p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Activity className="size-3 text-emerald-400 animate-pulse" />
                Auto-Synced
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                <CheckCircle2 className="size-3 text-emerald-400" />
                Valid
              </span>
            </div>
          </Card>

          {/* Card 3: Webhook status */}
          <Card className="relative overflow-hidden border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-6 shadow-xs flex flex-col justify-between group">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Webhook</h3>
                <Webhook className="size-5 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-xs font-semibold text-foreground">Webhook ID: {project.webhookId || "None"}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  The GitHub webhook triggers SDK updates whenever new API specifications are pushed.
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                Status: <span className="text-emerald-400 font-bold">Connected</span>
              </span>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "runs" && (
        <RunsTab projectId={projectId} />
      )}

      {activeTab === "config" && (
        <ConfigTab projectId={projectId} />
      )}

      {activeTab === "versions" && (
        <Card className="border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[300px]">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400">
            <Tag className="size-5" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h3 className="text-sm font-bold text-foreground">Versions and Published Releases</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Versions and published releases will be shown here in a future phase.
            </p>
          </div>
        </Card>
      )}

      {activeTab === "settings" && (
        <div className="space-y-6 max-w-2xl">
          {/* Danger zone panel */}
          <Card className="relative overflow-hidden border border-destructive/20 bg-destructive/5 rounded-2xl p-6 shadow-xs">
            <div className="flex items-start gap-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive shrink-0">
                <Trash2 className="size-5" />
              </div>
              <div className="space-y-4 flex-1">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">Delete this project</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Permanently delete <span className="font-semibold text-foreground">{project.repoFullName}</span>. 
                    This will remove the webhook integration from GitHub, wipe all local configurations, and delete its history. 
                    This action cannot be undone.
                  </p>
                </div>

                {!showDeleteConfirm ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="rounded-xl px-4 font-semibold cursor-pointer"
                  >
                    Delete Project
                  </Button>
                ) : (
                  <div className="space-y-3 p-4 border border-destructive/20 bg-destructive/10 rounded-xl">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="size-4 shrink-0" />
                      <p className="text-xs font-semibold">Are you absolutely sure you want to delete this project?</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={deleteMutation.isPending}
                        onClick={handleDelete}
                        className="rounded-xl px-4 font-semibold cursor-pointer border border-transparent"
                      >
                        {deleteMutation.isPending ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin mr-1.5" />
                            Deleting...
                          </>
                        ) : (
                          "Yes, Delete Project"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={deleteMutation.isPending}
                        onClick={() => setShowDeleteConfirm(false)}
                        className="rounded-xl px-4 font-semibold cursor-pointer"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
