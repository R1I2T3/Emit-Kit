import { describe, it, expect } from "vitest";
import { corsOriginSchema, webhookBaseUrlSchema } from "./server";
import { z } from "zod";

describe("CORS_ORIGIN validation schema", () => {
  it("accepts a single valid URL", () => {
    expect(corsOriginSchema.safeParse("http://localhost:3001").success).toBe(true);
    expect(corsOriginSchema.safeParse("https://app.emitkit.com").success).toBe(true);
  });

  it("accepts multiple comma-separated URLs", () => {
    expect(corsOriginSchema.safeParse("http://localhost:3001,https://hip-dogs-try.loca.lt").success).toBe(true);
    expect(corsOriginSchema.safeParse("https://a.com, https://b.com, http://c.org:8080").success).toBe(true);
  });

  it("rejects invalid URLs in single or list format", () => {
    expect(corsOriginSchema.safeParse("not-a-url").success).toBe(false);
    expect(corsOriginSchema.safeParse("http://localhost:3001,not-a-url").success).toBe(false);
  });
});

describe("WEBHOOK_BASE_URL validation schema", () => {
  it("accepts valid webhook URLs", () => {
    expect(webhookBaseUrlSchema.safeParse("http://localhost:3000").success).toBe(true);
    expect(webhookBaseUrlSchema.safeParse("https://hip-dogs-try.loca.lt").success).toBe(true);
  });

  it("rejects invalid webhook URLs", () => {
    expect(webhookBaseUrlSchema.safeParse("not-a-url").success).toBe(false);
    expect(webhookBaseUrlSchema.safeParse("").success).toBe(false);
  });
});
