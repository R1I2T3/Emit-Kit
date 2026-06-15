import { Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import { Button } from "@Emitkit/ui/components/button";

import { OrgSwitcher } from "@/components/layout/org-switcher";

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

  const { data: orgs } = useQuery(orpc.orgs.list.queryOptions());

  useEffect(() => {
    if (orgs && orgs.length > 0) {
      const exists = orgs.some((org) => org.id === selectedOrgId);
      if (!exists) {
        setSelectedOrgId(orgs[0].id);
      }
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
            <OrgSwitcher value={selectedOrgId} onValueChange={setSelectedOrgId} />
          </div>
        </div>

        {/* User profile & Sign Out */}
        <div className="border-t border-border pt-4 space-y-4">
          <div className="px-1">
            <p className="text-sm font-medium leading-none text-foreground truncate">{session.data?.user.name}</p>
            <p className="text-xs text-muted-foreground truncate mt-1">{session.data?.user.email}</p>
          </div>
          <Button
            variant="outline"
            className="w-full justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/5 hover:border-destructive/30 border-border/40 transition-colors"
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

