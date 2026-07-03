import { getRepoContent, GitHubClient } from "@Emitkit/github";

export interface SpecProjectInput {
  repoFullName: string;
  specPath: string;
  defaultBranch: string;
}

function parseRepoFullName(repoFullName?: string): { owner: string; repo: string } {
  if (!repoFullName) {
    throw new Error("Missing project repository information");
  }
  const parts = repoFullName.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repository full name: ${repoFullName}`);
  }
  return { owner: parts[0], repo: parts[1] };
}

export async function getSpec(project: SpecProjectInput, githubClient: GitHubClient) {
  const { owner, repo } = parseRepoFullName(project?.repoFullName);

  const { content, sha } = await getRepoContent(
    githubClient,
    owner,
    repo,
    project.specPath,
    project.defaultBranch
  );

  const format = project.specPath.toLowerCase().endsWith(".json") ? "json" : "yaml";

  return { content, sha, format };
}

export async function saveSpec(
  project: SpecProjectInput,
  content: string,
  expectedSha: string,
  githubClient: GitHubClient
) {
  const { owner, repo } = parseRepoFullName(project?.repoFullName);

  try {
    const octokit = githubClient.getOctokit();
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: project.specPath,
      message: "docs: update openapi spec via Emitkit editor",
      content: Buffer.from(content).toString("base64"),
      sha: expectedSha || undefined,
      branch: project.defaultBranch,
    });

    return { commitSha: data.commit?.sha ?? "" };
  } catch (error: any) {
    if (error?.status === 409) {
      throw new Error("CONFLICT");
    }
    throw error;
  }
}
