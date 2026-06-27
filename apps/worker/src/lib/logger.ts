import pino from "pino";
import { db } from "@Emitkit/db";
import { generationRuns } from "@Emitkit/db/schema";
import { eq, sql } from "drizzle-orm";
import { redis } from "./redis";

export const logger = pino({
  level: "info",
});

export async function logStep(runId: string, message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;

  try {
    await db
      .update(generationRuns)
      .set({
        logs: sql`${generationRuns.logs} || ${logLine}`
      })
      .where(eq(generationRuns.id, runId));
  } catch (err) {
    logger.error({ err, runId }, "Failed to update run logs in database");
  }

  try {
    await redis.publish(`run-logs:${runId}`, logLine);
  } catch (err) {
    logger.error({ err, runId }, "Failed to publish run log line to Redis");
  }

  logger.info({ runId, message });
}
