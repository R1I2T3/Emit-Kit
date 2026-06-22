# Decouple Webhook URL and Support Comma-Separated CORS Origins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple the GitHub webhook registration base URL from BETTER_AUTH_URL and support a comma-separated list of allowed origins in CORS configuration.

**Architecture:** We will introduce a new server-side environment variable `WEBHOOK_BASE_URL` and use it in the project services to build webhook endpoints. We will also update environment validation for `CORS_ORIGIN` to accept multiple comma-separated URLs and handle them via Hono's origin callback function.

**Tech Stack:** Zod, Hono CORS, Vitest, Bun

---

### Task 1: Environment Variable Configurations

**Files:**
- Modify: `.env`
- Modify: `apps/server/.env`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add new environment variables to the root `.env` file**
  Add `WEBHOOK_BASE_URL` to `.env`.
  ```env
  # Webhook registration base URL
  WEBHOOK_BASE_URL=http://localhost:3000
  ```

- [ ] **Step 2: Add new environment variables to `apps/server/.env`**
  Add `WEBHOOK_BASE_URL` to `apps/server/.env`.
  ```env
  # Webhook registration base URL
  WEBHOOK_BASE_URL=http://localhost:3000
  ```

- [ ] **Step 3: Update `.github/workflows/ci.yml` with the new environment variables**
  Under `unit-tests` steps (line 25 onwards) and `e2e-tests` (Start dev server, line 63 onwards), add `WEBHOOK_BASE_URL: http://localhost:3000`.

  For `unit-tests`:
  ```yaml
        env:
          DATABASE_URL: file:./test.db
          BETTER_AUTH_SECRET: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
          BETTER_AUTH_URL: http://localhost:3000
          WEBHOOK_BASE_URL: http://localhost:3000
          CORS_ORIGIN: http://localhost:3001
          ...
  ```
  For `e2e-tests` dev server:
  ```yaml
        env:
          NODE_ENV: test
          DATABASE_URL: file:./test.db
          BETTER_AUTH_SECRET: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
          BETTER_AUTH_URL: http://localhost:3000
          WEBHOOK_BASE_URL: http://localhost:3000
          CORS_ORIGIN: http://localhost:3001
          VITE_SERVER_URL: http://localhost:3000
  ```

- [ ] **Step 4: Commit configuration file updates**
  Run:
  ```bash
  git add .env apps/server/.env .github/workflows/ci.yml
  git commit -m "config: add WEBHOOK_BASE_URL and update environment files"
  ```

---

### Task 2: Validate Environment Schema

**Files:**
- Modify: `packages/env/src/server.ts`
- Create: `packages/env/src/server.test.ts`

- [ ] **Step 1: Update schema validations in `packages/env/src/server.ts`**
  Modify validation schema to include `WEBHOOK_BASE_URL` and allow a comma-separated list for `CORS_ORIGIN`.
  ```typescript
  import "dotenv/config";
  import { createEnv } from "@t3-oss/env-core";
  import { z } from "zod";

  export const env = createEnv({
    server: {
      DATABASE_URL: z.string().min(1),
      BETTER_AUTH_SECRET: z.string().min(32),
      BETTER_AUTH_URL: z.url(),
      WEBHOOK_BASE_URL: z.string().url(),
      CORS_ORIGIN: z.string().refine((val) => {
        const origins = val.split(",").map((s) => s.trim());
        return origins.every((origin) => {
          const parsed = z.string().url().safeParse(origin);
          return parsed.success;
        });
      }, "Must be a valid URL or a comma-separated list of valid URLs"),
      NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
      GITHUB_CLIENT_ID: z.string().min(1),
      GITHUB_CLIENT_SECRET: z.string().min(1),
      ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "Must be a 64-character hex string"),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
    skipValidation: process.env.NODE_ENV === "test" || !!process.env.VITEST,
  });
  ```

- [ ] **Step 2: Create unit tests for validation rules in `packages/env/src/server.test.ts`**
  Write tests verifying that `CORS_ORIGIN` splits and validates successfully.
  ```typescript
  import { describe, it, expect } from "vitest";
  import { z } from "zod";

  const corsOriginSchema = z.string().refine((val) => {
    const origins = val.split(",").map((s) => s.trim());
    return origins.every((origin) => {
      const parsed = z.string().url().safeParse(origin);
      return parsed.success;
    });
  }, "Must be a valid URL or a comma-separated list of valid URLs");

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
  ```

- [ ] **Step 3: Run Vitest to verify tests pass**
  Run: `bun run test packages/env`
  Expected: All unit tests in env package pass.

- [ ] **Step 4: Commit env validation updates**
  Run:
  ```bash
  git add packages/env/src/server.ts packages/env/src/server.test.ts
  git commit -m "feat: add schema validation for WEBHOOK_BASE_URL and support comma-separated CORS_ORIGIN"
  ```

---

### Task 3: Decouple Webhook Registration Service

**Files:**
- Modify: `packages/api/src/services/projects.ts`

- [ ] **Step 1: Replace BETTER_AUTH_URL with WEBHOOK_BASE_URL in project service**
  Update construction of the `webhookUrl` to use `env.WEBHOOK_BASE_URL`.
  
  In [createFromExistingRepo](file:///home/ritesh/workspace/Emit-Kit/packages/api/src/services/projects.ts#L42):
  ```typescript
    // 3. Register webhook on GitHub
    const webhookUrl = `${env.WEBHOOK_BASE_URL}/webhooks/github`;
  ```

  In [createNewRepo](file:///home/ritesh/workspace/Emit-Kit/packages/api/src/services/projects.ts#L106):
  ```typescript
    // 4. Generate webhook secret & register webhook
    const webhookSecret = randomUUID();
    const encryptedSecret = encrypt(webhookSecret);
    const webhookUrl = `${env.WEBHOOK_BASE_URL}/webhooks/github`;
  ```

- [ ] **Step 2: Run existing project tests to verify no regressions**
  Run: `bun run test packages/api/src/services/projects.test.ts`
  Expected: PASS

- [ ] **Step 3: Commit project service modifications**
  Run:
  ```bash
  git add packages/api/src/services/projects.ts
  git commit -m "feat: decouple webhook creation base URL using WEBHOOK_BASE_URL"
  ```

---

### Task 4: Implement Comma-Separated CORS Middleware

**Files:**
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Update Hono CORS middleware to dynamically match incoming origins**
  Modify Hono's `cors` setup to split `env.CORS_ORIGIN` and return the matching origin or fallback.
  ```typescript
  app.use(
    "/*",
    cors({
      origin: (origin) => {
        const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
        if (origin && allowedOrigins.includes(origin)) {
          return origin;
        }
        return allowedOrigins[0] || "";
      },
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );
  ```

- [ ] **Step 2: Add integration tests for multiple CORS origins**
  Verify that the server successfully responds with the appropriate Access-Control-Allow-Origin header depending on the input request's Origin header.
  We will add a test to the existing test files or create a basic route test. Let's see if we have server test suite. Let's run a test file or verify with `bun run dev` server endpoint.
  Run the test runner to verify:
  Run: `bun run test`
  Expected: PASS

- [ ] **Step 3: Commit CORS updates**
  Run:
  ```bash
  git add apps/server/src/index.ts
  git commit -m "feat: handle multiple CORS origins in Hono middleware"
  ```
