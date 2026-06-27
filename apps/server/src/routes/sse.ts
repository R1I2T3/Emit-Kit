import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { redis } from "../lib/redis";

const sseRouter = new Hono();

sseRouter.get("/runs/:runId/logs/stream", async (c) => {
  const runId = c.req.param("runId");

  return streamSSE(c, async (stream) => {
    const subscriber = redis.duplicate();
    await subscriber.subscribe(`run-logs:${runId}`);

    let isClosed = false;

    subscriber.on("message", (channel, message) => {
      if (channel === `run-logs:${runId}`) {
        stream.writeSSE({ data: message });
        if (message.includes("[DONE]")) {
          isClosed = true;
        }
      }
    });

    c.req.raw.signal.addEventListener("abort", () => {
      isClosed = true;
    });

    while (!isClosed) {
      await stream.sleep(100);
    }

    await subscriber.quit();
  });
});

export { sseRouter };
