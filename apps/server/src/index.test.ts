import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Redis to prevent real connection attempts in CI (no Redis server available).
// The SSE router imports redis on module load, which would hang without this mock.
vi.mock("./lib/redis", () => ({
  redis: {
    duplicate: () => ({
      subscribe: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Prevent real SQLite connections — the import chain pulls in @Emitkit/db and @Emitkit/auth
// at module-evaluation time, which call createDb() and fail in CI.
vi.mock("@Emitkit/db", () => ({
  db: {},
  createDb: () => ({}),
}));

vi.mock("@Emitkit/auth", () => ({
  createAuth: vi.fn(() => ({
    handler: vi.fn(),
    api: {
      getSession: vi.fn().mockResolvedValue({ user: null, session: null }),
    },
  })),
}));

describe("CORS Middleware", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("dynamically matches incoming origins from CORS_ORIGIN list", async () => {
    vi.stubEnv("CORS_ORIGIN", "https://example.com,https://test.com,http://localhost:3000");
    const { default: app } = await import("./index");

    // Test allowed origin 1
    const res1 = await app.request("/", {
      headers: {
        Origin: "https://example.com",
      },
    });
    expect(res1.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");

    // Test allowed origin 2
    const res2 = await app.request("/", {
      headers: {
        Origin: "https://test.com",
      },
    });
    expect(res2.headers.get("Access-Control-Allow-Origin")).toBe("https://test.com");

    // Test allowed origin 3
    const res3 = await app.request("/", {
      headers: {
        Origin: "http://localhost:3000",
      },
    });
    expect(res3.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");

    // Test disallowed origin - should return the first allowed origin as fallback
    const res4 = await app.request("/", {
      headers: {
        Origin: "https://disallowed.com",
      },
    });
    expect(res4.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
  });
});
