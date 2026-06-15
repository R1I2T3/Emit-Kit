# Project Architecture & State Documentation

This document summarizes the current architecture, services, configurations, and implemented features of the **Emitkit** monorepo.

---

## 1. Monorepo Architecture Overview

Emitkit is structured as a monorepo managed with **Turborepo** and **Bun Workspaces**.

```
apps/
  ├── web/         (Vite Frontend - port 3001)
  └── server/      (Hono Backend - port 3000)
packages/
  ├── config/      (Shared configurations)
  ├── env/         (Type-safe environment variables validation)
  ├── db/          (Drizzle ORM configuration and database schemas)
  ├── api/         (Shared API definition and context)
  ├── auth/        (Better-Auth integration and utilities)
  └── ui/          (Shared UI components)
```

---

## 2. Ports and Network Map

| Service | Port | Base URL | Configuration Source |
| :--- | :--- | :--- | :--- |
| **Backend API (Hono/Bun)** | `3000` | `http://localhost:3000` | Default Bun Hono server port / env `BETTER_AUTH_URL` |
| **Frontend Web App (Vite)** | `3001` | `http://localhost:3001` | [vite.config.ts](./apps/web/vite.config.ts#L8) (`server.port`) |
| **Playwright Web Server target** | `3001` | `http://localhost:3001` | [playwright.config.ts](./apps/web/playwright.config.ts#L17) (`use.baseURL`, `webServer.url`) |

---

## 3. Environment Configurations

Environment variables are validated at runtime using `@t3-oss/env-core` and `zod` for type-safety.

### Backend (`apps/server/.env`)
- **`BETTER_AUTH_SECRET`**: Random secure key used by Better-Auth for signing cookies and tokens.
- **`BETTER_AUTH_URL`**: `http://localhost:3000` (URL of the auth server).
- **`CORS_ORIGIN`**: `http://localhost:3001` (frontend URL allowed to cross-origin resource share).
- **`DATABASE_URL`**: `file:../../local.db` (local SQLite database path).

### Frontend (`apps/web/.env`)
- **`VITE_SERVER_URL`**: `http://localhost:3000` (API endpoint where the backend serves OpenAPI/RPC and Auth routes).

---

## 4. Implemented Features & Scaffolding

### Core Backend & Routing
- **Hono Application**: Scaffolding in `apps/server/src/index.ts` with CORS and Hono Logger enabled.
- **oRPC Integration**: App routing schema defined in `packages/api` using oRPC. Standard OpenAPI endpoints and RPC handlers are fully wired into Hono.
- **Better-Auth Integration**: Auth endpoints (`/api/auth/*`) map to Better-Auth handler.

### Database (`packages/db`)
- **Drizzle ORM Integration**: Configured to interface with local SQLite database file (`local.db`).
- **Database Schema**:
  - `auth`: Users, Sessions, Accounts, and Verification tables (Better-Auth standard).
  - `organizations`: Organizations and organization membership tracking tables.

### Testing Infrastructure
- **Unit Testing**: Vitest setup configured across packages using a shared base configuration in [vitest.config.base.ts](./packages/config/vitest.config.base.ts).
  - Vitest configured to skip errors if no test files exist in a package (`passWithNoTests: true`).
  - Vitest base runner ignores Bun-specific sanity tests (`**/sanity.test.ts`) and Playwright tests (`**/e2e/**`).
  - Bun test runner ignores playwright e2e tests (`**/e2e/**` in `bunfig.toml` via `pathIgnorePatterns`) to prevent unhandled test fixture errors.
- **End-to-End Testing**: Playwright configured in `apps/web/e2e`.
  - ESM-safe `__dirname` dynamic calculations implemented.
  - Automatic recursive folder creation for user auth files storage (`.playwright/.auth/user.json`).
  - Port alignments pointing to port `3001`.
  - Configured to reuse the existing local web server (`reuseExistingServer: true`) to avoid port binding conflicts in CI environment.
- **CI Workflow**: `.github/workflows/ci.yml` is configured to automatically set up Bun, spin up the local database, run `bun test` for unit tests, start the dev server, and execute `bun test:e2e` for Playwright browser verification.
