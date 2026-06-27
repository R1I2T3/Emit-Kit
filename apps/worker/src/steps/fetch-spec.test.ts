import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchSpec } from "./fetch-spec";
import { getRepoContent } from "@Emitkit/github";

const { mockSelect, mockWhere } = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
  const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return { mockSelect, mockFrom, mockInnerJoin, mockWhere };
});

vi.mock("@Emitkit/db", () => {
  return {
    db: {
      select: mockSelect,
    },
  };
});

vi.mock("@Emitkit/github", () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => ({})),
    getRepoContent: vi.fn(),
  };
});

describe("fetch-spec.ts - fetchSpec", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail if project is invalid or repoFullName is malformed", async () => {
    await expect(fetchSpec(null)).rejects.toThrow("Invalid project: repoFullName is missing");
    await expect(fetchSpec({ repoFullName: "invalid" })).rejects.toThrow(
      "Invalid repoFullName format. Expected 'owner/repo'"
    );
  });

  it("should fail if no connected GitHub account found", async () => {
    mockWhere.mockResolvedValueOnce([]); // No records returned from DB query
    const project = {
      orgId: "org-123",
      repoFullName: "owner/repo",
      specPath: "openapi.yaml",
      defaultBranch: "main",
    };

    await expect(fetchSpec(project)).rejects.toThrow(
      "No connected GitHub account found for this organization"
    );
    expect(mockSelect).toHaveBeenCalled();
  });

  it("should fail if spec file exceeds 2MB limit", async () => {
    mockWhere.mockResolvedValueOnce([{ accessToken: "token-123" }]);
    const largeContent = "a".repeat(2 * 1024 * 1024 + 1);
    vi.mocked(getRepoContent).mockResolvedValueOnce({
      content: largeContent,
      sha: "sha-123",
    });

    const project = {
      orgId: "org-123",
      repoFullName: "owner/repo",
      specPath: "openapi.yaml",
      defaultBranch: "main",
    };

    await expect(fetchSpec(project)).rejects.toThrow("Spec file exceeds 2MB limit");
  });

  it("should succeed and return content and sha on success", async () => {
    mockWhere.mockResolvedValueOnce([{ accessToken: "token-123" }]);
    vi.mocked(getRepoContent).mockResolvedValueOnce({
      content: "openapi: 3.0.0",
      sha: "sha-123",
    });

    const project = {
      orgId: "org-123",
      repoFullName: "owner/repo",
      specPath: "openapi.yaml",
      defaultBranch: "main",
    };

    const result = await fetchSpec(project);
    expect(result).toEqual({
      content: "openapi: 3.0.0",
      sha: "sha-123",
    });
    expect(getRepoContent).toHaveBeenCalledWith(
      expect.any(Object),
      "owner",
      "repo",
      "openapi.yaml",
      "main"
    );
  });
});
