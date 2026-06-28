import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubClient } from "./client";
import {
  createBranch,
  checkFileExists,
  createCommitWithFiles,
  createPullRequest,
  createTag,
} from "./pr";

const mockOctokit = {
  git: {
    createRef: vi.fn(),
    getRef: vi.fn(),
    getCommit: vi.fn(),
    createBlob: vi.fn(),
    createTree: vi.fn(),
    createCommit: vi.fn(),
    updateRef: vi.fn(),
  },
  repos: {
    getContent: vi.fn(),
  },
  pulls: {
    create: vi.fn(),
  },
};

vi.mock("./client", () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => {
      return {
        getOctokit: () => mockOctokit,
        withRetry: (fn: any) => fn(),
      };
    }),
  };
});

describe("PR Service Operations", () => {
  let client: any;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GitHubClient("dummy-token");
  });

  describe("createBranch", () => {
    it("should call git.createRef with the correct refs/heads/ path", async () => {
      const createRefMock = mockOctokit.git.createRef;
      createRefMock.mockResolvedValue({ data: {} });

      await createBranch(client, "owner", "repo", "new-branch", "base-sha-123");

      expect(createRefMock).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "refs/heads/new-branch",
        sha: "base-sha-123",
      });
    });

    it("should handle branch name that already has refs/heads/", async () => {
      const createRefMock = mockOctokit.git.createRef;
      createRefMock.mockResolvedValue({ data: {} });

      await createBranch(client, "owner", "repo", "refs/heads/another-branch", "base-sha-456");

      expect(createRefMock).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "refs/heads/another-branch",
        sha: "base-sha-456",
      });
    });
  });

  describe("checkFileExists", () => {
    it("should return true when repos.getContent succeeds", async () => {
      const getContentMock = mockOctokit.repos.getContent;
      getContentMock.mockResolvedValue({ data: {} });

      const exists = await checkFileExists(client, "owner", "repo", "path/to/file", "main");

      expect(getContentMock).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        path: "path/to/file",
        ref: "main",
      });
      expect(exists).toBe(true);
    });

    it("should return false when repos.getContent throws an error", async () => {
      const getContentMock = mockOctokit.repos.getContent;
      getContentMock.mockRejectedValue(new Error("Not Found"));

      const exists = await checkFileExists(client, "owner", "repo", "missing/file", "main");

      expect(exists).toBe(false);
    });
  });

  describe("createCommitWithFiles", () => {
    it("should orchestrate creation of blobs, tree, commit, and update ref", async () => {
      const getRefMock = mockOctokit.git.getRef;
      const getCommitMock = mockOctokit.git.getCommit;
      const createBlobMock = mockOctokit.git.createBlob;
      const createTreeMock = mockOctokit.git.createTree;
      const createCommitMock = mockOctokit.git.createCommit;
      const updateRefMock = mockOctokit.git.updateRef;

      // Mock returns
      getRefMock.mockResolvedValue({
        data: { object: { sha: "parent-commit-sha" } },
      });
      getCommitMock.mockResolvedValue({
        data: { tree: { sha: "base-tree-sha" } },
      });
      createBlobMock.mockResolvedValue({
        data: { sha: "blob-sha-123" },
      });
      createTreeMock.mockResolvedValue({
        data: { sha: "new-tree-sha" },
      });
      createCommitMock.mockResolvedValue({
        data: { sha: "new-commit-sha" },
      });
      updateRefMock.mockResolvedValue({ data: {} });

      const files = [
        { path: "file1.txt", content: "hello world" },
        { path: "src/file2.ts", content: "console.log(2);" },
      ];

      const commitSha = await createCommitWithFiles(
        client,
        "owner",
        "repo",
        "feature-branch",
        files,
        "Commit message"
      );

      // Verify sequence
      expect(getRefMock).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "heads/feature-branch",
      });

      expect(getCommitMock).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        commit_sha: "parent-commit-sha",
      });

      expect(createBlobMock).toHaveBeenCalledTimes(2);
      expect(createBlobMock).toHaveBeenNthCalledWith(1, {
        owner: "owner",
        repo: "repo",
        content: Buffer.from("hello world").toString("base64"),
        encoding: "base64",
      });
      expect(createBlobMock).toHaveBeenNthCalledWith(2, {
        owner: "owner",
        repo: "repo",
        content: Buffer.from("console.log(2);").toString("base64"),
        encoding: "base64",
      });

      expect(createTreeMock).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        base_tree: "base-tree-sha",
        tree: [
          { path: "file1.txt", mode: "100644", type: "blob", sha: "blob-sha-123" },
          { path: "src/file2.ts", mode: "100644", type: "blob", sha: "blob-sha-123" },
        ],
      });

      expect(createCommitMock).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        message: "Commit message",
        tree: "new-tree-sha",
        parents: ["parent-commit-sha"],
      });

      expect(updateRefMock).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "heads/feature-branch",
        sha: "new-commit-sha",
      });

      expect(commitSha).toBe("new-commit-sha");
    });
  });

  describe("createPullRequest", () => {
    it("should call pulls.create and return the pull request html_url", async () => {
      const createPrMock = mockOctokit.pulls.create;
      createPrMock.mockResolvedValue({
        data: { html_url: "https://github.com/owner/repo/pull/1" },
      });

      const url = await createPullRequest(
        client,
        "owner",
        "repo",
        "PR Title",
        "PR Body",
        "feature",
        "main"
      );

      expect(createPrMock).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        title: "PR Title",
        body: "PR Body",
        head: "feature",
        base: "main",
      });
      expect(url).toBe("https://github.com/owner/repo/pull/1");
    });
  });

  describe("createTag", () => {
    it("should call git.createRef with the correct refs/tags/ path", async () => {
      const createRefMock = mockOctokit.git.createRef;
      createRefMock.mockResolvedValue({ data: {} });

      await createTag(client, "owner", "repo", "v1.0.0", "commit-sha-123");

      expect(createRefMock).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "refs/tags/v1.0.0",
        sha: "commit-sha-123",
      });
    });

    it("should handle tag name that already has refs/tags/", async () => {
      const createRefMock = mockOctokit.git.createRef;
      createRefMock.mockResolvedValue({ data: {} });

      await createTag(client, "owner", "repo", "refs/tags/v2.0.0", "commit-sha-456");

      expect(createRefMock).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        ref: "refs/tags/v2.0.0",
        sha: "commit-sha-456",
      });
    });
  });
});
