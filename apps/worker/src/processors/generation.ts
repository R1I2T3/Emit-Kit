import { Job } from "bullmq";
import type { GenerationJobData } from "@Emitkit/queue";
import { logStep } from "../lib/logger";

export async function processGenerationJob(job: Job<GenerationJobData>) {
  const { runId } = job.data;

  await logStep(runId, "Starting generation job");

  await logStep(runId, "Finishing generation job");

  return { sdkVersion: "0.1.0" };
}
