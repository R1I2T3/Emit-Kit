import { Clock, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@Emitkit/ui/lib/utils";

export type RunStatus = "queued" | "running" | "success" | "failed";

interface RunStatusBadgeProps {
  status: RunStatus | string;
  className?: string;
}

export function RunStatusBadge({ status, className }: RunStatusBadgeProps) {
  switch (status) {
    case "queued":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-500/10 border-slate-500/20 text-slate-400 dark:bg-slate-400/10 dark:border-slate-400/20 dark:text-slate-300 shadow-sm backdrop-blur-xs",
            className
          )}
        >
          <Clock className="size-3.5" />
          Queued
        </span>
      );
    case "running":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-indigo-500/10 border-indigo-500/20 text-indigo-400 shadow-sm backdrop-blur-xs",
            className
          )}
        >
          <Loader2 className="size-3.5 animate-spin" />
          Running
        </span>
      );
    case "success":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-sm backdrop-blur-xs",
            className
          )}
        >
          <CheckCircle2 className="size-3.5" />
          Success
        </span>
      );
    case "failed":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-sm backdrop-blur-xs",
            className
          )}
        >
          <XCircle className="size-3.5" />
          Failed
        </span>
      );
    default:
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-zinc-500/10 border-zinc-500/20 text-zinc-400 shadow-sm backdrop-blur-xs",
            className
          )}
        >
          <Clock className="size-3.5" />
          {status}
        </span>
      );
  }
}
