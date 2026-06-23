import { Queue, Worker, Job } from "bullmq";

export { Queue, Worker, Job };

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

export function createQueue<
  DataType = any,
  ResultType = any,
  NameType extends string = string,
>(name: NameType, redis: any): Queue<DataType, ResultType, NameType> {
  return new Queue(name as any, {
    connection: redis,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 86400, count: 500 },
    },
  }) as any;
}


