import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useContext } from "react";
import {
  Building2,
  Users,
  Terminal,
  FolderPlus,
  AlertCircle,
  Plus,
  User,
  GitFork,
} from "lucide-react";

import { orpc } from "@/utils/orpc";
import { OrgContext } from "./route";
import { Skeleton } from "@Emitkit/ui/components/skeleton";
import { Card } from "@Emitkit/ui/components/card";
import { Button } from "@Emitkit/ui/components/button";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { selectedOrgId } = useContext(OrgContext);

  const { data: org, isLoading, refetch } = useQuery({
    ...orpc.orgs.get.queryOptions({ input: { orgId: selectedOrgId } }),
    enabled: !!selectedOrgId,
  });

  // Empty State: No organization selected
  if (!selectedOrgId) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center p-4">
        <div className="max-w-[480px] w-full text-center space-y-6 bg-card/40 backdrop-blur-xl border border-border/80 rounded-2xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
          <div className="flex items-center justify-center mx-auto w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Building2 className="size-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome to Emitkit</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To get started, please select an existing organization from the sidebar switcher or create a new one.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading State with clean skeletons matching the dashboard cards exactly to avoid layout shifts
  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 rounded-md" />
            <Skeleton className="h-3 w-32 rounded-md" />
          </div>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card
              key={i}
              className="relative overflow-hidden border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-6 shadow-xs flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-16 rounded-md" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
                <Skeleton className="size-10 rounded-xl shrink-0" />
              </div>
              <Skeleton className="h-3 w-40 rounded-md mt-2" />
            </Card>
          ))}
        </div>

        {/* Projects Section Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-24 rounded-md" />
          <div className="border border-dashed border-border/80 rounded-2xl p-12 bg-card/10 flex flex-col items-center justify-center min-h-[320px]">
            <Skeleton className="size-16 rounded-2xl mb-6" />
            <Skeleton className="h-6 w-36 rounded-md mb-2" />
            <Skeleton className="h-4 w-64 rounded-md mb-1" />
            <Skeleton className="h-4 w-48 rounded-md mb-6" />
            <Skeleton className="h-8 w-36 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (!org) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center p-4">
        <div className="max-w-[480px] w-full text-center space-y-6 bg-destructive/5 border border-destructive/20 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center justify-center mx-auto w-16 h-16 rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle className="size-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Failed to load organization</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We couldn't retrieve the details for this organization. Please verify your permissions or try again.
            </p>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="mx-auto px-5 py-2 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10 cursor-pointer"
          >
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  // Premium, modern Dashboard View
  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-xl text-white shadow-md ${
          org.isPersonal
            ? "bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-violet-500/20"
            : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20"
        }`}>
          {org.isPersonal ? <User className="size-5" /> : <Building2 className="size-5" />}
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-b from-foreground to-foreground/80 bg-clip-text text-transparent">
            {org.name}
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            {org.isPersonal ? "Personal Workspace" : "Workspace Dashboard"}
          </p>
        </div>
      </div>

      {/* Statistics Cards using HSL-tailored colors, subtle gradients, and elegant glows */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Card 1: Members / Repositories */}
        <Card className="relative overflow-hidden border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-6 shadow-xs hover:shadow-md transition-all duration-300 group">
          {/* Top border glow gradient */}
          <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${
            org.isPersonal
              ? "from-violet-500/40 via-fuchsia-500/40 to-transparent"
              : "from-emerald-500/40 via-teal-500/40 to-transparent"
          } opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {org.isPersonal ? "Repositories" : "Members"}
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">{org.memberCount}</p>
            </div>
            <div className={`flex size-10 items-center justify-center rounded-xl border group-hover:scale-105 transition-transform duration-300 ${
              org.isPersonal
                ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            }`}>
              {org.isPersonal ? <GitFork className="size-5" /> : <Users className="size-5" />}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-4">
            {org.isPersonal ? "Accessible personal repositories" : "Active collaborators in workspace"}
          </p>
        </Card>

        {/* Card 2: Workspace Slug */}
        <Card className="relative overflow-hidden border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-6 shadow-xs hover:shadow-md transition-all duration-300 group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="flex items-center justify-between">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Workspace Slug</p>
              <p className="text-base font-bold text-foreground truncate mt-2" title={org.slug}>
                {org.slug}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:scale-105 transition-transform duration-300 shrink-0">
              <Terminal className="size-5" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-4">Unique resource identifier</p>
        </Card>

        {/* Card 3: GitHub Integration */}
        <Card className="relative overflow-hidden border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-6 shadow-xs hover:shadow-md transition-all duration-300 group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-pink-500/40 via-purple-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="flex items-center justify-between">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {org.isPersonal ? "GitHub User ID" : "GitHub Org ID"}
              </p>
              <p className="text-base font-bold text-foreground truncate mt-2" title={org.githubOrgId}>
                {org.githubOrgId}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 group-hover:scale-105 transition-transform duration-300 shrink-0">
              <svg className="size-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-4">
            {org.isPersonal ? "Linked personal account" : "Linked version control provider"}
          </p>
        </Card>
      </div>


      {/* Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-foreground">Projects</h2>
        </div>

        {/* High-fidelity Projects Placeholder Card */}
        <div className="relative flex flex-col items-center justify-center text-center p-12 border border-dashed border-border/85 rounded-2xl bg-card/20 backdrop-blur-xs transition-all duration-300 hover:bg-card/30 group overflow-hidden min-h-[320px]">
          {/* Subtle glow background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/10 transition-colors duration-500" />

          {/* Premium styled icon / illustration container */}
          <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 shadow-[inset_0_2px_4px_rgba(255,255,255,0.05)] mb-6 transition-transform duration-300 group-hover:scale-105">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xs pointer-events-none" />
            <FolderPlus className="size-7 text-indigo-400 group-hover:text-indigo-300 transition-colors duration-300 z-10" />
          </div>

          <h3 className="text-base font-bold tracking-tight text-foreground z-10">
            No projects found
          </h3>

          <p className="text-xs text-muted-foreground max-w-[280px] mt-2 leading-relaxed z-10">
            Projects organize your SDK specs, build pipelines, and version releases.
          </p>

          <Button
            className="mt-6 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-300 shadow-md hover:shadow-lg font-medium cursor-pointer active:scale-98 z-10"
            variant="default"
            size="default"
          >
            <Plus className="size-3.5" />
            <span>Create Project</span>
          </Button>
        </div>
      </div>
    </div>
  );
}


