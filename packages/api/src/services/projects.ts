import { db } from "@Emitkit/db";
import { projects } from "@Emitkit/db/schema";
import { eq } from "drizzle-orm";
import { env } from "@Emitkit/env/server";
import { encrypt } from "@Emitkit/auth/crypto";
import { randomUUID } from "crypto";
import {
  GitHubClient,
  getRepoContent,
  registerWebhook,
  createRepo,
  createInitialCommit,
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
  const webhookUrl = `${env.BETTER_AUTH_URL}/webhooks/github`;
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
  const webhookUrl = `${env.BETTER_AUTH_URL}/webhooks/github`;
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

export async function deleteProject(projectId: string, database = db) {
  await database.delete(projects).where(eq(projects.id, projectId));
}
