import { db } from "@Emitkit/db";
import { organizationMembers, account } from "@Emitkit/db/schema";
import { GitHubClient, getRepoContent } from "@Emitkit/github";
import { eq, and, desc } from "drizzle-orm";
import { env } from "@Emitkit/env/server";

/**
 * Refresh an expired GitHub App user-to-server token using the refresh token.
 * See: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens
 */
async function refreshGitHubToken(
  accountId: string,
  refreshToken: string,
): Promise<string> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token refresh failed with status ${response.status}`);
  }

  const data = (await response.json()) as any;
  if (data.error) {
    throw new Error(`GitHub token refresh error: ${data.error} - ${data.error_description}`);
  }

  const newAccessToken = data.access_token as string;
  const newRefreshToken = data.refresh_token as string;
  const expiresInMs = (data.expires_in as number) * 1000;
  const refreshExpiresInMs = (data.refresh_token_expires_in as number) * 1000;
  const now = Date.now();

  // Persist the refreshed tokens back to the database
  await db
    .update(account)
    .set({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiresAt: new Date(now + expiresInMs),
      refreshTokenExpiresAt: new Date(now + refreshExpiresInMs),
    })
    .where(eq(account.id, accountId));

  return newAccessToken;
}

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
    .select({
      accountId: account.id,
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      accessTokenExpiresAt: account.accessTokenExpiresAt,
    })
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

  const row = result[0];
  if (!row?.accessToken) {
    throw new Error("No connected GitHub account found for this organization");
  }

  let accessToken = row.accessToken;

  // Check if the token is expired and refresh it
  if (
    row.accessTokenExpiresAt &&
    row.accessTokenExpiresAt.getTime() < Date.now() + 60_000 // 1-minute buffer
  ) {
    if (!row.refreshToken) {
      throw new Error("GitHub access token expired and no refresh token available. Please re-login.");
    }
    accessToken = await refreshGitHubToken(row.accountId, row.refreshToken);
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

