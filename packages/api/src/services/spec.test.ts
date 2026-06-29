import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSpec, saveSpec } from "./spec";
import { GitHubClient } from "@Emitkit/github";

const mockGetRepoContent = vi.fn();
const mockCreateOrUpdateFileContents = vi.fn();

vi.mock("@Emitkit/github", () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => {
      return {
        getOctokit: () => ({
          repos: {
            createOrUpdateFileContents: mockCreateOrUpdateFileContents,
          },
        }),
      };
    }),
    getRepoContent: (...args: any[]) => mockGetRepoContent(...args),
  };
});

describe("spec service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should retrieve spec details successfully", async () => {
    const mockProject = {
      id: "project-1",
      repoFullName: "owner/repo",
      specPath: "openapi.yaml",
      defaultBranch: "main",
    };
    mockGetRepoContent.mockResolvedValue({
      content: "openapi: 3.0.0",
      sha: "sha-123",
    });

    const client = new GitHubClient("token");
    const result = await getSpec(mockProject, client);

    expect(mockGetRepoContent).toHaveBeenCalledWith(client, "owner", "repo", "openapi.yaml", "main");
    expect(result).toEqual({
      content: "openapi: 3.0.0",
      sha: "sha-123",
      format: "yaml",
    });
  });

  it("should save spec content successfully", async () => {
    const mockProject = {
      id: "project-1",
      repoFullName: "owner/repo",
      specPath: "openapi.yaml",
      defaultBranch: "main",
    };
    mockCreateOrUpdateFileContents.mockResolvedValue({
      data: {
        commit: {
          sha: "new-commit-sha",
        },
      },
    });

    const client = new GitHubClient("token");
    const result = await saveSpec(mockProject, "new-content", "sha-123", client);

    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      path: "openapi.yaml",
      message: "docs: update openapi spec via Emitkit editor",
      content: Buffer.from("new-content").toString("base64"),
      sha: "sha-123",
      branch: "main",
    });
    expect(result).toEqual({
      commitSha: "new-commit-sha",
    });
  });

  it("should throw CONFLICT error when GitHub API returns status 409", async () => {
    const mockProject = {
      id: "project-1",
      repoFullName: "owner/repo",
      specPath: "openapi.yaml",
      defaultBranch: "main",
    };
    const error409 = new Error("Conflict");
    (error409 as any).status = 409;
    mockCreateOrUpdateFileContents.mockRejectedValue(error409);

    const client = new GitHubClient("token");
    await expect(saveSpec(mockProject, "new-content", "sha-123", client)).rejects.toThrow("CONFLICT");
  });
});
