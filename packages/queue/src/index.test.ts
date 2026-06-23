import { describe, it, expect, vi, beforeEach } from "vitest";
import { QUEUES, createQueue } from "./index";
import { Queue } from "bullmq";
import { Redis } from "ioredis";

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
    const mockRedis = {} as unknown as Redis;
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
        timeout: 300000,
      },
    });

    expect(queue).toBeDefined();
  });
});
