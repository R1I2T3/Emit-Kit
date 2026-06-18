import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useContext } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderPlus, GitBranch, ArrowLeft, Loader2, Sparkles, Shield, Globe } from "lucide-react";

import { orpc } from "@/utils/orpc";
import { OrgContext } from "./route";
import { RepoPicker } from "@/components/projects/repo-picker";
import { Button } from "@Emitkit/ui/components/button";
import { Input } from "@Emitkit/ui/components/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@Emitkit/ui/components/select";
import { cn } from "@Emitkit/ui/lib/utils";

export const Route = createFileRoute("/_auth/projects/new")({
  component: RouteComponent,
});

function RouteComponent() {
  const { selectedOrgId } = useContext(OrgContext);
  const navigate = useNavigate();
  const [sourceType, setSourceType] = useState<"existing" | "new">("existing");

  // State for existing repo
  const [repoFullName, setRepoFullName] = useState("");
  const [specPath, setSpecPath] = useState("openapi.yaml");
  const [defaultBranch, setDefaultBranch] = useState("main");

  // State for new repo
  const [repoName, setRepoName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");

  // Get current org details
  const { data: org, isLoading: isOrgLoading } = useQuery({
    ...orpc.orgs.get.queryOptions({ input: { orgId: selectedOrgId } }),
    enabled: !!selectedOrgId,
  });

  const createFromExistingMutation = useMutation(orpc.projects.createFromExistingRepo.mutationOptions());
  const createNewRepoMutation = useMutation(orpc.projects.createNewRepo.mutationOptions());

  const handleConnectExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoFullName) {
      toast.error("Please select a GitHub repository");
      return;
    }
    if (!specPath.trim()) {
      toast.error("Please specify a spec path (e.g. openapi.yaml)");
      return;
    }

    createFromExistingMutation.mutate(
      {
        orgId: selectedOrgId,
        repoFullName,
        specPath: specPath.trim(),
        defaultBranch: defaultBranch.trim() || "main",
      },
      {
        onSuccess: (project: any) => {
          toast.success("Project connected successfully!");
          navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to connect repository");
        },
      }
    );
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoName.trim()) {
      toast.error("Please enter a repository name");
      return;
    }

    const orgLogin = org?.isPersonal ? undefined : org?.slug;

    createNewRepoMutation.mutate(
      {
        orgId: selectedOrgId,
        repoName: repoName.trim(),
        visibility,
        orgLogin,
      },
      {
        onSuccess: (project: any) => {
          toast.success("Repository created and project initialized!");
          navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to create repository");
        },
      }
    );
  };

  const isMutating = createFromExistingMutation.isPending || createNewRepoMutation.isPending;

  if (isOrgLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading workspace details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[640px] mx-auto space-y-6 pt-4 pb-12">
      {/* Back link */}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors no-underline cursor-pointer group"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
        Back to Dashboard
      </Link>

      <div className="relative overflow-hidden border border-border/80 bg-card/40 backdrop-blur-xl rounded-2xl p-8 shadow-xl">
        {/* Decorative Top Highlight */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        
        {/* Glow ambient background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Branding header */}
        <div className="flex items-center gap-3 mb-6 relative">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <FolderPlus className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Create New Project
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect a schema and set up your client SDK workflow
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 border border-border/60 bg-background/30 rounded-xl mb-6 relative">
          <button
            type="button"
            disabled={isMutating}
            onClick={() => setSourceType("existing")}
            className={cn(
              "py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer border border-transparent disabled:opacity-50",
              sourceType === "existing"
                ? "bg-zinc-900 border-zinc-800 text-foreground shadow-sm animate-none"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/5"
            )}
          >
            Connect existing repository
          </button>
          <button
            type="button"
            disabled={isMutating}
            onClick={() => setSourceType("new")}
            className={cn(
              "py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer border border-transparent disabled:opacity-50",
              sourceType === "new"
                ? "bg-zinc-900 border-zinc-800 text-foreground shadow-sm animate-none"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/5"
            )}
          >
            Create new repository
          </button>
        </div>

        {/* Connection Form */}
        {sourceType === "existing" ? (
          <form onSubmit={handleConnectExisting} className="space-y-5 relative">
            <div className="space-y-1">
              <RepoPicker value={repoFullName} onValueChange={setRepoFullName} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  OpenAPI Spec Path
                </label>
                <Input
                  type="text"
                  placeholder="openapi.yaml"
                  value={specPath}
                  onChange={(e) => setSpecPath(e.target.value)}
                  className="rounded-xl border-border bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/50 text-sm"
                  disabled={isMutating}
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Relative path to your API spec in the repository.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Default Branch
                </label>
                <Input
                  type="text"
                  placeholder="main"
                  value={defaultBranch}
                  onChange={(e) => setDefaultBranch(e.target.value)}
                  className="rounded-xl border-border bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/50 text-sm"
                  disabled={isMutating}
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  The primary branch to track webhook triggers on.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isMutating || !repoFullName}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-5 text-sm font-semibold cursor-pointer"
              >
                {createFromExistingMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Connecting Project...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    <span>Create Project</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreateNew} className="space-y-5 relative">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Repository Name
              </label>
              <div className="flex items-center gap-2">
                {org && (
                  <span className="text-sm font-medium text-muted-foreground shrink-0 bg-background/40 px-3 py-1.5 rounded-xl border border-border/80">
                    {org.slug} /
                  </span>
                )}
                <Input
                  type="text"
                  placeholder="my-new-api"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="rounded-xl border-border bg-background/50 focus-visible:ring-1 focus-visible:ring-primary/50 text-sm flex-1"
                  disabled={isMutating}
                  required
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                We'll create this repository on GitHub and commit a starter `openapi.yaml` to it.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Visibility
              </label>
              <Select
                value={visibility}
                onValueChange={(val) => setVisibility(val as "public" | "private")}
                disabled={isMutating}
              >
                <SelectTrigger className="w-full h-10 rounded-xl bg-background/50 border-border">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">
                    <span className="flex items-center gap-2">
                      <Shield className="size-3.5 text-indigo-400" />
                      <span>Private</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="public">
                    <span className="flex items-center gap-2">
                      <Globe className="size-3.5 text-emerald-400" />
                      <span>Public</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isMutating || !repoName}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-5 text-sm font-semibold cursor-pointer"
              >
                {createNewRepoMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Creating Repository...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    <span>Create Project</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
