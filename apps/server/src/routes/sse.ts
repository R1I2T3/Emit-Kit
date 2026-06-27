import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { redis } from "../lib/redis";

const sseRouter = new Hono();

sseRouter.get("/runs/:runId/logs/stream", async (c) => {
  const runId = c.req.param("runId");

  return streamSSE(c, async (stream) => {
    const subscriber = redis.duplicate();
    try {
      await subscriber.subscribe(`run-logs:${runId}`);

      let resolveStream = () => {};
      const streamFinished = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });

      subscriber.on("message", async (channel, message) => {
        if (channel === `run-logs:${runId}`) {
          try {
            await stream.writeSSE({ data: message });
          } catch (err) {
            console.error("SSE stream write error:", err);
            resolveStream();
            return;
          }
          if (message.includes("[DONE]")) {
            resolveStream();
          }
        }
      });

      const abortHandler = () => {
        resolveStream();
      };
      c.req.raw.signal.addEventListener("abort", abortHandler);

      await streamFinished;
      c.req.raw.signal.removeEventListener("abort", abortHandler);
    } catch (err) {
      console.error("SSE stream processing error:", err);
    } finally {
      try {
        await subscriber.quit();
      } catch (err) {
        console.error("Failed to quit subscriber redis connection:", err);
      }
    }
  });
});

export { sseRouter };

