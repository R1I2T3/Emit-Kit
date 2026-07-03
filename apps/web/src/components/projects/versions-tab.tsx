import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@Emitkit/ui/components/table";
import { Badge } from "@Emitkit/ui/components/badge";
import { ChevronDown, ChevronRight, Tag, Loader2 } from "lucide-react";
import { useState, Fragment } from "react";
import { Link } from "@tanstack/react-router";

export function VersionsTab({ projectId }: { projectId: string }) {
  const { data: versions, isLoading } = useQuery(
    orpc.versions.list.queryOptions({ input: { projectId } })
  );

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!versions?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center gap-2">
        <Tag className="size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium">No versions published yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card/40 backdrop-blur-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/60 bg-zinc-950/20 text-muted-foreground">
            <TableHead className="w-10"></TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Change Type</TableHead>
            <TableHead>Run ID</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border/40 text-xs">
          {versions.map((version) => (
            <Fragment key={version.id}>
              <TableRow className="hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => toggleExpand(version.id)}>
                <TableCell className="p-3">
                  {version.changelog ? (
                    expanded.has(version.id) ? (
                      <ChevronDown className="size-4 text-zinc-400" />
                    ) : (
                      <ChevronRight className="size-4 text-zinc-400" />
                    )
                  ) : null}
                </TableCell>
                <TableCell className="font-mono font-bold text-zinc-300">{version.version}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      version.changeType === "major"
                        ? "destructive"
                        : version.changeType === "minor"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {version.changeType}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    to="/runs/$runId"
                    params={{ runId: version.runId }}
                    className="hover:underline font-mono text-indigo-400 font-semibold"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {version.runId.substring(0, 8)}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground font-medium">
                  {new Date(version.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
              {expanded.has(version.id) && version.changelog && (
                <TableRow>
                  <TableCell colSpan={5} className="bg-zinc-950/40 p-4 border-t border-b border-border/40">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Changelog</p>
                      <pre className="text-xs font-mono whitespace-pre-wrap text-foreground bg-zinc-900/40 p-3 rounded-lg border border-border/80">
                        {version.changelog}
                      </pre>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
