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
