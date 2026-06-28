import { GitHubClient } from "./client";

export async function createBranch(
  client: GitHubClient,
  owner: string,
  repo: string,
  branchName: string,
  baseSha: string
) {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();
    const cleanBranchName = branchName.replace(/^refs\/heads\//, "");
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${cleanBranchName}`,
      sha: baseSha,
    });
  });
}

export async function checkFileExists(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<boolean> {
  try {
    await client.withRetry(async () => {
      const octokit = client.getOctokit();
      await octokit.repos.getContent({ owner, repo, path, ref });
    });
    return true;
  } catch {
    return false;
  }
}

export async function createCommitWithFiles(
  client: GitHubClient,
  owner: string,
  repo: string,
  branchName: string,
  files: Array<{ path: string; content: string }>,
  message: string
) {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();
    const cleanBranchName = branchName.replace(/^refs\/heads\//, "");

    // Get current commit SHA
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${cleanBranchName}`,
    });
    const currentSha = refData.object.sha;

    // Get base tree
    const { data: commitData } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: currentSha,
    });
    const baseTreeSha = commitData.tree.sha;

    // Create blobs
    const blobs = await Promise.all(
      files.map(async (file) => {
        const { data } = await octokit.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString("base64"),
          encoding: "base64",
        });
        return { path: file.path, sha: data.sha };
      })
    );

    // Create tree
    const { data: treeData } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: blobs.map((blob) => ({
        path: blob.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      })),
    });

    // Create commit
    const { data: newCommitData } = await octokit.git.createCommit({
      owner,
      repo,
      message,
      tree: treeData.sha,
      parents: [currentSha],
    });

    // Update ref
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${cleanBranchName}`,
      sha: newCommitData.sha,
    });

    return newCommitData.sha;
  });
}

export async function createPullRequest(
  client: GitHubClient,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string
) {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();
    const { data } = await octokit.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    });
    return data.html_url;
  });
}

export async function createTag(
  client: GitHubClient,
  owner: string,
  repo: string,
  tagName: string,
  sha: string
) {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();
    const cleanTagName = tagName.replace(/^refs\/tags\//, "");
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/tags/${cleanTagName}`,
      sha,
    });
  });
}
