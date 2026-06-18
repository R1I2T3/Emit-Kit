import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { Input } from "@Emitkit/ui/components/input";
import { Button } from "@Emitkit/ui/components/button";
import { Search, ChevronDown, Check, Loader2, GitBranch, AlertCircle } from "lucide-react";
import { cn } from "@Emitkit/ui/lib/utils";

interface RepoPickerProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function RepoPicker({ value, onValueChange }: RepoPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: repos, isLoading, error, refetch } = useQuery(
    orpc.projects.listGithubRepos.queryOptions()
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredRepos = repos
    ? repos.filter((repo) => {
        const fullName = `${repo.owner}/${repo.name}`.toLowerCase();
        return fullName.includes(search.toLowerCase());
      })
    : [];

  return (
    <div ref={containerRef} className="relative w-full">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
        GitHub Repository
      </label>
      
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between gap-2 border border-border/80 bg-background/50 hover:bg-accent/10 px-3 py-2 text-sm rounded-xl transition-all duration-200 outline-none text-left font-normal cursor-pointer select-none",
          isOpen && "border-indigo-500/50 ring-1 ring-indigo-500/50"
        )}
      >
        <span className="truncate flex items-center gap-2">
          <GitBranch className="size-4 text-indigo-400 shrink-0" />
          {value ? (
            <span className="font-medium text-foreground">{value}</span>
          ) : (
            <span className="text-muted-foreground">Select a repository...</span>
          )}
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full max-h-80 overflow-hidden rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-xl animate-in fade-in-50 zoom-in-95 duration-100 flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-border/60 flex items-center gap-2">
            <Search className="size-4 text-muted-foreground shrink-0 ml-1" />
            <Input
              type="text"
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-none bg-transparent focus-visible:ring-0 px-1 text-sm shadow-none"
              autoFocus
            />
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto max-h-56 p-1">
            {isLoading && (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>Fetching your repositories...</span>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center py-4 px-3 text-center gap-2">
                <AlertCircle className="size-5 text-destructive shrink-0" />
                <p className="text-xs text-muted-foreground">Failed to load repositories.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  className="mt-1 h-7 text-[10px] px-3 border-destructive/20 text-destructive hover:bg-destructive/10"
                >
                  Retry
                </Button>
              </div>
            )}

            {!isLoading && !error && filteredRepos.length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground">
                {repos && repos.length === 0
                  ? "No repositories found with push permission."
                  : "No matching repositories."}
              </div>
            )}

            {!isLoading &&
              !error &&
              filteredRepos.map((repo) => {
                const fullName = `${repo.owner}/${repo.name}`;
                const isSelected = value === fullName;
                return (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => {
                      onValueChange(fullName);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full text-left flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors hover:bg-accent/15 cursor-pointer font-normal",
                      isSelected && "bg-accent/20 font-medium text-foreground"
                    )}
                  >
                    <span className="truncate">{fullName}</span>
                    {isSelected && <Check className="size-3.5 text-emerald-400 shrink-0 ml-2" />}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
