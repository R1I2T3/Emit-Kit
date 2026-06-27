import { describe, it, expect, vi, beforeEach } from "vitest";
import { processGenerationJob } from "./generation";
import { fetchSpec } from "../steps/fetch-spec";
import { parseSpec } from "../steps/parse-spec";
import { diffSpec } from "../steps/diff-spec";
import { calcVersion } from "../steps/calc-version";
import { logStep } from "../lib/logger";

const { mockSelect, mockLimit, mockUpdate, mockSet } = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhereSelect });
  const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
  const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

  const mockWhereUpdate = vi.fn().mockResolvedValue([]);
  const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

  return { mockSelect, mockLimit, mockUpdate, mockSet };
});

vi.mock("@Emitkit/db", () => {
  return {
    db: {
      select: mockSelect,
      update: mockUpdate,
    },
  };
});

vi.mock("../steps/fetch-spec", () => ({
  fetchSpec: vi.fn(),
}));

vi.mock("../steps/parse-spec", () => ({
  parseSpec: vi.fn(),
}));

vi.mock("../steps/diff-spec", () => ({
  diffSpec: vi.fn(),
}));

vi.mock("../steps/calc-version", () => ({
  calcVersion: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  logStep: vi.fn(),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("generation.ts - processGenerationJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should run steps sequentially, update DB and log steps on success", async () => {
    const mockJob = {
      data: {
        runId: "run-123",
      },
    } as any;

    const mockRun = { id: "run-123", projectId: "proj-123", configId: "cfg-123" };
    const mockProject = { id: "proj-123", repoFullName: "owner/repo" };
    const mockConfig = { id: "cfg-123", projectId: "proj-123" };

    mockLimit.mockResolvedValueOnce([{
      run: mockRun,
      project: mockProject,
      config: mockConfig,
    }]);

    vi.mocked(fetchSpec).mockResolvedValueOnce({ content: "spec content", sha: "sha-abc" });
    vi.mocked(parseSpec).mockResolvedValueOnce({ operations: [] } as any);
    vi.mocked(diffSpec).mockResolvedValueOnce({
      isFirstRun: true,
      addedOperations: 0,
      removedOperations: 0,
      modifiedOperations: 0,
      breakingChanges: [],
    });
    vi.mocked(calcVersion).mockResolvedValueOnce("0.2.0");

    const result = await processGenerationJob(mockJob);

    expect(result).toEqual({ sdkVersion: "0.2.0" });

    // Assert database updates
    // 1. Immediately update status = 'running'
    expect(mockUpdate).toHaveBeenNthCalledWith(1, expect.anything());
    expect(mockSet).toHaveBeenNthCalledWith(1, { status: "running" });

    // 2. Update commitSha = sha
    expect(mockSet).toHaveBeenNthCalledWith(2, { commitSha: "sha-abc" });

    // 3. Update sdkVersion and specSnapshot
    expect(mockSet).toHaveBeenNthCalledWith(3, {
      sdkVersion: "0.2.0",
      specSnapshot: JSON.stringify({ operations: [] }),
    });

    // 4. Update status = 'success' and finishedAt = Date
    expect(mockSet).toHaveBeenNthCalledWith(4, {
      status: "success",
      finishedAt: expect.any(Date),
    });

    // Assert sequential step execution
    expect(fetchSpec).toHaveBeenCalledWith(mockProject);
    expect(parseSpec).toHaveBeenCalledWith("spec content");
    expect(diffSpec).toHaveBeenCalledWith({ operations: [] }, "proj-123");
    expect(calcVersion).toHaveBeenCalledWith(
      mockConfig,
      { isFirstRun: true, addedOperations: 0, removedOperations: 0, modifiedOperations: 0, breakingChanges: [] },
      { operations: [] }
    );

    // Assert log steps
    expect(logStep).toHaveBeenCalledWith("run-123", "Starting generation...");
    expect(logStep).toHaveBeenCalledWith("run-123", "Fetching OpenAPI spec...");
    expect(logStep).toHaveBeenCalledWith("run-123", "Parsing OpenAPI spec...");
    expect(logStep).toHaveBeenCalledWith("run-123", "Analyzing changes...");
    expect(logStep).toHaveBeenCalledWith("run-123", "Calculating version...");
    expect(logStep).toHaveBeenCalledWith("run-123", "Version: 0.2.0");
    expect(logStep).toHaveBeenCalledWith("run-123", "[DONE]");
  });

  it("should fail and update status = 'failed' if join returns no data", async () => {
    const mockJob = {
      data: {
        runId: "run-123",
      },
    } as any;

    mockLimit.mockResolvedValueOnce([]); // Nothing found

    await expect(processGenerationJob(mockJob)).rejects.toThrow(
      "Generation run, project, or config not found for runId: run-123"
    );

    // Initial running update
    expect(mockSet).toHaveBeenNthCalledWith(1, { status: "running" });

    // Status should be set to failed
    expect(mockSet).toHaveBeenNthCalledWith(2, {
      status: "failed",
      finishedAt: expect.any(Date),
    });

    // Logging errors
    expect(logStep).toHaveBeenCalledWith(
      "run-123",
      "ERROR: Generation run, project, or config not found for runId: run-123"
    );
    expect(logStep).toHaveBeenCalledWith("run-123", "[DONE]");
  });

  it("should catch step errors, log them, mark run as failed, and rethrow", async () => {
    const mockJob = {
      data: {
        runId: "run-123",
      },
    } as any;

    const mockRun = { id: "run-123", projectId: "proj-123", configId: "cfg-123" };
    const mockProject = { id: "proj-123", repoFullName: "owner/repo" };
    const mockConfig = { id: "cfg-123", projectId: "proj-123" };

    mockLimit.mockResolvedValueOnce([{
      run: mockRun,
      project: mockProject,
      config: mockConfig,
    }]);

    vi.mocked(fetchSpec).mockRejectedValueOnce(new Error("Failed to fetch spec from GitHub"));

    await expect(processGenerationJob(mockJob)).rejects.toThrow("Failed to fetch spec from GitHub");

    // Immediately status = 'running'
    expect(mockSet).toHaveBeenNthCalledWith(1, { status: "running" });

    // Status failed
    expect(mockSet).toHaveBeenNthCalledWith(2, {
      status: "failed",
      finishedAt: expect.any(Date),
    });

    expect(logStep).toHaveBeenCalledWith("run-123", "ERROR: Failed to fetch spec from GitHub");
    expect(logStep).toHaveBeenCalledWith("run-123", "[DONE]");
  });
});
