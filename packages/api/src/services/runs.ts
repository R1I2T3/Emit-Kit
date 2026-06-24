import { db } from "@Emitkit/db";
import { generationRuns } from "@Emitkit/db/schema";
import { createQueue, QUEUES } from "@Emitkit/queue";
import { redis } from "../lib/redis";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export async function createRun(
  projectId: string,
  configId: string,
  triggeredBy: "manual" | "webhook",
  database = db,
) {
  const id = crypto.randomUUID();

  const [run] = await database
    .insert(generationRuns)
    .values({
      id,
      projectId,
      configId,
      triggeredBy,
      status: "queued",
      logs: "",
    })
    .returning();

  return run;
}

export async function enqueueGenerationJob(runId: string) {
  const queue = createQueue(QUEUES.GENERATION, redis);
  try {
    await queue.add("generate", { runId });
  } finally {
    await queue.close();
  }
}

export async function listRuns(
  projectId: string,
  limit = 50,
  offset = 0,
  database = db,
) {
  return database
    .select()
    .from(generationRuns)
    .where(eq(generationRuns.projectId, projectId))
    .orderBy(desc(generationRuns.createdAt))
    .limit(limit)
    .offset(offset);
}

