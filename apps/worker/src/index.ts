import pino from "pino";

const logger = pino({
  level: "info",
});

logger.info("Worker initialized successfully");

export { logger };
