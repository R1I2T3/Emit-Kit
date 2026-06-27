import { describe, it, expect, vi, beforeEach } from "vitest";
import { logStep, logger } from "./logger";
import { redis } from "./redis";

const { mockUpdate, mockUpdateSet, mockUpdateSetWhere } = vi.hoisted(() => {
  const mockUpdateSetWhere = vi.fn().mockResolvedValue([]);
  const mockUpdateSet = vi.fn().mockReturnValue({
    where: mockUpdateSetWhere,
  });
  const mockUpdate = vi.fn().mockReturnValue({
    set: mockUpdateSet,
  });
  return { mockUpdate, mockUpdateSet, mockUpdateSetWhere };
});

vi.mock("@Emitkit/db", () => {
  return {
    db: {
      update: mockUpdate,
    },
  };
});

vi.mock("./redis", () => {
  return {
    redis: {
      publish: vi.fn().mockResolvedValue(1),
    },
  };
});

describe("logger.ts - logStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should append logs to the run, update db, publish to redis, and log via pino", async () => {
    const loggerInfoSpy = vi.spyOn(logger, "info");

    await logStep("run-123", "Hello World");

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        logs: expect.anything(),
      })
    );
    expect(mockUpdateSetWhere).toHaveBeenCalled();
    expect(redis.publish).toHaveBeenCalledWith(
      "run-logs:run-123",
      expect.stringContaining("Hello World")
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith({
      runId: "run-123",
      message: "Hello World",
    });
  });

  it("should catch DB update errors, log them, and still publish to redis", async () => {
    const loggerErrorSpy = vi.spyOn(logger, "error");
    mockUpdate.mockImplementationOnce(() => {
      throw new Error("DB Connection Failed");
    });

    await logStep("run-123", "Hello World");

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-123",
        err: expect.any(Error),
      }),
      "Failed to update run logs in database"
    );
    expect(redis.publish).toHaveBeenCalledWith(
      "run-logs:run-123",
      expect.stringContaining("Hello World")
    );
  });

  it("should catch Redis publish errors, log them, and still update DB", async () => {
    const loggerErrorSpy = vi.spyOn(logger, "error");
    vi.mocked(redis.publish).mockRejectedValueOnce(new Error("Redis Connection Failed"));

    await logStep("run-123", "Hello World");

    expect(mockUpdate).toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-123",
        err: expect.any(Error),
      }),
      "Failed to publish run log line to Redis"
    );
  });
});
