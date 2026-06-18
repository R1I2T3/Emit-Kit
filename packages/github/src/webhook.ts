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
