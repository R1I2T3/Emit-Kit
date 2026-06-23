import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { GitHubClient } from "./client";
import { registerWebhook, verifyWebhookSignature, deleteWebhook } from "./webhook";

vi.mock("./client", () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => {
      const createWebhookMock = vi.fn();
      const deleteWebhookMock = vi.fn();
      return {
        getOctokit: () => ({
          repos: {
            createWebhook: createWebhookMock,
            deleteWebhook: deleteWebhookMock,
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

  it("should return false if signature is not sha256 formatted", () => {
    const payload = JSON.stringify({ event: "ping" });
    const secret = "test-secret";

    const verified = verifyWebhookSignature(payload, "invalid-sig", secret);
    expect(verified).toBe(false);
  });

  it("should return false if signature length is different", () => {
    const payload = JSON.stringify({ event: "ping" });
    const secret = "test-secret";

    const verified = verifyWebhookSignature(payload, "sha256=123", secret);
    expect(verified).toBe(false);
  });

  it("should handle invalid hex characters and not throw RangeError", () => {
    const payload = JSON.stringify({ event: "ping" });
    const secret = "test-secret";
    const invalidSignature = "sha256=" + "g".repeat(64);

    expect(() => {
      const verified = verifyWebhookSignature(payload, invalidSignature, secret);
      expect(verified).toBe(false);
    }).not.toThrow();
  });

  it("should successfully delete a webhook", async () => {
    const deleteWebhookMock = client.getOctokit().repos.deleteWebhook as any;
    deleteWebhookMock.mockResolvedValue({});

    await deleteWebhook(client, "owner", "repo", 12345);
    expect(deleteWebhookMock).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      hook_id: 12345,
    });
  });
});
