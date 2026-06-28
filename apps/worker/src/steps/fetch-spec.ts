import { getRepoContent } from "@Emitkit/github";
import { getGitHubClientForProject } from "@Emitkit/api/services/projects";

export async function fetchSpec(project: any): Promise<{ content: string; sha: string }> {
  if (!project || typeof project.repoFullName !== "string") {
    throw new Error("Invalid project: repoFullName is missing");
  }

  const parts = project.repoFullName.split("/");
  if (parts.length !== 2) {
    throw new Error("Invalid repoFullName format. Expected 'owner/repo'");
  }
  const [owner, repo] = parts;

  const githubClient = await getGitHubClientForProject(project);
  const { content, sha } = await getRepoContent(
    githubClient,
    owner,
    repo,
    project.specPath,
    project.defaultBranch
  );

  // Validate content size: 2MB limit
  if (content.length > 2 * 1024 * 1024) {
    throw new Error("Spec file exceeds 2MB limit");
  }

  return { content, sha };
}

