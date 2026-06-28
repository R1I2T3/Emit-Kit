import { describe, it, expect, vi, beforeEach } from "vitest";
import { commitOutput } from "./commit-output";
import { GitHubClient } from "@Emitkit/github";
import { generateNpmWorkflow, generatePyPIWorkflow } from "@Emitkit/generators";

const {
  mockGetRef,
  mockCheckFileExists,
  mockCreateBranch,
  mockCreateCommitWithFiles,
  mockCreatePullRequest,
} = vi.hoisted(() => {
  return {
    mockGetRef: vi.fn(),
    mockCheckFileExists: vi.fn(),
    mockCreateBranch: vi.fn(),
    mockCreateCommitWithFiles: vi.fn(),
    mockCreatePullRequest: vi.fn(),
  };
});

vi.mock("@Emitkit/github", () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => ({
      getOctokit: vi.fn().mockReturnValue({
        git: {
          getRef: mockGetRef,
        },
      }),
    })),
    checkFileExists: mockCheckFileExists,
    createBranch: mockCreateBranch,
    createCommitWithFiles: mockCreateCommitWithFiles,
    createPullRequest: mockCreatePullRequest,
  };
});

vi.mock("@Emitkit/generators", () => {
  return {
    generateNpmWorkflow: vi.fn().mockReturnValue("mock npm workflow"),
    generatePyPIWorkflow: vi.fn().mockReturnValue("mock python workflow"),
  };
});

