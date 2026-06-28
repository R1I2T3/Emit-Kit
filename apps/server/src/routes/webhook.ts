import { Hono } from "hono";
import { db } from "@Emitkit/db";
import { projects, generationRuns, projectConfigs } from "@Emitkit/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@Emitkit/auth/crypto";
import { verifyWebhookSignature, createTag } from "@Emitkit/github";
import { getGitHubClientForProject } from "@Emitkit/api/services/projects";
import { getLatestConfig } from "@Emitkit/api/services/config";
import { createRun, enqueueGenerationJob } from "@Emitkit/api/services/runs";

export const webhookRouter = new Hono();

webhookRouter.post("/github", async (c) => {
  const signature = c.req.header("x-hub-signature-256");
  if (!signature) {
    return c.json({ error: "Missing signature header" }, 401);
  }

  const rawBody = await c.req.text();
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const repoFullName = payload.repository?.full_name;
  if (!repoFullName) {
    return c.json({ error: "Missing repository information" }, 400);
  }

  // Find project(s) matching repoFullName
  const matchedProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.repoFullName, repoFullName));

  if (matchedProjects.length === 0) {
    return c.json({ error: "Project not found" }, 404);
  }

  // Find project that matches the signature using decrypted webhook secret
  let matchingProject = null;
  for (const project of matchedProjects) {
    if (!project.webhookSecret) continue;
    try {
      const decryptedSecret = decrypt(project.webhookSecret);
      if (verifyWebhookSignature(rawBody, signature, decryptedSecret)) {
        matchingProject = project;
        break;
      }
    } catch (err) {
      // Ignore signature verification/decryption errors for individual projects
    }
  }

  if (!matchingProject) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const event = c.req.header("x-github-event");

  if (event === "push") {
    const ref = payload.ref;
    const branch = ref?.startsWith("refs/heads/") ? ref.replace("refs/heads/", "") : null;

    if (branch !== matchingProject.defaultBranch) {
      return c.json({ success: true, message: `Ignored push to non-default branch: ${branch}` }, 200);
    }

    const commits = payload.commits || [];
    const changedFiles = new Set<string>();
    for (const commit of commits) {
      const added = commit.added || [];
      const modified = commit.modified || [];
      const removed = commit.removed || [];
      for (const f of [...added, ...modified, ...removed]) {
        changedFiles.add(f);
      }
    }

    if (changedFiles.has(matchingProject.specPath)) {
      const config = await getLatestConfig(matchingProject.id);
      if (config) {
        const run = await createRun(matchingProject.id, config.id, "webhook");
        await enqueueGenerationJob(run.id);
      }
    }
  } else if (event === "pull_request") {
    if (
      payload.action === "closed" &&
      payload.pull_request?.merged === true &&
      payload.pull_request?.head?.ref?.startsWith("emitkit/run-")
    ) {
      const headRef = payload.pull_request.head.ref;
      const runId = headRef.replace("emitkit/run-", "");

      const [row] = await db
        .select({
          run: generationRuns,
          project: projects,
          config: projectConfigs,
        })
        .from(generationRuns)
        .innerJoin(projects, eq(generationRuns.projectId, projects.id))
        .innerJoin(projectConfigs, eq(generationRuns.configId, projectConfigs.id))
        .where(eq(generationRuns.id, runId))
        .limit(1);

      if (row && row.run.sdkVersion) {
        try {
          const githubClient = await getGitHubClientForProject(row.project);
          const [owner, repo] = row.project.repoFullName.split("/");
          const mergeCommitSha = payload.pull_request.merge_commit_sha;

          if (owner && repo && mergeCommitSha) {
            const sdkTag = `sdk/v${row.run.sdkVersion}`;
            await createTag(githubClient, owner, repo, sdkTag, mergeCommitSha);

            if (row.config.outputs.includes("MCP")) {
              const mcpTag = `mcp/v${row.run.sdkVersion}`;
              await createTag(githubClient, owner, repo, mcpTag, mergeCommitSha);
            }
          }
        } catch (err: any) {
          console.error("Failed to create Git tags:", err);
        }
      }
    }
  }

  return c.json({ success: true }, 200);
});
