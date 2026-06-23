import { Queue } from "bullmq";
import { Redis } from "ioredis";

export const QUEUES = {
  GENERATION: "generation",
} as const;

export interface GenerationJobData {
  runId: string;
}

export interface GenerationJobResult {
  prUrl?: string;
  sdkVersion?: string;
}

export function createQueue(name: string, redis: Redis): Queue {
  return new Queue(name, {
    connection: redis,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      timeout: 300000, // 5 minutes
    },
  });
}
