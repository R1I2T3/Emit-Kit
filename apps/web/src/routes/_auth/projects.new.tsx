import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/projects/new")({
  component: () => (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Create New Project</h1>
      <p className="text-muted-foreground mt-2">Placeholder for creating a project.</p>
    </div>
  ),
});
