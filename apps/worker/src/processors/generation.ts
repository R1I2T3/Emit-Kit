import { Job } from "bullmq";
import type { GenerationJobData, GenerationJobResult } from "@Emitkit/queue";
import { db } from "@Emitkit/db";
import { generationRuns, projects, projectConfigs } from "@Emitkit/db/schema";
import { eq } from "drizzle-orm";
import { fetchSpec } from "../steps/fetch-spec";
import { parseSpec } from "../steps/parse-spec";
import { diffSpec } from "../steps/diff-spec";
import { calcVersion } from "../steps/calc-version";
import { logStep, logger } from "../lib/logger";

export async function processGenerationJob(
  job: Job<GenerationJobData>
): Promise<GenerationJobResult> {
  const { runId } = job.data;

  try {
    // Immediately update status to 'running'
    await db
      .update(generationRuns)
      .set({ status: "running" })
      .where(eq(generationRuns.id, runId));

    await logStep(runId, "Starting generation...");

    // Fetch run details joined with project and project config
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

    if (!row) {
      const errorMsg = `Generation run, project, or config not found for runId: ${runId}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    const { project, config } = row;

    // Step 1: Fetch Spec
    await logStep(runId, "Fetching OpenAPI spec...");
    const { content, sha } = await fetchSpec(project);
    await db
      .update(generationRuns)
      .set({ commitSha: sha })
      .where(eq(generationRuns.id, runId));

    // Step 2: Parse Spec
    await logStep(runId, "Parsing OpenAPI spec...");
    const parsedSpec = await parseSpec(content);

    // Step 3: Diff Spec
    await logStep(runId, "Analyzing changes...");
    const diff = await diffSpec(parsedSpec, project.id);

    // Step 4: Calculate Version
    await logStep(runId, "Calculating version...");
    const version = await calcVersion(config, diff, parsedSpec);

    await db
      .update(generationRuns)
      .set({
        sdkVersion: version,
        specSnapshot: parsedSpec,
      })
      .where(eq(generationRuns.id, runId));

    await logStep(runId, `Version: ${version}`);

    // Finish successfully
    await logStep(runId, "[DONE]");
    await db
      .update(generationRuns)
      .set({
        status: "success",
        finishedAt: new Date(),
      })
      .where(eq(generationRuns.id, runId));

    return { sdkVersion: version };
  } catch (error: any) {
    try {
      await logStep(runId, `ERROR: ${error.message}`);
      await logStep(runId, "[DONE]");

      await db
        .update(generationRuns)
        .set({
          status: "failed",
          finishedAt: new Date(),
        })
        .where(eq(generationRuns.id, runId));
    } catch (dbErr) {
      logger.error({ err: dbErr, runId }, "Failed to mark run as failed in database");
    }

    throw error;
  }
}
