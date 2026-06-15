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

## 4. Implemented Features & Scaffolding

### Phase 1 Frontend & Components
- **Select Component Wrapper**: Created a shared custom component in [`packages/ui/src/components/select.tsx`](./packages/ui/src/components/select.tsx) wrapping `@base-ui/react/select` to support accessible, premium dropdown menus.
- **Glassmorphic Login Page**: Designed a visually rich landing and authenticating flow at [`apps/web/src/routes/login.tsx`](./apps/web/src/routes/login.tsx) featuring ambient layered glows, a custom logo, security trust badges, and interactive GitHub OAuth triggers.
- **Organization Switcher**: Implemented a dynamic [`OrgSwitcher`](./apps/web/src/components/layout/org-switcher.tsx) component using the custom select wrapper that fetches user organizations via oRPC, renders initials-based avatar badges, and handles loading skeleton/error states gracefully.
- **Dashboard Sidebar Layout**: Refactored the core layout at [`apps/web/src/routes/_auth/route.tsx`](./apps/web/src/routes/_auth/route.tsx) to embed the Organization Switcher, profile metadata, and a Sign Out button inside a sleek, premium sidebar.
- **Premium Dashboard Workspace**: Redesigned the main dashboard at [`apps/web/src/routes/_auth/dashboard.tsx`](./apps/web/src/routes/_auth/dashboard.tsx) with statistic cards, active organization sync details, and a high-fidelity "No projects found" empty-state empty illustration with a call-to-action to create projects.

### Phase 1 Backend & Cryptography
- **Lazy AES-256-GCM Encryption**: Created a cryptography utility at [`packages/auth/src/crypto.ts`](./packages/auth/src/crypto.ts) that lazily derives its key from environment variables to allow test suites/dev server to import the module safely without immediate configuration.
- **GitHub Repository Synchronization**: Built a synchronization engine at [`packages/api/src/services/github-sync.ts`](./packages/api/src/services/github-sync.ts) to pull and link repository metadata for organizations.
- **oRPC Organization Router**: Developed endpoints at [`packages/api/src/routers/orgs.ts`](./packages/api/src/routers/orgs.ts) for listing, fetching, and creating organizations, optimized with `.limit(1)` constraints for single-row database queries.
- **Drizzle peer dependencies**: Aligned drizzle-orm dependencies across packages to version `^0.45.2` matching the Better-Auth peer requirements.

### Testing Infrastructure
- **Unit & Integration Testing**: Vitest setup configured across packages using a shared base configuration in [`packages/config/vitest.config.base.ts`](./packages/config/vitest.config.base.ts).
  - Loaded root `.env` safely in test runner, ignoring quotes and preserving CI overrides.
  - Implemented unit and integration tests for organization endpoints, cryptography functions, auth flow context, and repository sync services.
  - Configured `skipValidation` during test runs in [`packages/env/src/server.ts`](./packages/env/src/server.ts) to prevent environment validation crashes on load.
- **End-to-End Testing**: Playwright configured in [`apps/web/e2e`](./apps/web/e2e).
  - Implemented tests verifying Auth layout rendering, GitHub social redirection, and custom Select/OrgSwitcher interactions.
  - Configured to reuse the existing local web server (`reuseExistingServer: true`) to avoid port binding conflicts.
- **CI Workflow**: [`ci.yml`](./.github/workflows/ci.yml) is configured to set up Bun, spin up a local database, run vitest suites, launch the backend/frontend development servers, and run browser-based Playwright E2E tests.
