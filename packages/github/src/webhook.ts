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

  // Validate that the signature is a valid hexadecimal string
  if (!/^[0-9a-fA-F]+$/.test(signatureHex)) {
    return false;
  }

  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  const expectedBuffer = hmac.digest();
  
  const signatureBuffer = Buffer.from(signatureHex, "hex");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, expectedBuffer);
}
