# GitHub Package Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the core GitHub service modules inside the package `packages/github` (including `client.ts`, `repo.ts`, `webhook.ts`, `index.ts`), export them, write full unit tests with mocks, and ensure all tests pass.

**Architecture:** Create an object-oriented `GitHubClient` wrapping `@octokit/rest` that automatically handles decryption of the access token using `@Emitkit/auth/crypto` and implements an exponential backoff retry mechanism for rate-limiting. Separate the repository-related helper functions and webhook verification/registration helpers into distinct files.

**Tech Stack:** TypeScript, Bun, Vitest, `@octokit/rest` (v20+), `@Emitkit/auth/crypto`.

---

### Task 1: GitHub Client Implementation

**Files:**
- Create: `packages/github/src/client.ts`
- Test: `packages/github/src/client.test.ts`

- [ ] **Step 1: Write the failing test**
  Create a test for the `GitHubClient` constructor and the `withRetry` method. Since the files do not exist yet, import errors will occur. We will mock `@octokit/rest` and `@Emitkit/auth/crypto` in the test.
  Create `packages/github/src/client.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { GitHubClient } from "./client";
  import { decrypt } from "@Emitkit/auth/crypto";
  import { Octokit } from "@octokit/rest";

  vi.mock("@Emitkit/auth/crypto", () => ({
    decrypt: vi.fn((token: string) => `decrypted-${token}`),
  }));

  vi.mock("@octokit/rest", () => {
    const mockRequest = vi.fn();
    return {
      Octokit: vi.fn().mockImplementation(() => ({
        request: mockRequest,
      })),
    };
  });

  describe("GitHubClient", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should decrypt the token and instantiate Octokit", () => {
      const client = new GitHubClient("encrypted-token-xyz");
      expect(decrypt).toHaveBeenCalledWith("encrypted-token-xyz");
      expect(Octokit).toHaveBeenCalledWith({ auth: "decrypted-encrypted-token-xyz" });
      expect(client.getOctokit()).toBeDefined();
    });

    it("should retry on 429 rate limit error using retry-after header", async () => {
      const client = new GitHubClient("encrypted-token");
      const octokitInstance = client.getOctokit();

      let attempts = 0;
      const operation = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          const err = new Error("Rate limit exceeded") as any;
          err.status = 429;
          err.response = {
            headers: {
              "retry-after": "1", // 1 second
            },
          };
          throw err;
        }
        return "success";
      });

      const startTime = Date.now();
      const result = await client.withRetry(operation);
      const duration = Date.now() - startTime;

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
      expect(duration).toBeGreaterThanOrEqual(1000);
    });

    it("should fail after maximum retry attempts", async () => {
      const client = new GitHubClient("encrypted-token");
      const operation = vi.fn().mockImplementation(async () => {
        const err = new Error("Rate limit exceeded") as any;
        err.status = 429;
        err.response = { headers: { "retry-after": "0" } };
        throw err;
      });

      await expect(client.withRetry(operation, 2)).rejects.toThrow("Rate limit exceeded");
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**
  Expect compilation error or test failure (file not found/missing imports/types).

- [ ] **Step 3: Write minimal implementation**
  Create `packages/github/src/client.ts`:
  ```typescript
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
            const waitSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 1;
            await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
            continue;
          }
          throw error;
        }
      }
      throw new Error("Retry attempts exhausted");
    }
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Verify `client.test.ts` passes.

- [ ] **Step 5: Commit**
  Run git commit.

---

### Task 2: Repo Operations Implementation

**Files:**
- Create: `packages/github/src/repo.ts`
- Test: `packages/github/src/repo.test.ts`

- [ ] **Step 1: Write the failing test**
  Create unit tests mocking the Octokit behavior for `listUserRepos`, `createRepo`, `getRepoContent`, and `createInitialCommit`.
  Create `packages/github/src/repo.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { GitHubClient } from "./client";
  import { listUserRepos, createRepo, getRepoContent, createInitialCommit } from "./repo";

  vi.mock("./client", () => {
    return {
      GitHubClient: vi.fn().mockImplementation(() => {
        const mockRequest = vi.fn();
        return {
          getOctokit: () => ({
            request: mockRequest,
            repos: {
              listForAuthenticatedUser: vi.fn(),
              createForAuthenticatedUser: vi.fn(),
              createInOrg: vi.fn(),
              getContent: vi.fn(),
              createOrUpdateFileContents: vi.fn(),
            },
          }),
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

      createPersonalMock.mockResolvedValue({ data: { html_url: "personal-url" } });
      createOrgMock.mockResolvedValue({ data: { html_url: "org-url" } });

      const resPersonal = await createRepo(client, "my-repo", "private");
      expect(createPersonalMock).toHaveBeenCalledWith({ name: "my-repo", private: true });
      expect(resPersonal.url).toBe("personal-url");

      const resOrg = await createRepo(client, "org-repo", "public", "my-org");
      expect(createOrgMock).toHaveBeenCalledWith({ org: "my-org", name: "org-repo", private: false });
      expect(resOrg.url).toBe("org-url");
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
  ```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write minimal implementation**
  Create `packages/github/src/repo.ts`:
  ```typescript
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
          owner: repo.owner.login,
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

      if (!("content" in response.data) || !response.data.content) {
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
      return { commitSha: response.data.commit.sha };
    });
  }
  ```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

