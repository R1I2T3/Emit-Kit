import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSpec, saveSpec, type SpecProjectInput } from "./spec";
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

  it("should retrieve spec details successfully (yaml format)", async () => {
    const mockProject: SpecProjectInput = {
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

  it("should retrieve spec details successfully with lowercase .json", async () => {
    const mockProject: SpecProjectInput = {
      repoFullName: "owner/repo",
      specPath: "openapi.json",
      defaultBranch: "main",
    };
    mockGetRepoContent.mockResolvedValue({
      content: '{"openapi": "3.0.0"}',
      sha: "sha-456",
    });

    const client = new GitHubClient("token");
    const result = await getSpec(mockProject, client);

    expect(result).toEqual({
      content: '{"openapi": "3.0.0"}',
      sha: "sha-456",
      format: "json",
    });
  });

  it("should retrieve spec details successfully with uppercase .JSON", async () => {
    const mockProject: SpecProjectInput = {
      repoFullName: "owner/repo",
      specPath: "openapi.JSON",
      defaultBranch: "main",
    };
    mockGetRepoContent.mockResolvedValue({
      content: '{"openapi": "3.0.0"}',
      sha: "sha-456",
    });

    const client = new GitHubClient("token");
    const result = await getSpec(mockProject, client);

    expect(result).toEqual({
      content: '{"openapi": "3.0.0"}',
      sha: "sha-456",
      format: "json",
    });
  });

  it("should throw error for invalid repoFullName format in getSpec", async () => {
    const mockProject = {
      repoFullName: "invalidrepo",
      specPath: "openapi.yaml",
      defaultBranch: "main",
    } as any;

    const client = new GitHubClient("token");
    await expect(getSpec(mockProject, client)).rejects.toThrow("Invalid repository full name");
  });

  it("should throw error for missing repoFullName in getSpec", async () => {
    const mockProject = {
      specPath: "openapi.yaml",
      defaultBranch: "main",
    } as any;

    const client = new GitHubClient("token");
    await expect(getSpec(mockProject, client)).rejects.toThrow("Missing project repository information");
  });

  it("should save spec content successfully with valid expectedSha", async () => {
    const mockProject: SpecProjectInput = {
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

  it("should omit expectedSha if it is empty string", async () => {
    const mockProject: SpecProjectInput = {
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
    const result = await saveSpec(mockProject, "new-content", "", client);

    expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      path: "openapi.yaml",
      message: "docs: update openapi spec via Emitkit editor",
      content: Buffer.from("new-content").toString("base64"),
      sha: undefined,
      branch: "main",
    });
    expect(result).toEqual({
      commitSha: "new-commit-sha",
    });
  });

  it("should throw CONFLICT error when GitHub API returns status 409", async () => {
    const mockProject: SpecProjectInput = {
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

  it("should propagate other non-409 errors thrown by GitHub API", async () => {
    const mockProject: SpecProjectInput = {
      repoFullName: "owner/repo",
      specPath: "openapi.yaml",
      defaultBranch: "main",
    };
    const error500 = new Error("Internal Server Error");
    (error500 as any).status = 500;
    mockCreateOrUpdateFileContents.mockRejectedValue(error500);

    const client = new GitHubClient("token");
    await expect(saveSpec(mockProject, "new-content", "sha-123", client)).rejects.toThrow("Internal Server Error");
  });
});
