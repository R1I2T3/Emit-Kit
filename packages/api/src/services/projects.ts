import { db } from "@Emitkit/db";
import { projects, account, organizationMembers } from "@Emitkit/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { env } from "@Emitkit/env/server";
import { encrypt } from "@Emitkit/auth/crypto";
import { randomUUID } from "crypto";
import {
  GitHubClient,
  getRepoContent,
  registerWebhook,
  createRepo,
  createInitialCommit,
  deleteWebhook,
} from "@Emitkit/github";

function parseRepoFullName(repoFullName: string): { owner: string; repo: string } {
  const [owner, repo] = repoFullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repository full name: ${repoFullName}`);
  }
  return { owner, repo };
}

export async function createFromExistingRepo(
  orgId: string,
  repoFullName: string,
  specPath: string,
  defaultBranch: string,
  githubClient: GitHubClient,
  database = db,
) {
  const { owner, repo } = parseRepoFullName(repoFullName);

  // 1. Verify spec path exists on GitHub
  await getRepoContent(githubClient, owner, repo, specPath, defaultBranch);

  // 2. Generate webhook secret
  const webhookSecret = randomUUID();
  const encryptedSecret = encrypt(webhookSecret);

  // 3. Register webhook on GitHub
  const webhookUrl = `${env.WEBHOOK_BASE_URL.replace(/\/$/, "")}/webhooks/github`;
  const { id: webhookId } = await registerWebhook(
    githubClient,
    owner,
    repo,
    webhookUrl,
    webhookSecret,
  );

  // 4. Save to database
  const projectId = randomUUID();
  const [project] = await database
    .insert(projects)
    .values({
      id: projectId,
      orgId,
      repoFullName,
      specPath,
      defaultBranch,
      outputMode: "append",
      webhookId,
      webhookSecret: encryptedSecret,
    })
    .returning();

  if (!project) {
    throw new Error("Failed to insert project");
  }

  return project;
}

export async function createNewRepo(
  orgId: string,
  repoName: string,
  visibility: "public" | "private",
  orgLogin: string | undefined,
  githubClient: GitHubClient,
  database = db,
) {
  // 1. Create repo
  const { fullName: repoFullName, defaultBranch } = await createRepo(
    githubClient,
    repoName,
    visibility,
    orgLogin,
  );
  const { owner, repo } = parseRepoFullName(repoFullName);

  // 2. Prepare starter OpenAPI spec content
  const specContent = `openapi: 3.1.0
info:
  title: ${repoName} API
  version: 0.1.0
paths: {}
`;

  // 3. Commit starter spec
  const specPath = "openapi.yaml";
  await createInitialCommit(githubClient, owner, repo, specPath, specContent);

  // 4. Generate webhook secret & register webhook
  const webhookSecret = randomUUID();
  const encryptedSecret = encrypt(webhookSecret);
  const webhookUrl = `${env.WEBHOOK_BASE_URL.replace(/\/$/, "")}/webhooks/github`;
  const { id: webhookId } = await registerWebhook(
    githubClient,
    owner,
    repo,
    webhookUrl,
    webhookSecret,
  );

  // 5. Save to database
  const projectId = randomUUID();
  const [project] = await database
    .insert(projects)
    .values({
      id: projectId,
      orgId,
      repoFullName,
      specPath,
      defaultBranch,
      outputMode: "append",
      webhookId,
      webhookSecret: encryptedSecret,
    })
    .returning();

  if (!project) {
    throw new Error("Failed to insert project");
  }

  return project;
}

export async function deleteProject(
  projectId: string,
  githubClient?: GitHubClient | null,
  database = db,
) {
  const [project] = await database
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (project) {
    try {
      if (githubClient && project.webhookId) {
        const [owner, repo] = project.repoFullName.split("/");
        if (owner && repo) {
          await deleteWebhook(githubClient, owner, repo, project.webhookId);
        }
      }
    } catch (error) {
      console.error("Failed to delete webhook from GitHub:", error);
    }
  }

  await database.delete(projects).where(eq(projects.id, projectId));
}

/**
 * Refresh an expired GitHub App user-to-server token using the refresh token.
 * See: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens
 */
async function refreshGitHubToken(
  accountId: string,
  refreshToken: string,
  database = db,
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
  await database
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

export async function getGitHubClientForProject(
  project: any,
  database = db,
): Promise<GitHubClient> {
  if (!project) {
    throw new Error("Invalid project: project is missing");
  }

  // Query database for the GitHub access token
  const result = await database
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
    accessToken = await refreshGitHubToken(row.accountId, row.refreshToken, database);
  }

  return new GitHubClient(accessToken);
}
