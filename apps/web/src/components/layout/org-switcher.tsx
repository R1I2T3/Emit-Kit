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
import { Building2 } from "lucide-react";

interface OrgSwitcherProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function OrgSwitcher({ value, onValueChange }: OrgSwitcherProps) {
  const { data: orgs, isLoading } = useQuery(orpc.orgs.list.queryOptions());

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

  const selectedOrg = orgs?.find((org) => org.id === value);

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
                selectedOrg.name.slice(0, 2).toUpperCase()
              ) : (
                <Building2 className="size-4 opacity-70" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs text-foreground truncate leading-none">
                {selectedOrg ? (
                  selectedOrg.name
                ) : (
                  <SelectValue placeholder="Select organization" />
                )}
              </span>
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
          {orgs && orgs.length > 0 ? (
            orgs.map((org) => (
              <SelectItem
                key={org.id}
                value={org.id}
                className="flex items-center gap-2.5 rounded-lg pl-2.5 pr-8 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
              >
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary dark:bg-primary/20 ring-1 ring-primary/20">
                  {org.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-foreground truncate">{org.name}</span>
                  {org.slug && (
                    <span className="text-[9px] text-muted-foreground truncate">{org.slug}</span>
                  )}
                </div>
              </SelectItem>
            ))
          ) : (
            <div className="p-2 text-xs text-muted-foreground text-center">
              No organizations
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
