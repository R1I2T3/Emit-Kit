import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchSpec } from "./fetch-spec";
import { getRepoContent } from "@Emitkit/github";
import { getGitHubClientForProject } from "@Emitkit/api/services/projects";

vi.mock("@Emitkit/api/services/projects", () => ({
  getGitHubClientForProject: vi.fn(),
}));

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
    vi.mocked(getGitHubClientForProject).mockRejectedValueOnce(
      new Error("No connected GitHub account found for this organization")
    );
    const project = {
      orgId: "org-123",
      repoFullName: "owner/repo",
      specPath: "openapi.yaml",
      defaultBranch: "main",
    };

    await expect(fetchSpec(project)).rejects.toThrow(
      "No connected GitHub account found for this organization"
    );
    expect(getGitHubClientForProject).toHaveBeenCalledWith(project);
  });

  it("should fail if spec file exceeds 2MB limit", async () => {
    vi.mocked(getGitHubClientForProject).mockResolvedValueOnce({} as any);
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
    vi.mocked(getGitHubClientForProject).mockResolvedValueOnce({} as any);
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
