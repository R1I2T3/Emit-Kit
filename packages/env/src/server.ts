import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const corsOriginSchema = z.string().refine((val) => {
  const origins = val.split(",").map((s) => s.trim());
  return origins.every((origin) => {
    const parsed = z.string().url().safeParse(origin);
    return parsed.success;
  });
}, "Must be a valid URL or a comma-separated list of valid URLs");

export const webhookBaseUrlSchema = z.string().url();

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    WEBHOOK_BASE_URL: webhookBaseUrlSchema,
    CORS_ORIGIN: corsOriginSchema,
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "Must be a 64-character hex string"),
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: process.env.NODE_ENV === "test" || !!process.env.VITEST,
});
