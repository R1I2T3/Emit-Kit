import { describe, it, expect, vi, beforeEach } from "vitest";
import { QUEUES, createQueue } from "./index";
import { Queue } from "bullmq";

vi.mock("bullmq", () => {
  return {
    Queue: vi.fn().mockImplementation((name, opts) => {
      return {
        name,
        opts,
      };
    }),
  };
});

describe("Queue Package", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have QUEUES structure containing generation", () => {
    expect(QUEUES.GENERATION).toBe("generation");
  });

  it("should create a Queue instance with the correct parameters", () => {
    const mockRedis = {} as any;
    const queueName = "test-queue";
    
    const queue = createQueue(queueName, mockRedis);

    expect(Queue).toHaveBeenCalledWith(queueName, {
      connection: mockRedis,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: { age: 86400, count: 500 },
      },
    });

    expect(queue).toBeDefined();
  });
});
