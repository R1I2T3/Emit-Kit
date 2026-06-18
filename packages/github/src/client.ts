import { Octokit } from "@octokit/rest";

export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  getOctokit(): Octokit {
    return this.octokit;
  }

  async withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error: any) {
        if (error.status === 429 && i < attempts - 1) {
          const retryAfterHeader = error.response?.headers?.["retry-after"] || error.response?.headers?.["Retry-After"];
          const waitSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 1;
          const waitMs = isNaN(waitSeconds) ? 1000 : waitSeconds * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw error;
      }
    }
    throw new Error("Max retries exceeded");
  }
}
