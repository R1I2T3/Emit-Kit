import { Octokit } from "@octokit/rest";
import { decrypt } from "@Emitkit/auth/crypto";

export class GitHubClient {
  private octokit: Octokit;

  constructor(encryptedToken: string) {
    const token = decrypt(encryptedToken);
    this.octokit = new Octokit({ auth: token });
  }

  getOctokit(): Octokit {
    return this.octokit;
  }

  async withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let currentAttempt = 0;
    while (currentAttempt < attempts) {
      try {
        return await fn();
      } catch (error: any) {
        currentAttempt++;
        if (error.status === 429 && currentAttempt < attempts) {
          const retryAfterHeader = error.response?.headers?.["retry-after"];
          let waitSeconds = 1;
          if (retryAfterHeader) {
            const parsed = parseInt(retryAfterHeader, 10);
            if (!isNaN(parsed)) {
              waitSeconds = parsed;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
          continue;
        }
        throw error;
      }
    }
    throw new Error("Retry attempts exhausted");
  }
}
