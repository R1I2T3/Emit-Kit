import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/projects/$projectId")({
  component: () => {
    const { projectId } = Route.useParams();
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Project Details</h1>
        <p className="text-muted-foreground mt-2">Placeholder for project ID: {projectId}</p>
      </div>
    );
  },
});
