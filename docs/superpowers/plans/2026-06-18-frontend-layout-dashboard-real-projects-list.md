# Frontend Layout & Dashboard Real Projects List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the dashboard page and implement the project card component to list real projects from the database.

**Architecture:** Create `/projects/new` and `/projects/$projectId` placeholder routes to enable type-safe TanStack Router `Link` components. Implement a glassmorphic React component for project cards. Modify the dashboard route component to query projects for the selected organization via oRPC, display skeleton card loaders when loading, handle the empty state with a typed create project Link, and display a responsive grid of project cards when data exists.

**Tech Stack:** React, Tailwind CSS (v4), TypeScript, `@tanstack/react-router`, `@tanstack/react-query`, `@Emitkit/ui`, `lucide-react`, `oRPC`.

---

### Task 1: Create Route Placeholders for Projects

**Files:**
- Create: `apps/web/src/routes/_auth/projects.new.tsx`
- Create: `apps/web/src/routes/_auth/projects.$projectId.tsx`

- [ ] **Step 1: Create `apps/web/src/routes/_auth/projects.new.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/projects/new")({
  component: () => (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Create New Project</h1>
      <p className="text-muted-foreground mt-2">Placeholder for creating a project.</p>
    </div>
  ),
});
```

- [ ] **Step 2: Create `apps/web/src/routes/_auth/projects.$projectId.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/projects/$projectId")({
  component: () => {
    const { projectId } = Route.useParams();
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Project Details</h1>
        <p className="text-muted-foreground mt-2">Placeholder for project ID: {projectId}</p>
      </div>
    );
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_auth/projects.new.tsx apps/web/src/routes/_auth/projects.$projectId.tsx
git commit -m "feat(web): add project route placeholders for TanStack Router type safety"
```

---

### Task 2: Implement Project Card Component

**Files:**
- Create: `apps/web/src/components/projects/project-card.tsx`

- [ ] **Step 1: Create project card component with premium glassmorphism**

Write file `apps/web/src/components/projects/project-card.tsx` with the following content:
```tsx
import { Link } from "@tanstack/react-router";
import { Card } from "@Emitkit/ui/components/card";
import { GitBranch, FileCode, CheckCircle2 } from "lucide-react";

export interface Project {
  id: string;
  orgId: string;
  repoFullName: string;
  specPath: string;
  defaultBranch: string;
  outputMode: "append" | "separate";
  outputRepoFullName: string | null;
  webhookId: number | null;
  webhookSecret: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="block no-underline group"
    >
      <Card className="relative overflow-hidden border border-border/80 bg-card/45 backdrop-blur-md rounded-2xl p-6 shadow-xs hover:shadow-md hover:bg-card/60 transition-all duration-300">
        {/* Top border glow gradient */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Header containing name and active status badge */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h3 className="text-base font-bold text-foreground truncate group-hover:text-primary transition-colors duration-200">
              {project.repoFullName}
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground mt-1">
              <GitBranch className="size-3 shrink-0" />
              <span className="truncate">{project.defaultBranch}</span>
            </div>
          </div>
          
          {/* Active state badge */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            Active
          </div>
        </div>

        {/* Content details: OpenAPI spec path */}
        <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
            <FileCode className="size-4 text-indigo-400 shrink-0" />
            <span className="truncate font-mono text-[10px] bg-zinc-900/60 px-2 py-0.5 rounded border border-zinc-800/80">
              {project.specPath}
            </span>
          </div>
          
          <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
            <CheckCircle2 className="size-3 text-emerald-400" />
            <span>Synced</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/projects/project-card.tsx
git commit -m "feat(web): implement premium glassmorphic ProjectCard component"
```

---

### Task 3: Update Dashboard Page

**Files:**
- Modify: `apps/web/src/routes/_auth/dashboard.tsx`

- [ ] **Step 1: Update Dashboard Component**

Modify `apps/web/src/routes/_auth/dashboard.tsx` to:
1. Import `ProjectCard` and `Skeleton`.
2. Query the list of projects using `orpc.projects.list.queryOptions({ input: { orgId: selectedOrgId } })`.
3. Update the `isLoading` state logic to also check `isProjectsLoading`. Show clean skeleton project cards inside the Loading State.
4. Render the list of projects in a beautiful grid of `ProjectCard` components if there are any projects.
5. Add a "+ Create Project" button navigating to `/projects/new` next to the Projects header section when projects exist.
6. In the empty-state rendering, update the "Create Project" button to use TanStack `Link` navigating to `/projects/new`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/routes/_auth/dashboard.tsx
git commit -m "feat(web): fetch and list real projects on dashboard with loading and empty states"
```

---

### Task 4: Compilation and Verification

- [ ] **Step 1: Check Type Safety**

Verify typescript compiles correctly by building.
Run: `bun run check-types`
Expected: Success

- [ ] **Step 2: Commit the build changes if route tree was updated**

```bash
git add apps/web/src/routeTree.gen.ts
git commit -m "build(web): update generated route tree" || true
```
