import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useContext } from "react";

import { orpc } from "@/utils/orpc";
import { OrgContext } from "./route";
import { Skeleton } from "@Emitkit/ui/components/skeleton";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { selectedOrgId } = useContext(OrgContext);

  const { data: org, isLoading } = useQuery({
    ...orpc.orgs.get.queryOptions({ input: { orgId: selectedOrgId } }),
    enabled: !!selectedOrgId,
  });

  if (!selectedOrgId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="p-6 border rounded-lg bg-card text-card-foreground">
          <p className="text-muted-foreground">
            No organization selected. Please select or create an organization to get started.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="p-6 border rounded-lg bg-card">
            <Skeleton className="h-5 w-24 mb-4" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="p-6 border rounded-lg bg-card text-destructive">
          <p>Failed to load organization details. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{org.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">Slug: {org.slug}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Members</h3>
          <p className="text-3xl font-bold mt-2">{org.memberCount}</p>
        </div>
      </div>
    </div>
  );
}

