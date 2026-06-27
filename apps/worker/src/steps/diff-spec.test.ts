import { describe, it, expect, vi, beforeEach } from "vitest";
import { diffSpec } from "./diff-spec";

const { mockSelect, mockLimit } = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return { mockSelect, mockFrom, mockWhere, mockOrderBy, mockLimit };
});

vi.mock("@Emitkit/db", () => {
  return {
    db: {
      select: mockSelect,
    },
  };
});

describe("diff-spec.ts - diffSpec", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return first run stats if no previous run is found", async () => {
    mockLimit.mockResolvedValueOnce([]); // No previous successful runs

    const currentSpec = {
      operations: [
        { operationId: "op-1", parameters: [] },
        { operationId: "op-2", parameters: [] },
      ],
    };

    const result = await diffSpec(currentSpec, "project-123");

    expect(result).toEqual({
      isFirstRun: true,
      addedOperations: 2,
      removedOperations: 0,
      modifiedOperations: 0,
      breakingChanges: [],
    });
  });

  it("should calculate correct diffs between previous spec and current spec", async () => {
    const previousSpec = {
      operations: [
        {
          operationId: "op-keep",
          parameters: [{ name: "param1", required: false }],
        },
        {
          operationId: "op-break",
          parameters: [{ name: "param1", required: true }],
        },
        {
          operationId: "op-removed",
          parameters: [],
        },
      ],
    };

    mockLimit.mockResolvedValueOnce([
      {
        specSnapshot: JSON.stringify(previousSpec),
      },
    ]);

    const currentSpec = {
      operations: [
        {
          operationId: "op-keep",
          parameters: [{ name: "param1", required: false }],
        },
        {
          operationId: "op-break",
          parameters: [
            { name: "param1", required: true },
            { name: "param2", required: true }, // Count of required params increased (1 -> 2)
          ],
        },
        {
          operationId: "op-added",
          parameters: [],
        },
      ],
    };

    const result = await diffSpec(currentSpec, "project-123");

    expect(result).toEqual({
      isFirstRun: false,
      addedOperations: 1, // op-added
      removedOperations: 1, // op-removed
      modifiedOperations: 1, // op-break
      breakingChanges: ["op-break"],
    });
  });

  it("should handle parsed object in specSnapshot without JSON.parse if it's already an object", async () => {
    const previousSpec = {
      operations: [
        {
          operationId: "op-1",
          parameters: [],
        },
      ],
    };

    mockLimit.mockResolvedValueOnce([
      {
        specSnapshot: previousSpec, // already an object
      },
    ]);

    const currentSpec = {
      operations: [
        {
          operationId: "op-1",
          parameters: [],
        },
      ],
    };

    const result = await diffSpec(currentSpec, "project-123");

    expect(result).toEqual({
      isFirstRun: false,
      addedOperations: 0,
      removedOperations: 0,
      modifiedOperations: 0,
      breakingChanges: [],
    });
  });
});
