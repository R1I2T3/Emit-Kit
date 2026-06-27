import { describe, it, expect, vi, beforeEach } from "vitest";
import { logStep, logger } from "./logger";
import { db } from "@Emitkit/db";
import { redis } from "./redis";

vi.mock("@Emitkit/db", () => {
  const mockUpdateSetWhere = vi.fn().mockResolvedValue([]);
  const mockUpdateSet = vi.fn().mockReturnValue({
    where: mockUpdateSetWhere,
  });
  const mockUpdate = vi.fn().mockReturnValue({
    set: mockUpdateSet,
  });

  const mockSelectFromWhere = vi.fn().mockResolvedValue([{ id: "run-123", logs: "existing-logs\n" }]);
  const mockSelectFrom = vi.fn().mockReturnValue({
    where: mockSelectFromWhere,
  });
  const mockSelect = vi.fn().mockReturnValue({
    from: mockSelectFrom,
  });

  return {
    db: {
      select: mockSelect,
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

    expect(db.select).toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
    expect(redis.publish).toHaveBeenCalledWith(
      "run-logs:run-123",
      expect.stringContaining("Hello World")
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith({
      runId: "run-123",
      message: "Hello World",
    });
  });
});