---

### Task 3: Webhook Registration and Verification Implementation

**Files:**
- Create: `packages/github/src/webhook.ts`
- Test: `packages/github/src/webhook.test.ts`

- [ ] **Step 1: Write the failing test**
  Create unit tests for webhook signature verification and webhook registration.
  Create `packages/github/src/webhook.test.ts`:
  ```typescript
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { createHmac } from "crypto";
  import { GitHubClient } from "./client";
  import { registerWebhook, verifyWebhookSignature } from "./webhook";

  vi.mock("./client", () => {
    return {
      GitHubClient: vi.fn().mockImplementation(() => {
        const createWebhookMock = vi.fn();
        return {
          getOctokit: () => ({
            repos: {
              createWebhook: createWebhookMock,
            },
          }),
          withRetry: (fn: any) => fn(),
        };
      }),
    };
  });

  describe("Webhook Registration & Verification", () => {
    let client: any;

    beforeEach(() => {
      vi.clearAllMocks();
      client = new GitHubClient("encrypted-token");
    });

    it("should successfully register a webhook for push and pull_request events", async () => {
      const createWebhookMock = client.getOctokit().repos.createWebhook as any;
      createWebhookMock.mockResolvedValue({
        data: { id: 12345, url: "webhook-url" },
      });

      const res = await registerWebhook(client, "owner", "repo", "https://example.com/webhook", "my-secret");
      expect(createWebhookMock).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        config: {
          url: "https://example.com/webhook",
          content_type: "json",
          secret: "my-secret",
        },
        events: ["push", "pull_request"],
        active: true,
      });
      expect(res.id).toBe(12345);
    });

    it("should verify webhook signature correctly", () => {
      const payload = JSON.stringify({ event: "ping" });
      const secret = "test-secret";
      const hmac = createHmac("sha256", secret);
      hmac.update(payload);
      const signature = `sha256=${hmac.digest("hex")}`;

      const verified = verifyWebhookSignature(payload, signature, secret);
      expect(verified).toBe(true);

      const invalidVerified = verifyWebhookSignature(payload, "sha256=invalid-signature", secret);
      expect(invalidVerified).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write minimal implementation**
  Create `packages/github/src/webhook.ts`:
  ```typescript
  import { createHmac, timingSafeEqual } from "crypto";
  import { GitHubClient } from "./client";

  export async function registerWebhook(
    client: GitHubClient,
    owner: string,
    repo: string,
    webhookUrl: string,
    secret: string
  ): Promise<{ id: number }> {
    return client.withRetry(async () => {
      const octokit = client.getOctokit();
      const response = await octokit.repos.createWebhook({
        owner,
        repo,
        config: {
          url: webhookUrl,
          content_type: "json",
          secret,
        },
        events: ["push", "pull_request"],
        active: true,
      });
      return { id: response.data.id };
    });
  }

  export function verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    if (!signature.startsWith("sha256=")) {
      return false;
    }
    const signatureHex = signature.slice(7);
    const hmac = createHmac("sha256", secret);
    hmac.update(payload);
    const expectedHex = hmac.digest("hex");

    if (signatureHex.length !== expectedHex.length) {
      return false;
    }

    return timingSafeEqual(
      Buffer.from(signatureHex, "hex"),
      Buffer.from(expectedHex, "hex")
    );
  }
  ```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

---

### Task 4: Export All Members and Build Verification

**Files:**
- Create: `packages/github/src/index.ts`

- [ ] **Step 1: Create index.ts**
  Create `packages/github/src/index.ts`:
  ```typescript
  export * from "./client";
  export * from "./repo";
  export * from "./webhook";
  ```

- [ ] **Step 2: Verification**
  Run the test suite for `@Emitkit/github` package and verify types compilation.
  Commands:
  ```bash
  bun run test --filter @Emitkit/github
  bun run check-types
  ```

- [ ] **Step 3: Commit**
