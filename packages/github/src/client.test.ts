import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubClient } from "./client";
import { Octokit } from "@octokit/rest";

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

  it("should instantiate Octokit with token", () => {
    const client = new GitHubClient("raw-token-xyz");
    expect(Octokit).toHaveBeenCalledWith({
      auth: "raw-token-xyz",
      request: {
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      },
    });
    expect(client.getOctokit()).toBeDefined();
  });

  it("should retry on 429 rate limit error using retry-after header", async () => {
    const client = new GitHubClient("encrypted-token");

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
