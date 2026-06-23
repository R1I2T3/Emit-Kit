# Spec: Decoupling Webhook Base URL and Supporting Comma-Separated CORS Origins

## 1. Background & Purpose
Currently, Emitkit constructs GitHub webhook registration URLs using the `BETTER_AUTH_URL` environment variable. When running in a local environment with a tunnel (such as Localtunnel or Ngrok), the webhook URL must be the public tunnel URL, whereas authentication is best left pointing to `localhost` to avoid breaking local developer OAuth flows. 

Additionally, we want the server to support multiple CORS origins so that requests can be accepted from both local development ports (e.g., `http://localhost:3001`) and tunneled frontends simultaneously.

---

## 2. Architecture & Design Changes

### A. Decouple Webhook URL
We will introduce `WEBHOOK_BASE_URL` as a new server-side environment variable.

1. **Environment Validation (`packages/env/src/server.ts`)**:
   Add `WEBHOOK_BASE_URL` to the server validation schema:
   ```typescript
   WEBHOOK_BASE_URL: z.string().url()
   ```

2. **Root and App `.env` Files**:
   Define `WEBHOOK_BASE_URL` with a fallback value:
   ```env
   WEBHOOK_BASE_URL=http://localhost:3000
   ```

3. **Project Registration (`packages/api/src/services/projects.ts`)**:
   Construct the GitHub repository webhook URL using `env.WEBHOOK_BASE_URL` instead of `env.BETTER_AUTH_URL`.
   ```typescript
   const webhookUrl = `${env.WEBHOOK_BASE_URL}/webhooks/github`;
   ```

### B. Comma-Separated CORS Origins
Allow `CORS_ORIGIN` to contain multiple domains, separated by commas.

1. **Environment Validation (`packages/env/src/server.ts`)**:
   Change `CORS_ORIGIN` validation from `z.url()` to a string validation that ensures all comma-separated segments are valid URLs:
   ```typescript
   CORS_ORIGIN: z.string().transform((val) => {
     const origins = val.split(",").map((s) => s.trim());
     for (const origin of origins) {
       z.string().url().parse(origin);
     }
     return val;
   })
   ```

2. **Hono Server CORS Configuration (`apps/server/src/index.ts`)**:
   Update Hono's `cors` middleware to parse and match the incoming origin against the comma-separated list:
   ```typescript
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
   })
   ```

---

## 3. Verification Plan

### Automated Tests
1. **Unit Tests**:
   - Verify `packages/env` successfully validates a single URL and a comma-separated list of URLs for `CORS_ORIGIN`.
   - Verify `packages/env` successfully validates `WEBHOOK_BASE_URL`.
   - Verify that webhook generation in `packages/api/src/services/projects.test.ts` uses the new environment variable value (instead of `BETTER_AUTH_URL`).

### Manual Verification
1. Set `WEBHOOK_BASE_URL=https://hip-dogs-try.loca.lt` in `.env`.
2. Set `CORS_ORIGIN=http://localhost:3001,https://hip-dogs-try.loca.lt` in `.env`.
3. Start the application servers and verify that environment validation passes.
