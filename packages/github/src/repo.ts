import { GitHubClient } from "./client";

export interface RepoInfo {
  id: number;
  name: string;
  owner: string;
  permissions?: {
    push: boolean;
    [key: string]: any;
  };
  url: string;
}

export async function listUserRepos(client: GitHubClient): Promise<RepoInfo[]> {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();
    const response = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
    });
    return response.data
      .filter((repo) => repo.permissions?.push)
      .map((repo) => ({
        id: repo.id,
        name: repo.name,
        owner: repo.owner?.login ?? "",
        permissions: repo.permissions,
        url: repo.html_url,
      }));
  });
}

export async function createRepo(
  client: GitHubClient,
  name: string,
  visibility: "public" | "private",
  orgLogin?: string
): Promise<{ url: string }> {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();
    const isPrivate = visibility === "private";
    let response;
    if (orgLogin) {
      response = await octokit.repos.createInOrg({
        org: orgLogin,
        name,
        private: isPrivate,
      });
    } else {
      response = await octokit.repos.createForAuthenticatedUser({
        name,
        private: isPrivate,
      });
    }
    return { url: response.data.html_url };
  });
}

export async function getRepoContent(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<{ content: string; sha: string }> {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if (Array.isArray(response.data)) {
      throw new Error("Path is a directory, not a file");
    }

    if (!("content" in response.data) || typeof response.data.content !== "string") {
      throw new Error("File content is missing or is of invalid type");
    }

    const content = Buffer.from(response.data.content, "base64").toString("utf8");
    return {
      content,
      sha: response.data.sha,
    };
  });
}

export async function createInitialCommit(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  content: string
): Promise<{ commitSha: string }> {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();
    const base64Content = Buffer.from(content).toString("base64");
    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: "Initial commit",
      content: base64Content,
    });
    return { commitSha: response.data.commit?.sha ?? "" };
  });
}
