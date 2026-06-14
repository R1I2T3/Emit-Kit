import { Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import { Button } from "@Emitkit/ui/components/button";

export const OrgContext = createContext<{
  selectedOrgId: string;
  setSelectedOrgId: (id: string) => void;
}>({ selectedOrgId: "", setSelectedOrgId: () => {} });

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }
    return { session };
  },
});

function AuthLayout() {
  const { session } = Route.useRouteContext();
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const navigate = useNavigate();

  const { data: orgs, isLoading } = useQuery(orpc.orgs.list.queryOptions());

  useEffect(() => {
    if (orgs && orgs.length > 0 && !selectedOrgId) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex h-full w-full">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card text-card-foreground p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-2 px-1">
            <span className="text-xl font-bold tracking-tight text-primary">Emitkit</span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block px-1">
              Organization
            </label>
            {isLoading ? (
              <div className="h-9 w-full bg-muted animate-pulse rounded-md" />
            ) : (
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer text-foreground"
              >
                <option value="" disabled>Select organization</option>
                {orgs?.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* User profile & Sign Out */}
        <div className="border-t border-border pt-4 space-y-4">
          <div className="px-1">
            <p className="text-sm font-medium leading-none text-foreground truncate">{session.data?.user.name}</p>
            <p className="text-xs text-muted-foreground truncate mt-1">{session.data?.user.email}</p>
          </div>
          <Button
            variant="destructive"
            className="w-full justify-center"
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <OrgContext.Provider value={{ selectedOrgId, setSelectedOrgId }}>
          <Outlet />
        </OrgContext.Provider>
      </main>
    </div>
  );
}

