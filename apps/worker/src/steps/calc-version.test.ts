import { describe, it, expect, vi, beforeEach } from "vitest";
import { calcVersion } from "./calc-version";

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

describe("calc-version.ts - calcVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return spec-version if sdkVersionStrategy is spec-version", async () => {
    const config = { sdkVersionStrategy: "spec-version" };
    const diff = { isFirstRun: false };
    const parsedSpec = { info: { version: "2.3.4" } };

    const result = await calcVersion(config, diff, parsedSpec);
    expect(result).toBe("2.3.4");
  });

  it("should return 0.1.0 on first run", async () => {
    const config = { sdkVersionStrategy: "emitkit-managed" };
    const diff = { isFirstRun: true };
    const parsedSpec = { info: { version: "2.3.4" } };

    const result = await calcVersion(config, diff, parsedSpec);
    expect(result).toBe("0.1.0");
  });

  it("should bump major version if post-1.0.0 and there are breaking changes or removed operations", async () => {
    const config = { sdkVersionStrategy: "emitkit-managed", projectId: "p-123" };
    const diff = {
      isFirstRun: false,
      breakingChanges: ["op-1"],
      removedOperations: 0,
      addedOperations: 2,
    };
    const parsedSpec = { info: { version: "2.3.4" } };

    mockLimit.mockResolvedValueOnce([{ version: "1.2.3" }]);

    const result = await calcVersion(config, diff, parsedSpec);
    expect(result).toBe("2.0.0");
  });

  it("should bump minor version if pre-1.0.0 and there are breaking changes or removed operations", async () => {
    const config = { sdkVersionStrategy: "emitkit-managed", projectId: "p-123" };
    const diff = {
      isFirstRun: false,
      breakingChanges: ["op-1"],
      removedOperations: 0,
      addedOperations: 2,
    };
    const parsedSpec = { info: { version: "2.3.4" } };

    mockLimit.mockResolvedValueOnce([{ version: "0.2.3" }]);

    const result = await calcVersion(config, diff, parsedSpec);
    expect(result).toBe("0.3.0");
  });

  it("should bump minor version if post-1.0.0 and there are added or modified operations but no breaking changes or removals", async () => {
    const config = { sdkVersionStrategy: "emitkit-managed", projectId: "p-123" };
    const diff = {
      isFirstRun: false,
      breakingChanges: [],
      removedOperations: 0,
      addedOperations: 1,
    };
    const parsedSpec = { info: { version: "2.3.4" } };

    mockLimit.mockResolvedValueOnce([{ version: "1.2.3" }]);

    const result = await calcVersion(config, diff, parsedSpec);
    expect(result).toBe("1.3.0");
  });

  it("should bump patch version if pre-1.0.0 and there are added operations but no breaking changes or removals", async () => {
    const config = { sdkVersionStrategy: "emitkit-managed", projectId: "p-123" };
    const diff = {
      isFirstRun: false,
      breakingChanges: [],
      removedOperations: 0,
      addedOperations: 1,
    };
    const parsedSpec = { info: { version: "2.3.4" } };

    mockLimit.mockResolvedValueOnce([{ version: "0.2.3" }]);

    const result = await calcVersion(config, diff, parsedSpec);
    expect(result).toBe("0.2.4");
  });

  it("should return last version if there are no changes", async () => {
    const config = { sdkVersionStrategy: "emitkit-managed", projectId: "p-123" };
    const diff = {
      isFirstRun: false,
      breakingChanges: [],
      removedOperations: 0,
      addedOperations: 0,
    };
    const parsedSpec = { info: { version: "2.3.4" } };

    mockLimit.mockResolvedValueOnce([{ version: "1.2.3" }]);

    const result = await calcVersion(config, diff, parsedSpec);
    expect(result).toBe("1.2.3");
  });

  it("should fallback to 0.1.0 and bump accordingly if no previous versions in db", async () => {
    const config = { sdkVersionStrategy: "emitkit-managed", projectId: "p-123" };
    const diff = {
      isFirstRun: false,
      breakingChanges: [],
      removedOperations: 0,
      addedOperations: 1,
    };
    const parsedSpec = { info: { version: "2.3.4" } };

    mockLimit.mockResolvedValueOnce([]); // No previous version

    const result = await calcVersion(config, diff, parsedSpec);
    expect(result).toBe("0.1.1");
  });
});
