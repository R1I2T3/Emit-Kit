import { describe, it, expect, vi, beforeEach } from "vitest";
import { markStaleRunsAsFailed } from "./index";
import { db } from "@Emitkit/db";

vi.mock("@Emitkit/db", () => {
  const mockUpdateSetWhere = vi.fn().mockResolvedValue([]);
  const mockUpdateSet = vi.fn().mockReturnValue({
    where: mockUpdateSetWhere,
  });
  const mockUpdate = vi.fn().mockReturnValue({
    set: mockUpdateSet,
  });

  return {
    db: {
      update: mockUpdate,
    },
  };
});

vi.mock("./lib/redis", () => {
  return {
    redis: {},
  };
});

vi.mock("./lib/logger", () => {
  return {
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock("./processors/generation", () => {
  return {
    processGenerationJob: vi.fn(),
  };
});

vi.mock("bullmq", () => {
  const mockOn = vi.fn();
  return {
    Worker: vi.fn().mockImplementation(() => {
      return {
        on: mockOn,
      };
    }),
  };
});

describe("index.ts - markStaleRunsAsFailed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update all running runs to failed on startup", async () => {
    await markStaleRunsAsFailed();
    expect(db.update).toHaveBeenCalled();
  });
});
