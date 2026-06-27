import { Worker } from "bullmq";
import { redis } from "./lib/redis";
import { QUEUES, type GenerationJobData } from "@Emitkit/queue";
import { processGenerationJob } from "./processors/generation";
import { db } from "@Emitkit/db";
import { generationRuns } from "@Emitkit/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";

const worker = new Worker<GenerationJobData>(
  QUEUES.GENERATION,
  processGenerationJob,
  {
    connection: redis as any,
    concurrency: 3,
  }
);

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err }, "Job failed");
});

worker.on("completed", (job) => {
  logger.info({ jobId: job?.id }, "Job completed");
});

async function markStaleRunsAsFailed() {
  try {
    await db
      .update(generationRuns)
      .set({
        status: "failed",
        logs: "Worker restarted; run aborted",
        finishedAt: new Date(),
      })
      .where(eq(generationRuns.status, "running"));
    
    logger.info("Stale runs marked as failed");
  } catch (error) {
    logger.error({ error }, "Failed to mark stale runs as failed");
  }
}

markStaleRunsAsFailed().then(() => {
  logger.info("Worker initialized successfully");
});

export { logger, worker };
export { markStaleRunsAsFailed };
