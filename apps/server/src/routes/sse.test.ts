import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../index";

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

const mockSubscriber = {
  subscribe: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../lib/redis", () => {
  return {
    redis: {
      duplicate: () => mockSubscriber,
    },
  };
});

describe("SSE logs stream route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should stream logs and close when [DONE] is received", async () => {
    let messageCallback: any = null;
    mockSubscriber.on.mockImplementation((event, cb) => {
      if (event === "message") {
        messageCallback = cb;
      }
    });

    const res = await app.request("/api/runs/123/logs/stream");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");

    // Wait a tick for subscription to setup
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockSubscriber.subscribe).toHaveBeenCalledWith("run-logs:123");
    expect(messageCallback).toBeTypeOf("function");

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const chunks: string[] = [];
    const decoder = new TextDecoder();
    const readPromise = (async () => {
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          chunks.push(decoder.decode(value));
        }
      }
    })();

    if (messageCallback) {
      // Trigger some messages
      messageCallback("run-logs:123", "log line 1");
      // Wait a tick for stream to process
      await new Promise((resolve) => setTimeout(resolve, 10));
      messageCallback("run-logs:123", "log line 2 [DONE]");
    }

    await readPromise;

    const output = chunks.join("");
    expect(output).toContain("data: log line 1\n\n");
    expect(output).toContain("data: log line 2 [DONE]\n\n");
    expect(mockSubscriber.quit).toHaveBeenCalled();
  });

  it("should quit subscriber when client aborts", async () => {
    const controller = new AbortController();
    const res = await app.request("/api/runs/456/logs/stream", {
      signal: controller.signal,
    });
    expect(res.status).toBe(200);

    // Wait a tick for subscriber setup
    await new Promise((resolve) => setTimeout(resolve, 10));

    controller.abort();

    // Wait a tick for abort handler
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockSubscriber.quit).toHaveBeenCalled();
  });
});
