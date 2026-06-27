import { db } from "@Emitkit/db";
import { organizationMembers, account } from "@Emitkit/db/schema";
import { GitHubClient, getRepoContent } from "@Emitkit/github";
import { eq, and, desc } from "drizzle-orm";

export async function fetchSpec(project: any): Promise<{ content: string; sha: string }> {
  if (!project || typeof project.repoFullName !== "string") {
    throw new Error("Invalid project: repoFullName is missing");
  }

  const parts = project.repoFullName.split("/");
  if (parts.length !== 2) {
    throw new Error("Invalid repoFullName format. Expected 'owner/repo'");
  }
  const [owner, repo] = parts;

  // Query database for the GitHub access token
  const result = await db
    .select({ accessToken: account.accessToken })
    .from(account)
    .innerJoin(
      organizationMembers,
      eq(account.userId, organizationMembers.userId)
    )
    .where(
      and(
        eq(organizationMembers.orgId, project.orgId),
        eq(account.providerId, "github")
      )
    )
    .orderBy(desc(account.updatedAt))
    .limit(1);

  const accessToken = result[0]?.accessToken;
  if (!accessToken) {
    throw new Error("No connected GitHub account found for this organization");
  }

  const githubClient = new GitHubClient(accessToken);
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