describe("commitOutput step", () => {
  let project: any;
  let config: any;
  let files: Array<{ path: string; content: string }>;
  let runId: string;
  let version: string;
  let githubClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    project = {
      defaultBranch: "main",
      repoFullName: "owner/base-repo",
      outputMode: "same",
      outputRepoFullName: "owner/separate-repo",
    };

    config = {
      outputs: "[]",
      sdkLanguages: "[]",
      outputDir: ".emitkit",
    };

    files = [
      { path: "src/client.ts", content: "client code" },
      { path: "README.md", content: "readme content" },
    ];

    runId = "run-123";
    version = "1.0.0";
    githubClient = new GitHubClient("dummy-token");

    // Setup base getRef mock response
    mockGetRef.mockResolvedValue({
      data: {
        object: {
          sha: "base-commit-sha",
        },
      },
    });

    mockCreatePullRequest.mockResolvedValue("https://github.com/owner/repo/pull/123");
  });

  it("should determine target repo based on project.outputMode", async () => {
    // 1. Same repository mode
    project.outputMode = "same";
    await commitOutput(project, config, files, runId, version, githubClient);

    expect(mockGetRef).toHaveBeenCalledWith({
      owner: "owner",
      repo: "base-repo",
      ref: "heads/main",
    });

    // 2. Separate repository mode
    vi.clearAllMocks();
    project.outputMode = "separate";
    await commitOutput(project, config, files, runId, version, githubClient);

    expect(mockGetRef).toHaveBeenCalledWith({
      owner: "owner",
      repo: "separate-repo",
      ref: "heads/main",
    });
  });

  it("should fail if repository full name is missing or invalid", async () => {
    project.repoFullName = null;
    project.outputMode = "same";
    await expect(
      commitOutput(project, config, files, runId, version, githubClient)
    ).rejects.toThrow("Repository full name is required but not provided.");

    project.repoFullName = "invalidrepo";
    await expect(
      commitOutput(project, config, files, runId, version, githubClient)
    ).rejects.toThrow("Invalid repository full name format: invalidrepo");
  });

  it("should filter out custom files that already exist in the default branch", async () => {
    const filesWithCustom = [
      { path: "src/client.ts", content: "client code" },
      { path: "src/custom/helper.ts", content: "custom helper" },
      { path: "src/custom/new.ts", content: "new custom file" },
    ];

    mockCheckFileExists.mockImplementation(async (_client, _owner, _repo, path) => {
      // helper.ts exists on GitHub, new.ts does not
      return path.includes("helper.ts");
    });

    await commitOutput(project, config, filesWithCustom, runId, version, githubClient);

    // Verify checkFileExists calls
    expect(mockCheckFileExists).toHaveBeenCalledTimes(2);
    expect(mockCheckFileExists).toHaveBeenCalledWith(
      githubClient,
      "owner",
      "base-repo",
      "src/custom/helper.ts",
      "main"
    );
    expect(mockCheckFileExists).toHaveBeenCalledWith(
      githubClient,
      "owner",
      "base-repo",
      "src/custom/new.ts",
      "main"
    );

    // Verify committed files (excludes helper.ts, includes new.ts)
    expect(mockCreateCommitWithFiles).toHaveBeenCalledWith(
      githubClient,
      "owner",
      "base-repo",
      "emitkit/run-run-123",
      [
        { path: "src/client.ts", content: "client code" },
        { path: "src/custom/new.ts", content: "new custom file" },
      ],
      "chore: emitkit run #run-123 — 1.0.0"
    );
  });

  it("should add GitHub Action workflow files when config specifies output is SDK and languages contain typescript/python", async () => {
    config.outputs = '["SDK"]';
    config.sdkLanguages = '["typescript", "python"]';

    await commitOutput(project, config, files, runId, version, githubClient);

    expect(generateNpmWorkflow).toHaveBeenCalledWith(".emitkit");
    expect(generatePyPIWorkflow).toHaveBeenCalledWith(".emitkit");

    expect(mockCreateCommitWithFiles).toHaveBeenCalledWith(
      githubClient,
      "owner",
      "base-repo",
      "emitkit/run-run-123",
      [
        ...files,
        { path: ".github/workflows/publish-npm.yml", content: "mock npm workflow" },
        { path: ".github/workflows/publish-pypi.yml", content: "mock python workflow" },
      ],
      "chore: emitkit run #run-123 — 1.0.0"
    );
  });

  it("should handle config.outputs and config.sdkLanguages when they are arrays directly", async () => {
    config.outputs = ["SDK"];
    config.sdkLanguages = ["typescript"];

    await commitOutput(project, config, files, runId, version, githubClient);

    expect(generateNpmWorkflow).toHaveBeenCalledWith(".emitkit");
    expect(generatePyPIWorkflow).not.toHaveBeenCalled();

    expect(mockCreateCommitWithFiles).toHaveBeenCalledWith(
      githubClient,
      "owner",
      "base-repo",
      "emitkit/run-run-123",
      [
        ...files,
        { path: ".github/workflows/publish-npm.yml", content: "mock npm workflow" },
      ],
      "chore: emitkit run #run-123 — 1.0.0"
    );
  });

  it("should correctly handle invalid or malformed outputs and sdkLanguages config fields", async () => {
    config.outputs = "SDK"; // plain string instead of JSON array
    config.sdkLanguages = "typescript, python"; // comma separated plain string

    await commitOutput(project, config, files, runId, version, githubClient);

    expect(generateNpmWorkflow).toHaveBeenCalledWith(".emitkit");
    expect(generatePyPIWorkflow).toHaveBeenCalledWith(".emitkit");
  });

  it("should branch, commit, and create PR with the correct format, returning prUrl and branchName", async () => {
    config.outputs = ["SDK", "CLI"];
    const result = await commitOutput(project, config, files, runId, version, githubClient);

    // Verify branch creation
    expect(mockCreateBranch).toHaveBeenCalledWith(
      githubClient,
      "owner",
      "base-repo",
      "emitkit/run-run-123",
      "base-commit-sha"
    );

    // Verify commit creation
    expect(mockCreateCommitWithFiles).toHaveBeenCalledWith(
      githubClient,
      "owner",
      "base-repo",
      "emitkit/run-run-123",
      files,
      "chore: emitkit run #run-123 — 1.0.0"
    );

    // Verify PR creation
    const expectedPrBody = `## Emitkit Generation Run

**Run ID:** run-123
**Version:** 1.0.0
**Outputs:** SDK, CLI

### Generated Files
- src/client.ts
- README.md

---
*This PR was automatically generated by Emitkit.*`;

    expect(mockCreatePullRequest).toHaveBeenCalledWith(
      githubClient,
      "owner",
      "base-repo",
      "Emitkit: Generated SDK v1.0.0",
      expectedPrBody,
      "emitkit/run-run-123",
      "main"
    );

    // Verify return structure
    expect(result).toEqual({
      prUrl: "https://github.com/owner/repo/pull/123",
      branchName: "emitkit/run-run-123",
    });
  });
});
