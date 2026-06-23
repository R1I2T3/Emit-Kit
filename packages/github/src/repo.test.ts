import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubClient } from "./client";
import { listUserRepos, createRepo, getRepoContent, createInitialCommit } from "./repo";

const mockOctokit = {
  repos: {
    listForAuthenticatedUser: vi.fn(),
    createForAuthenticatedUser: vi.fn(),
    createInOrg: vi.fn(),
    getContent: vi.fn(),
    createOrUpdateFileContents: vi.fn(),
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

describe("Repo Operations", () => {
  let client: any;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GitHubClient("encrypted-token");
  });

  it("listUserRepos returns a clean mapped array of repos with push permission", async () => {
    const listMock = client.getOctokit().repos.listForAuthenticatedUser as any;
    listMock.mockResolvedValue({
      data: [
        { id: 1, name: "repo-1", owner: { login: "user" }, permissions: { push: true }, html_url: "url1" },
        { id: 2, name: "repo-2", owner: { login: "user" }, permissions: { push: false }, html_url: "url2" },
      ],
    });

    const repos = await listUserRepos(client);
    expect(repos).toEqual([
      { id: 1, name: "repo-1", owner: "user", permissions: { push: true }, url: "url1" },
    ]);
  });

  it("createRepo handles user vs org repository creation", async () => {
    const createPersonalMock = client.getOctokit().repos.createForAuthenticatedUser as any;
    const createOrgMock = client.getOctokit().repos.createInOrg as any;

    createPersonalMock.mockResolvedValue({ data: { html_url: "personal-url", full_name: "user/my-repo", default_branch: "main" } });
    createOrgMock.mockResolvedValue({ data: { html_url: "org-url", full_name: "my-org/org-repo", default_branch: "main" } });

    const resPersonal = await createRepo(client, "my-repo", "private");
    expect(createPersonalMock).toHaveBeenCalledWith({ name: "my-repo", private: true });
    expect(resPersonal.url).toBe("personal-url");
    expect(resPersonal.fullName).toBe("user/my-repo");
    expect(resPersonal.defaultBranch).toBe("main");

    const resOrg = await createRepo(client, "org-repo", "public", "my-org");
    expect(createOrgMock).toHaveBeenCalledWith({ org: "my-org", name: "org-repo", private: false });
    expect(resOrg.url).toBe("org-url");
    expect(resOrg.fullName).toBe("my-org/org-repo");
    expect(resOrg.defaultBranch).toBe("main");
  });

  it("getRepoContent fetches and decodes base64 content", async () => {
    const getContentMock = client.getOctokit().repos.getContent as any;
    getContentMock.mockResolvedValue({
      data: {
        content: Buffer.from("hello world").toString("base64"),
        sha: "abcdef123",
      },
    });

    const res = await getRepoContent(client, "owner", "repo", "path/to/file", "main");
    expect(getContentMock).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      path: "path/to/file",
      ref: "main",
    });
    expect(res).toEqual({
      content: "hello world",
      sha: "abcdef123",
    });
  });

  it("getRepoContent throws if response data is an array", async () => {
    const getContentMock = client.getOctokit().repos.getContent as any;
    getContentMock.mockResolvedValue({
      data: [
        { name: "file1" },
      ],
    });

    await expect(getRepoContent(client, "owner", "repo", "path/to/dir")).rejects.toThrow("Path is a directory, not a file");
  });

  it("getRepoContent throws if content property is missing", async () => {
    const getContentMock = client.getOctokit().repos.getContent as any;
    getContentMock.mockResolvedValue({
      data: {
        sha: "some-sha",
      },
    });

    await expect(getRepoContent(client, "owner", "repo", "path/to/file")).rejects.toThrow("File content is missing or is of invalid type");
  });

  it("createInitialCommit makes initial commit for a file", async () => {
    const createOrUpdateFileMock = client.getOctokit().repos.createOrUpdateFileContents as any;
    createOrUpdateFileMock.mockResolvedValue({
      data: { commit: { sha: "commit-sha" } },
    });

    const res = await createInitialCommit(client, "owner", "repo", "openapi.yaml", "spec: 3.0.0");
    expect(createOrUpdateFileMock).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      path: "openapi.yaml",
      message: "Initial commit",
      content: Buffer.from("spec: 3.0.0").toString("base64"),
    });
    expect(res.commitSha).toBe("commit-sha");
  });
});
