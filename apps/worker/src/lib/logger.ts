import pino from "pino";
import { db } from "@Emitkit/db";
import { generationRuns } from "@Emitkit/db/schema";
import { eq } from "drizzle-orm";
import { redis } from "./redis";

export const logger = pino({
  level: "info",
});

export async function logStep(runId: string, message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;

  const [run] = await db
    .select()
    .from(generationRuns)
    .where(eq(generationRuns.id, runId));

  if (!run) {
    throw new Error(`Generation run with ID ${runId} not found`);
  }

  const newLogs = run.logs + logLine;

  await db
    .update(generationRuns)
    .set({ logs: newLogs })
    .where(eq(generationRuns.id, runId));

  await redis.publish(`run-logs:${runId}`, logLine);

  logger.info({ runId, message });
}
