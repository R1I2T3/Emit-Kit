import { describe, it, expect } from "vitest";
import { corsOriginSchema } from "./server";

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
