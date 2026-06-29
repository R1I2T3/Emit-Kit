import { getRepoContent, GitHubClient } from "@Emitkit/github";

export async function getSpec(project: any, githubClient: GitHubClient) {
  const [owner, repo] = project.repoFullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repository full name: ${project.repoFullName}`);
  }

  const { content, sha } = await getRepoContent(
    githubClient,
    owner,
    repo,
    project.specPath,
    project.defaultBranch
  );

  const format = project.specPath.endsWith(".json") ? "json" : "yaml";

  return { content, sha, format };
}

export async function saveSpec(
  project: any,
  content: string,
  expectedSha: string,
  githubClient: GitHubClient
) {
  const [owner, repo] = project.repoFullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repository full name: ${project.repoFullName}`);
  }

  try {
    const octokit = githubClient.getOctokit();
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: project.specPath,
      message: "docs: update openapi spec via Emitkit editor",
      content: Buffer.from(content).toString("base64"),
      sha: expectedSha,
      branch: project.defaultBranch,
    });

    return { commitSha: data.commit?.sha ?? "" };
  } catch (error: any) {
    if (error.status === 409) {
      throw new Error("CONFLICT");
    }
    throw error;
  }
}
