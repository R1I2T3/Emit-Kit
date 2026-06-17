import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@Emitkit/ui/components/select";
import { Skeleton } from "@Emitkit/ui/components/skeleton";
import { Building2, User } from "lucide-react";
import { useMemo } from "react";

interface OrgSwitcherProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function OrgSwitcher({ value, onValueChange }: OrgSwitcherProps) {
  const { data: orgs, isLoading, isError } = useQuery(orpc.orgs.list.queryOptions());

  // Sort: personal workspace first, then orgs alphabetically
  const sortedOrgs = useMemo(() => {
    if (!orgs) return [];
    return [...orgs].sort((a, b) => {
      if (a.isPersonal && !b.isPersonal) return -1;
      if (!a.isPersonal && b.isPersonal) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [orgs]);

  if (isLoading) {
    return (
      <div className="flex h-12 w-full items-center gap-3 rounded-xl border border-border/60 bg-background/30 px-3 py-2 backdrop-blur-xs">
        <Skeleton className="size-7 rounded-lg shrink-0" />
        <div className="flex-1 space-y-1 min-w-0">
          <Skeleton className="h-3.5 w-24 rounded-xs" />
          <Skeleton className="h-2.5 w-16 rounded-xs mt-0.5" />
        </div>
      </div>
    );
  }

  const selectedOrg = sortedOrgs.find((org) => org.id === value);

  return (
    <div className="w-full">
      <Select
        value={value}
        onValueChange={(val) => {
          if (val) {
            onValueChange(val);
          }
        }}
      >
        <SelectTrigger className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 backdrop-blur-md px-3 py-2 text-sm shadow-xs transition-all duration-200 hover:bg-accent/10 hover:border-border focus:border-ring focus:ring-1 focus:ring-ring/50 cursor-pointer">
          <div className="flex items-center gap-2.5 text-left min-w-0">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary dark:bg-primary/20 ring-1 ring-primary/20">
              {selectedOrg ? (
                selectedOrg.isPersonal ? (
                  <User className="size-4" />
                ) : (
                  selectedOrg.name.slice(0, 2).toUpperCase()
                )
              ) : (
                <Building2 className="size-4 opacity-70" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              {selectedOrg ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground min-w-0 leading-none">
                  <span className="truncate">{selectedOrg.name}</span>
                  {selectedOrg.isPersonal && (
                    <span className="shrink-0 text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full leading-none">
                      Personal
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-xs font-semibold text-foreground truncate leading-none">
                  <SelectValue placeholder="Select workspace" />
                </span>
              )}
              {selectedOrg?.slug && (
                <span className="text-[10px] text-muted-foreground truncate mt-0.5 leading-none">
                  {selectedOrg.slug}
                </span>
              )}
            </div>
          </div>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          className="rounded-xl border border-border/80 bg-popover/90 backdrop-blur-xl p-1 shadow-lg ring-1 ring-black/5 dark:ring-white/5 animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {isError ? (
            <div className="p-2 text-xs text-destructive text-center font-medium">
              Failed to load workspaces
            </div>
          ) : sortedOrgs.length > 0 ? (
            sortedOrgs.map((org) => (
              <SelectItem
                key={org.id}
                value={org.id}
                className="flex items-center gap-2.5 rounded-lg pl-2.5 pr-8 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
              >
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/20 ring-1 ring-primary/20 text-[10px] font-bold">
                  {org.isPersonal ? (
                    <User className="size-3.5" />
                  ) : (
                    org.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-foreground flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{org.name}</span>
                    {org.isPersonal && (
                      <span className="shrink-0 text-[8px] font-medium text-muted-foreground bg-muted/60 px-1 py-0.5 rounded-full leading-none">
                        Personal
                      </span>
                    )}
                  </span>
                  {org.slug && (
                    <span className="text-[9px] text-muted-foreground truncate">{org.slug}</span>
                  )}
                </div>
              </SelectItem>
            ))
          ) : (
            <div className="p-2 text-xs text-muted-foreground text-center">
              No workspaces
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
