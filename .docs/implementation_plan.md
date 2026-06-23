# Emitkit — Phase-wise Implementation Plan

> Comprehensive implementation plan with unit tests, integration tests, and E2E tests for each phase.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Requirements](#requirements)
3. [Background](#background)
4. [Proposed Solution](#proposed-solution)
5. [Phase 0: Testing Infrastructure & Project Setup](#phase-0-testing-infrastructure--project-setup)
6. [Phase 1: GitHub OAuth & Organization Management](#phase-1-github-oauth--organization-management)
7. [Phase 2: Project Management & Repository Connection](#phase-2-project-management--repository-connection)
8. [Phase 3: Project Configuration & Generation Trigger](#phase-3-project-configuration--generation-trigger)
9. [Phase 4: Worker Process & Core Generation Pipeline](#phase-4-worker-process--core-generation-pipeline)
10. [Phase 5: Generator Modules (SDK, CLI, MCP, Docs)](#phase-5-generator-modules-sdk-cli-mcp-docs)
11. [Phase 6: GitHub Integration (Commit & PR Creation)](#phase-6-github-integration-commit--pr-creation)
12. [Phase 7: Frontend Polish & Spec Editor](#phase-7-frontend-polish--spec-editor)
13. [Summary](#summary)

---

## Problem Statement

Transform the existing better-t-stack setup into a fully functional SDK generator platform that allows admins to connect GitHub repositories, configure OpenAPI spec sources, and automatically generate SDKs, CLIs, MCP servers, and documentation through a background job queue system.

---

## Requirements

Based on the project spec and existing codebase:

1. **Authentication**: Migrate from email/password to GitHub OAuth with organization support
2. **Data Model**: Extend database schema for organizations, projects, configs, runs, and versions
3. **Core Generation Pipeline**: Build worker process with BullMQ to process generation jobs
4. **Generator Modules**: Implement TypeScript SDK, Python SDK, CLI, MCP, and Docs generators
5. **GitHub Integration**: Repository management, webhook handling, PR creation, and spec fetching
6. **Frontend**: Build complete UI with project management, run monitoring, live logs, and spec editor
7. **Publishing**: Generate GitHub Actions workflows for npm/PyPI publishing
8. **Testing**: Comprehensive unit, integration, and E2E test coverage at each phase

---

## Background

### Current State

- ✅ Turborepo monorepo with Bun runtime
- ✅ Basic Better Auth setup (email/password)
- ✅ Hono + oRPC API structure
- ✅ React 19 + TanStack Router + Vite
- ✅ Drizzle ORM + SQLite
- ✅ Tailwind CSS v4 + shadcn/ui

### Gaps

- ❌ No GitHub OAuth
- ❌ No organization/project data model
- ❌ No BullMQ worker or Redis
- ❌ No generator modules
- ❌ No GitHub API integration
- ❌ No frontend pages (only boilerplate)

---

## Proposed Solution

Build in 7 phases, each delivering working, demoable functionality with full test coverage:

### Phase Structure

Each phase follows this pattern:

1. Extend data model (if needed)
2. Implement backend services/procedures
3. Build frontend components/pages
4. Write unit tests (Vitest)
5. Write integration tests (Vitest)
6. Write E2E tests (Playwright)
7. Demo the working feature

---

## Phase 0: Testing Infrastructure & Project Setup

### Objective

Set up testing infrastructure and prepare missing packages before feature development.

### Tasks

#### 1. Install and configure Vitest

- Add Vitest to root and all packages
- Create shared Vitest config in `packages/config/vitest.config.base.ts`
- Set up coverage reporting (v8)
- Configure test scripts in all package.json files

```json
// package.json (root)
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

#### 2. Install and configure Playwright

- Add Playwright to `apps/web`
- Create `apps/web/e2e` directory structure
- Configure `playwright.config.ts` with baseURL, projects (chromium, firefox)
- Set up test authentication state persistence

```ts
// apps/web/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
});
```

#### 3. Create missing packages

**Create `packages/queue`:**

```bash
mkdir -p packages/queue/src
```

```json
// packages/queue/package.json
{
  "name": "@Emitkit/queue",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.0"
  }
}
```

**Create `packages/github`:**

```bash
mkdir -p packages/github/src
```

```json
// packages/github/package.json
{
  "name": "@Emitkit/github",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@octokit/rest": "^20.0.0"
  }
}
```

**Create `packages/generators`:**

```bash
mkdir -p packages/generators/src
```

```json
// packages/generators/package.json
{
  "name": "@Emitkit/generators",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@hey-api/openapi-ts": "^0.45.0",
    "swagger-parser": "^10.0.0",
    "@google/generative-ai": "^0.21.0",
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

**Create `apps/worker`:**

```bash
mkdir -p apps/worker/src
```

```json
// apps/worker/package.json
{
  "name": "@Emitkit/worker",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts"
  },
  "dependencies": {
    "@Emitkit/db": "workspace:*",
    "@Emitkit/queue": "workspace:*",
    "@Emitkit/github": "workspace:*",
    "@Emitkit/generators": "workspace:*",
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.0",
    "pino": "^9.0.0"
  }
}
```

#### 4. Add required dependencies

```bash
# Root dependencies
bun add -d vitest @vitest/coverage-v8 @playwright/test

# Generator dependencies
bun add prettier ruff-api -D

# Server dependencies
cd apps/server
bun add ioredis bullmq pino

# Install all
bun install
```

#### 5. Set up shared test utilities

**Create `packages/testing`:**

```bash
mkdir -p packages/testing/src
```

```ts
// packages/testing/src/db.ts
import { createDb } from "@Emitkit/db";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

export function createTestDb() {
  const db = createDb(":memory:");
  migrate(db, { migrationsFolder: "./packages/db/src/migrations" });
  return db;
}

export async function seedUser(db: any, overrides = {}) {
  const user = {
    id: crypto.randomUUID(),
    name: "Test User",
    email: "test@example.com",
    githubId: "12345",
    ...overrides,
  };
  await db.insert(schema.user).values(user);
  return user;
}
```

```ts
// packages/testing/src/factories.ts
import { faker } from "@faker-js/faker";

export function createMockUser(overrides = {}) {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    githubId: faker.string.numeric(8),
    avatarUrl: faker.image.avatar(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function createMockOrg(overrides = {}) {
  return {
    id: faker.string.uuid(),
    githubOrgId: faker.string.numeric(8),
    name: faker.company.name(),
    slug: faker.lorem.slug(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}
```

### Unit Tests

**Test: Mock factories produce valid data**

```ts
// packages/testing/src/factories.test.ts
import { describe, it, expect } from "vitest";
import { createMockUser, createMockOrg } from "./factories";

describe("Mock Factories", () => {
  it("creates valid user mock", () => {
    const user = createMockUser();
    expect(user).toHaveProperty("id");
    expect(user).toHaveProperty("email");
    expect(user).toHaveProperty("githubId");
  });

  it("creates user with overrides", () => {
    const user = createMockUser({ name: "Custom Name" });
    expect(user.name).toBe("Custom Name");
  });

  it("creates valid org mock", () => {
    const org = createMockOrg();
    expect(org).toHaveProperty("id");
    expect(org).toHaveProperty("slug");
  });
});
```

**Test: Database helpers work**

```ts
// packages/testing/src/db.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb, seedUser } from "./db";

describe("Test Database Helpers", () => {
  it("creates in-memory database", () => {
    const db = createTestDb();
    expect(db).toBeDefined();
  });

  it("seeds user successfully", async () => {
    const db = createTestDb();
    const user = await seedUser(db);
    expect(user.id).toBeDefined();
  });
});
```

### Integration Tests

N/A (infrastructure phase)

### E2E Tests

**Smoke test: Playwright can load the app**

```ts
// apps/web/e2e/smoke.test.ts
import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Emitkit/);
});
```

### Demo

- Run `bun test` across all packages successfully
- Run `bun test:e2e` and see Playwright launch browser
- Show test coverage report generation

```bash
# Terminal output:
$ bun test
✓ packages/testing/src/factories.test.ts (3)
✓ packages/testing/src/db.test.ts (2)

Test Files  2 passed (2)
Tests  5 passed (5)

$ bun test:coverage
File                | % Stmts | % Branch | % Funcs | % Lines
packages/testing    |   100   |   100    |   100   |   100

$ bun test:e2e
Running 1 test using 1 worker
✓ [chromium] smoke.test.ts:3:1 › homepage loads (1.2s)
```

---

## Phase 1: GitHub OAuth & Organization Management

### Objective

Replace email/password auth with GitHub OAuth and implement organization/member management.

### Data Model Changes

#### 1. Extend user table

```ts
// packages/db/src/schema/auth.ts - modify user table
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  githubId: text("github_id").unique().notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});
```

#### 2. Create organizations table

```ts
// packages/db/src/schema/organizations.ts
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  githubOrgId: text("github_org_id").unique().notNull(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});
```

#### 3. Create organization_members table

```ts
// packages/db/src/schema/organizations.ts (continued)
export const organizationMembers = sqliteTable(
  "organization_members",
  {
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] })
      .notNull()
      .default("member"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.orgId, table.userId] }),
  }),
);
```

### Backend Implementation

#### 1. Update Better Auth config

```ts
// packages/auth/src/index.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "@Emitkit/db";
import * as schema from "@Emitkit/db/schema/auth";
import { env } from "@Emitkit/env/server";

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN],
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        scope: ["repo", "read:org", "workflow"],
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    plugins: [],
  });
}

export const auth = createAuth();
```

#### 2. Create encryption utility

```ts
// packages/auth/src/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "@Emitkit/env/server";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(env.ENCRYPTION_KEY, "hex");

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

#### 3. GitHub OAuth sync service

```ts
// packages/api/src/services/github-sync.ts
import { Octokit } from "@octokit/rest";
import { eq } from "drizzle-orm";
import { db } from "@Emitkit/db";
import {
  organizations,
  organizationMembers,
} from "@Emitkit/db/schema/organizations";
import { encrypt } from "@Emitkit/auth/crypto";

export async function syncGitHubOrgsForUser(
  userId: string,
  accessToken: string,
) {
  const octokit = new Octokit({ auth: accessToken });

  // Fetch user's organizations from GitHub
  const { data: orgs } = await octokit.orgs.listForAuthenticatedUser();

  for (const org of orgs) {
    // Upsert organization
    const [existingOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.githubOrgId, String(org.id)));

    let orgId: string;

    if (existingOrg) {
      orgId = existingOrg.id;
    } else {
      const newOrg = {
        id: crypto.randomUUID(),
        githubOrgId: String(org.id),
        name: org.login,
        slug: org.login.toLowerCase(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.insert(organizations).values(newOrg);
      orgId = newOrg.id;
    }

    // Insert organization membership
    await db
      .insert(organizationMembers)
      .values({
        orgId,
        userId,
        role: org.role === "admin" ? "owner" : "member",
        createdAt: Date.now(),
      })
      .onConflictDoNothing();
  }

  // Store encrypted access token
  const encryptedToken = encrypt(accessToken);
  return encryptedToken;
}
```

#### 4. Create oRPC procedures

```ts
// packages/api/src/routers/orgs.ts
import { z } from "zod";
import { router, protectedProcedure } from "../context";
import {
  organizations,
  organizationMembers,
} from "@Emitkit/db/schema/organizations";
import { eq } from "drizzle-orm";

export const orgsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgs = await ctx.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        githubOrgId: organizations.githubOrgId,
      })
      .from(organizations)
      .innerJoin(
        organizationMembers,
        eq(organizations.id, organizationMembers.orgId),
      )
      .where(eq(organizationMembers.userId, ctx.user.id));

    return orgs;
  }),

  get: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify user is member
      const membership = await ctx.db
        .select()
        .from(organizationMembers)
        .where(
          eq(organizationMembers.orgId, input.orgId),
          eq(organizationMembers.userId, ctx.user.id),
        )
        .limit(1);

      if (!membership.length) {
        throw new Error("FORBIDDEN");
      }

      const [org] = await ctx.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.orgId));

      // Get member count
      const memberCount = await ctx.db
        .select({ count: sql`count(*)` })
        .from(organizationMembers)
        .where(eq(organizationMembers.orgId, input.orgId));

      return { ...org, memberCount: memberCount[0].count };
    }),
});
```

#### 5. Update context

```ts
// packages/api/src/context.ts
import { auth } from "@Emitkit/auth";
import { createDb } from "@Emitkit/db";

export async function createContext({ req }: { req: Request }) {
  const session = await auth.api.getSession({ headers: req.headers });

  return {
    db: createDb(),
    user: session?.user,
    session,
  };
}

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new Error("UNAUTHORIZED");
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
```

### Frontend Implementation

#### 1. Update login page

```tsx
// apps/web/src/pages/login.tsx
import { signIn } from "@Emitkit/auth/client";
import { Button } from "@Emitkit/ui/components/button";

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 rounded-lg border p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Emitkit</h1>
          <p className="mt-2 text-muted-foreground">SDK Generator Platform</p>
        </div>

        <Button
          className="w-full"
          onClick={() => signIn.social({ provider: "github" })}
        >
          Sign in with GitHub
        </Button>
      </div>
    </div>
  );
}
```

#### 2. Create org switcher component

```tsx
// apps/web/src/components/layout/org-switcher.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpcClient } from "@/lib/orpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@Emitkit/ui/components/select";

export function OrgSwitcher() {
  const { data: orgs } = useQuery({
    queryKey: ["orgs"],
    queryFn: () => orpcClient.orgs.list(),
  });

  const [selectedOrgId, setSelectedOrgId] = useState<string>();

  return (
    <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select organization" />
      </SelectTrigger>
      <SelectContent>
        {orgs?.map((org) => (
          <SelectItem key={org.id} value={org.id}>
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

#### 3. Create dashboard layout

```tsx
// apps/web/src/components/layout/dashboard-layout.tsx
import { Outlet } from "@tanstack/react-router";
import { OrgSwitcher } from "./org-switcher";
import { UserMenu } from "./user-menu";

export function DashboardLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-r bg-muted/40 p-4">
        <div className="mb-6">
          <h2 className="text-lg font-bold">Emitkit</h2>
        </div>

        <OrgSwitcher />
      </aside>

      <main className="flex-1">
        <header className="border-b px-6 py-4 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">Dashboard</div>
          <UserMenu />
        </header>

        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
```

#### 4. Create dashboard page

```tsx
// apps/web/src/pages/dashboard.tsx
import { useQuery } from "@tanstack/react-query";
import { orpcClient } from "@/lib/orpc";

export function DashboardPage() {
  const selectedOrgId = ""; // TODO: Get from state/URL

  const { data: org } = useQuery({
    queryKey: ["org", selectedOrgId],
    queryFn: () => orpcClient.orgs.get({ orgId: selectedOrgId }),
    enabled: !!selectedOrgId,
  });

  return (
    <div>
      <h1 className="text-3xl font-bold">{org?.name}</h1>
      <p className="text-muted-foreground mt-2">{org?.memberCount} members</p>

      {/* Placeholder for project list */}
      <div className="mt-8">
        <p className="text-muted-foreground">Projects will appear here.</p>
      </div>
    </div>
  );
}
```

### Unit Tests

#### Test: Crypto utility

```ts
// packages/auth/src/crypto.test.ts
import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./crypto";

describe("Encryption Utility", () => {
  it("encrypts and decrypts text correctly", () => {
    const plaintext = "secret-token-12345";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
    expect(encrypted).not.toBe(plaintext);
  });

  it("produces different ciphertext for same input", () => {
    const plaintext = "same-text";
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);

    expect(encrypted1).not.toBe(encrypted2);
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
  });

  it("throws on decrypt with wrong key", () => {
    const encrypted = encrypt("test");
    const tampered = encrypted.replace(/.$/, "0");

    expect(() => decrypt(tampered)).toThrow();
  });
});
```

#### Test: GitHub sync service

```ts
// packages/api/src/services/github-sync.test.ts
import { describe, it, expect, vi } from "vitest";
import { syncGitHubOrgsForUser } from "./github-sync";
import { Octokit } from "@octokit/rest";

vi.mock("@octokit/rest");

describe("GitHub Sync Service", () => {
  it("creates orgs and memberships", async () => {
    const mockOctokit = {
      orgs: {
        listForAuthenticatedUser: vi.fn().mockResolvedValue({
          data: [
            { id: 123, login: "acme-corp", role: "admin" },
            { id: 456, login: "test-org", role: "member" },
          ],
        }),
      },
    };

    vi.mocked(Octokit).mockImplementation(() => mockOctokit as any);

    const userId = "user-1";
    const token = "ghp_test";

    await syncGitHubOrgsForUser(userId, token);

    // Verify orgs created and user added as member
    // (assertions depend on your test DB setup)
  });

  it("encrypts access token", async () => {
    // Mock Octokit
    const encryptedToken = await syncGitHubOrgsForUser("user-1", "token");

    expect(encryptedToken).toContain(":");
    expect(encryptedToken).not.toBe("token");
  });
});
```

#### Test: oRPC procedures

```ts
// packages/api/src/routers/orgs.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb, seedUser } from "@Emitkit/testing";
import { orgsRouter } from "./orgs";

describe("Orgs Router", () => {
  it("lists user's organizations", async () => {
    const db = createTestDb();
    const user = await seedUser(db);

    // Seed org + membership
    const org = {
      id: "org-1",
      githubOrgId: "123",
      name: "Test Org",
      slug: "test-org",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.insert(organizations).values(org);
    await db.insert(organizationMembers).values({
      orgId: org.id,
      userId: user.id,
      role: "member",
      createdAt: Date.now(),
    });

    const ctx = { db, user, session: {} };
    const result = await orgsRouter.list({ ctx });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test Org");
  });

  it("throws 401 if not authenticated", async () => {
    const db = createTestDb();
    const ctx = { db, user: null, session: null };

    await expect(orgsRouter.list({ ctx })).rejects.toThrow("UNAUTHORIZED");
  });

  it("get() requires org membership", async () => {
    const db = createTestDb();
    const user = await seedUser(db);
    const ctx = { db, user, session: {} };

    // Seed org without membership
    const org = {
      id: "org-1",
      githubOrgId: "123",
      name: "Other Org",
      slug: "other",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.insert(organizations).values(org);

    await expect(
      orgsRouter.get({ ctx, input: { orgId: "org-1" } }),
    ).rejects.toThrow("FORBIDDEN");
  });
});
```

### Integration Tests

#### Test: Auth flow

```ts
// packages/api/src/integration/auth-flow.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "@Emitkit/testing";
import { syncGitHubOrgsForUser } from "../services/github-sync";

describe("GitHub OAuth Integration", () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  it("creates user, orgs, and memberships on OAuth callback", async () => {
    // Mock GitHub OAuth callback
    const userId = "new-user";
    const accessToken = "ghp_mock_token";

    // Sync should create org records
    await syncGitHubOrgsForUser(userId, accessToken);

    // Verify organizations created
    const orgs = await db.select().from(organizations);
    expect(orgs.length).toBeGreaterThan(0);

    // Verify memberships created
    const memberships = await db.select().from(organizationMembers);
    expect(memberships.length).toBeGreaterThan(0);
  });

  it("stores access token encrypted", async () => {
    const userId = "user-1";
    const plainToken = "ghp_secret";

    const encrypted = await syncGitHubOrgsForUser(userId, plainToken);

    expect(encrypted).not.toBe(plainToken);
    expect(encrypted.split(":")).toHaveLength(3); // IV:authTag:ciphertext
  });
});
```

#### Test: Org list endpoint

```ts
// packages/api/src/integration/orgs-endpoint.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb, seedUser } from "@Emitkit/testing";
import { orgsRouter } from "../routers/orgs";

describe("Orgs Endpoint Integration", () => {
  it("returns user's organizations", async () => {
    const db = createTestDb();
    const user = await seedUser(db);

    // Seed 2 orgs
    const org1 = {
      id: "org-1",
      githubOrgId: "1",
      name: "Org 1",
      slug: "org-1",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const org2 = {
      id: "org-2",
      githubOrgId: "2",
      name: "Org 2",
      slug: "org-2",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.insert(organizations).values([org1, org2]);
    await db.insert(organizationMembers).values([
      { orgId: org1.id, userId: user.id, role: "owner", createdAt: Date.now() },
      {
        orgId: org2.id,
        userId: user.id,
        role: "member",
        createdAt: Date.now(),
      },
    ]);

    const ctx = { db, user, session: {} };
    const result = await orgsRouter.list({ ctx });

    expect(result).toHaveLength(2);
    expect(result.map((o) => o.name)).toEqual(["Org 1", "Org 2"]);
  });
});
```

### E2E Tests

#### Test: GitHub OAuth flow

```ts
// apps/web/e2e/auth.test.ts
import { test, expect } from "@playwright/test";

test.describe("GitHub OAuth", () => {
  test("sign in with GitHub", async ({ page, context }) => {
    // Intercept GitHub OAuth redirect
    await context.route("https://github.com/login/oauth/**", (route) => {
      route.fulfill({
        status: 302,
        headers: {
          Location: "http://localhost:5173/auth/callback?code=mock_code",
        },
      });
    });

    // Intercept OAuth callback
    await page.route("**/api/auth/callback/github**", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/login");
    await page.click('button:has-text("Sign in with GitHub")');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("shows organizations in sidebar", async ({ page }) => {
    // Mock session with orgs
    await page.route("**/api/orgs/list", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([
          { id: "org-1", name: "Test Org", slug: "test-org" },
          { id: "org-2", name: "Demo Corp", slug: "demo-corp" },
        ]),
      });
    });

    await page.goto("/dashboard");

    await expect(page.locator("text=Test Org")).toBeVisible();
    await expect(page.locator("text=Demo Corp")).toBeVisible();
  });
});
```

#### Test: Org switcher

```ts
// apps/web/e2e/org-switcher.test.ts
import { test, expect } from "@playwright/test";

test("switch between organizations", async ({ page }) => {
  await page.goto("/dashboard");

  // Open org switcher
  await page.click('[role="combobox"]');

  // Select different org
  await page.click("text=Demo Corp");

  // Verify dashboard updates
  await expect(page.locator("h1")).toContainText("Demo Corp");
});
```

### Demo

**Demo Script:**

1. Start development server: `bun run dev`
2. Navigate to `http://localhost:5173/login`
3. Click "Sign in with GitHub" (use test GitHub OAuth app)
4. After authentication, redirected to `/dashboard`
5. See organization switcher in sidebar with your GitHub orgs
6. Select different organization
7. Dashboard updates to show selected org name and member count
8. Click user menu → "Sign out"
9. Redirected back to login page

**Expected Outcomes:**

- ✅ GitHub OAuth flow completes successfully
- ✅ User's organizations fetched and displayed
- ✅ Can switch between organizations
- ✅ Sign out works correctly
- ✅ Access tokens stored encrypted in database

---

## Phase 2: Project Management & Repository Connection

### Objective

Allow admins to create projects by connecting existing repos or creating new ones, configure spec paths, and manage projects.

### Data Model Changes

#### Create projects table

```ts
// packages/db/src/schema/projects.ts
export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    repoFullName: text("repo_full_name").notNull(), // e.g. 'acme/api'
    specPath: text("spec_path").notNull(), // e.g. 'openapi.yaml'
    defaultBranch: text("default_branch").notNull().default("main"),
    outputMode: text("output_mode", { enum: ["append", "separate"] })
      .notNull()
      .default("append"),
    outputRepoFullName: text("output_repo_full_name"), // if outputMode='separate'
    webhookId: integer("webhook_id"),
    webhookSecret: text("webhook_secret"), // encrypted
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    uniqueOrgRepo: unique().on(table.orgId, table.repoFullName),
  }),
);
```

### Backend Implementation

#### 1. GitHub client wrapper

```ts
// packages/github/src/client.ts
import { Octokit } from "@octokit/rest";
import { decrypt } from "@Emitkit/auth/crypto";

export class GitHubClient {
  private octokit: Octokit;

  constructor(encryptedToken: string) {
    const token = decrypt(encryptedToken);
    this.octokit = new Octokit({ auth: token });
  }

  async withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error: any) {
        if (error.status === 429 && i < attempts - 1) {
          const retryAfter = error.response?.headers?.["retry-after"] || 60;
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000),
          );
          continue;
        }
        throw error;
      }
    }
    throw new Error("Max retries exceeded");
  }

  getOctokit() {
    return this.octokit;
  }
}
```

#### 2. GitHub repo service

```ts
// packages/github/src/repo.ts
import { GitHubClient } from "./client";

export async function listUserRepos(client: GitHubClient) {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();
    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 100,
      affiliation: "owner,collaborator",
    });

    return data
      .filter((repo) => repo.permissions?.push)
      .map((repo) => ({
        fullName: repo.full_name,
        name: repo.name,
        private: repo.private,
        defaultBranch: repo.default_branch,
      }));
  });
}

export async function createRepo(
  client: GitHubClient,
  name: string,
  visibility: "public" | "private",
  orgLogin?: string,
) {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();

    const { data } = orgLogin
      ? await octokit.repos.createInOrg({
          org: orgLogin,
          name,
          private: visibility === "private",
          auto_init: false,
        })
      : await octokit.repos.createForAuthenticatedUser({
          name,
          private: visibility === "private",
          auto_init: false,
        });

    return {
      fullName: data.full_name,
      defaultBranch: data.default_branch || "main",
    };
  });
}

export async function getRepoContent(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  ref?: string,
) {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();

    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if (Array.isArray(data) || data.type !== "file") {
      throw new Error("Path is not a file");
    }

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    return { content, sha: data.sha };
  });
}

export async function createInitialCommit(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  content: string,
) {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: "chore: initialize OpenAPI spec",
      content: Buffer.from(content).toString("base64"),
    });
  });
}
```

#### 3. GitHub webhook service

```ts
// packages/github/src/webhook.ts
import { createHmac } from "crypto";
import { GitHubClient } from "./client";

export async function registerWebhook(
  client: GitHubClient,
  owner: string,
  repo: string,
  webhookUrl: string,
  secret: string,
) {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();

    const { data } = await octokit.repos.createWebhook({
      owner,
      repo,
      config: {
        url: webhookUrl,
        content_type: "json",
        secret,
        insecure_ssl: "0",
      },
      events: ["push", "pull_request"],
      active: true,
    });

    return data.id;
  });
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  const digest = `sha256=${hmac.digest("hex")}`;

  return digest === signature;
}
```

#### 4. Project service

```ts
// packages/api/src/services/projects.ts
import { db } from "@Emitkit/db";
import { projects } from "@Emitkit/db/schema/projects";
import { GitHubClient } from "@Emitkit/github/client";
import * as repoService from "@Emitkit/github/repo";
import * as webhookService from "@Emitkit/github/webhook";
import { encrypt } from "@Emitkit/auth/crypto";
import { env } from "@Emitkit/env/server";

export async function createFromExistingRepo(
  orgId: string,
  repoFullName: string,
  specPath: string,
  defaultBranch: string,
  githubClient: GitHubClient,
) {
  const [owner, repo] = repoFullName.split("/");

  // Validate spec exists
  await repoService.getRepoContent(
    githubClient,
    owner,
    repo,
    specPath,
    defaultBranch,
  );

  // Create webhook secret
  const webhookSecret = crypto.randomUUID();
  const webhookUrl = `${env.EMITKIT_BASE_URL}/webhooks/github`;

  const webhookId = await webhookService.registerWebhook(
    githubClient,
    owner,
    repo,
    webhookUrl,
    webhookSecret,
  );

  const project = {
    id: crypto.randomUUID(),
    orgId,
    repoFullName,
    specPath,
    defaultBranch,
    outputMode: "append" as const,
    webhookId,
    webhookSecret: encrypt(webhookSecret),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.insert(projects).values(project);
  return project;
}

export async function createNewRepo(
  orgId: string,
  repoName: string,
  visibility: "public" | "private",
  orgLogin: string | undefined,
  githubClient: GitHubClient,
) {
  // Create repo on GitHub
  const { fullName, defaultBranch } = await repoService.createRepo(
    githubClient,
    repoName,
    visibility,
    orgLogin,
  );

  // Create initial spec file
  const starterSpec = `openapi: 3.1.0
info:
  title: ${repoName} API
  version: 0.1.0
paths: {}
`;

  const [owner, repo] = fullName.split("/");
  await repoService.createInitialCommit(
    githubClient,
    owner,
    repo,
    "openapi.yaml",
    starterSpec,
  );

  // Register webhook
  const webhookSecret = crypto.randomUUID();
  const webhookUrl = `${env.EMITKIT_BASE_URL}/webhooks/github`;

  const webhookId = await webhookService.registerWebhook(
    githubClient,
    owner,
    repo,
    webhookUrl,
    webhookSecret,
  );

  const project = {
    id: crypto.randomUUID(),
    orgId,
    repoFullName: fullName,
    specPath: "openapi.yaml",
    defaultBranch,
    outputMode: "append" as const,
    webhookId,
    webhookSecret: encrypt(webhookSecret),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.insert(projects).values(project);
  return project;
}

export async function deleteProject(projectId: string) {
  await db.delete(projects).where(eq(projects.id, projectId));
}
```

#### 5. oRPC procedures

```ts
// packages/api/src/routers/projects.ts
import { z } from "zod";
import { router, protectedProcedure } from "../context";
import * as projectService from "../services/projects";
import { GitHubClient } from "@Emitkit/github/client";

export const projectsRouter = router({
  list: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify org membership
      await verifyOrgMembership(ctx.user.id, input.orgId);

      return ctx.db
        .select()
        .from(projects)
        .where(eq(projects.orgId, input.orgId));
    }),

  get: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId));

      if (!project) throw new Error("NOT_FOUND");

      await verifyOrgMembership(ctx.user.id, project.orgId);

      return project;
    }),

  createFromExistingRepo: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        repoFullName: z.string(),
        specPath: z.string(),
        defaultBranch: z.string().default("main"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyOrgMembership(ctx.user.id, input.orgId);

      const githubClient = await getGitHubClientForUser(ctx.user.id);

      return projectService.createFromExistingRepo(
        input.orgId,
        input.repoFullName,
        input.specPath,
        input.defaultBranch,
        githubClient,
      );
    }),

  createNewRepo: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        repoName: z.string(),
        visibility: z.enum(["public", "private"]),
        orgLogin: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifyOrgMembership(ctx.user.id, input.orgId);

      const githubClient = await getGitHubClientForUser(ctx.user.id);

      return projectService.createNewRepo(
        input.orgId,
        input.repoName,
        input.visibility,
        input.orgLogin,
        githubClient,
      );
    }),

  delete: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId));

      if (!project) throw new Error("NOT_FOUND");

      await verifyOrgMembership(ctx.user.id, project.orgId);

      await projectService.deleteProject(input.projectId);
    }),
});
```

### Frontend Implementation

#### 1. Update dashboard with project list

```tsx
// apps/web/src/pages/dashboard.tsx
import { useQuery } from "@tanstack/react-query";
import { orpcClient } from "@/lib/orpc";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@Emitkit/ui/components/button";
import { Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function DashboardPage() {
  const selectedOrgId = ""; // TODO: Get from state

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects", selectedOrgId],
    queryFn: () => orpcClient.projects.list({ orgId: selectedOrgId }),
    enabled: !!selectedOrgId,
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Projects</h1>
        <Link to="/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects?.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">
              No projects yet. Create your first project.
            </p>
          </div>
        ) : (
          projects?.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))
        )}
      </div>
    </div>
  );
}
```

#### 2. Project card component

```tsx
// apps/web/src/components/projects/project-card.tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@Emitkit/ui/components/card";
import { Badge } from "@Emitkit/ui/components/badge";
import { Link } from "@tanstack/react-router";

interface ProjectCardProps {
  project: {
    id: string;
    repoFullName: string;
    specPath: string;
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link to={`/projects/${project.id}`}>
      <Card className="hover:border-primary transition-colors cursor-pointer">
        <CardHeader>
          <CardTitle>{project.repoFullName}</CardTitle>
          <CardDescription>Spec: {project.specPath}</CardDescription>
          <Badge variant="outline" className="w-fit mt-2">
            Active
          </Badge>
        </CardHeader>
      </Card>
    </Link>
  );
}
```

#### 3. Project creation wizard

```tsx
// apps/web/src/pages/project-new.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { orpcClient } from "@/lib/orpc";
import { Button } from "@Emitkit/ui/components/button";
import { RadioGroup, RadioGroupItem } from "@Emitkit/ui/components/radio-group";
import { Input } from "@Emitkit/ui/components/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@Emitkit/ui/components/form";
import { RepoPicker } from "@/components/projects/repo-picker";
import { useRouter } from "@tanstack/react-router";

const existingRepoSchema = z.object({
  mode: z.literal("existing"),
  repoFullName: z.string().min(1),
  specPath: z.string().min(1),
  defaultBranch: z.string().default("main"),
});

const newRepoSchema = z.object({
  mode: z.literal("new"),
  repoName: z.string().min(1),
  visibility: z.enum(["public", "private"]),
});

export function ProjectNewPage() {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const router = useRouter();
  const selectedOrgId = ""; // TODO: Get from context

  const form = useForm({
    resolver: zodResolver(
      mode === "existing" ? existingRepoSchema : newRepoSchema,
    ),
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.mode === "existing") {
        return orpcClient.projects.createFromExistingRepo({
          orgId: selectedOrgId,
          ...data,
        });
      } else {
        return orpcClient.projects.createNewRepo({
          orgId: selectedOrgId,
          ...data,
        });
      }
    },
    onSuccess: (project) => {
      router.navigate({ to: `/projects/${project.id}` });
    },
  });

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Create New Project</h1>

      <div className="mb-8">
        <FormLabel>Project Source</FormLabel>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="existing" id="existing" />
            <label htmlFor="existing">Connect existing repository</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="new" id="new" />
            <label htmlFor="new">Create new repository</label>
          </div>
        </RadioGroup>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
        >
          {mode === "existing" ? (
            <>
              <FormField
                control={form.control}
                name="repoFullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repository</FormLabel>
                    <FormControl>
                      <RepoPicker
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="specPath"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spec Path</FormLabel>
                    <FormControl>
                      <Input placeholder="openapi.yaml" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : (
            <>
              <FormField
                control={form.control}
                name="repoName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repository Name</FormLabel>
                    <FormControl>
                      <Input placeholder="my-api" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibility</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="public" id="public" />
                          <label htmlFor="public">Public</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="private" id="private" />
                          <label htmlFor="private">Private</label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <Button
            type="submit"
            className="mt-6"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Creating..." : "Create Project"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
```

#### 4. Repo picker component

```tsx
// apps/web/src/components/projects/repo-picker.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@Emitkit/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@Emitkit/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@Emitkit/ui/components/popover";

interface RepoPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function RepoPicker({ value, onChange }: RepoPickerProps) {
  const [open, setOpen] = useState(false);

  const { data: repos } = useQuery({
    queryKey: ["github-repos"],
    queryFn: async () => {
      // This would call GitHub API via your backend
      return [
        { fullName: "acme/api", name: "api" },
        { fullName: "acme/web", name: "web" },
      ];
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value || "Select repository..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search repositories..." />
          <CommandEmpty>No repository found.</CommandEmpty>
          <CommandGroup>
            {repos?.map((repo) => (
              <CommandItem
                key={repo.fullName}
                value={repo.fullName}
                onSelect={(currentValue) => {
                  onChange(currentValue);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === repo.fullName ? "opacity-100" : "opacity-0",
                  )}
                />
                {repo.fullName}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### Unit Tests

Tests for GitHub repo service, webhook service, project service, and oRPC procedures would follow the same pattern as Phase 1 - mocking external dependencies and verifying correct behavior.

### Integration Tests

Full flow tests for creating projects from existing repos, creating new repos, and deleting projects.

### E2E Tests

```ts
// apps/web/e2e/projects.test.ts
import { test, expect } from "@playwright/test";

test.describe("Project Management", () => {
  test("create project from existing repo", async ({ page }) => {
    await page.goto("/projects/new");

    await page.check('input[value="existing"]');
    await page.click('[role="combobox"]');
    await page.click("text=acme/api");

    await page.fill('input[name="specPath"]', "openapi.yaml");
    await page.click('button:has-text("Create Project")');

    await expect(page).toHaveURL(/\/projects\/.+/);
    await expect(page.locator("text=acme/api")).toBeVisible();
  });

  test("create project with new repo", async ({ page }) => {
    await page.goto("/projects/new");

    await page.check('input[value="new"]');
    await page.fill('input[name="repoName"]', "test-api");
    await page.check('input[value="public"]');

    await page.click('button:has-text("Create Project")');

    await expect(page).toHaveURL(/\/projects\/.+/);
  });

  test("delete project", async ({ page }) => {
    // Navigate to project
    await page.goto("/projects/test-project-id");

    // Go to settings
    await page.click("text=Settings");

    // Delete project
    await page.click('button:has-text("Delete Project")');
    await page.click('button:has-text("Confirm")');

    // Should redirect to dashboard
    await expect(page).toHaveURL("/dashboard");
  });
});
```

### Demo

1. Create project by connecting existing GitHub repo
2. Create project by creating new GitHub repo (show in GitHub UI)
3. View project list on dashboard
4. Click project card to view details
5. Delete a project
6. Show webhook registered on GitHub repo settings

---

## Phase 3: Project Configuration & Generation Trigger

### Objective

Allow admins to configure project outputs (SDK/CLI/MCP/Docs), languages, versioning strategy, and manually trigger generation runs (queued, not yet processed).

### Data Model Changes

#### 1. Create project_configs table

```ts
// packages/db/src/schema/configs.ts
export const projectConfigs = sqliteTable("project_configs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  outputs: text("outputs").notNull(), // JSON array: ['SDK','CLI','MCP','DOCS']
  sdkLanguages: text("sdk_languages").notNull(), // JSON: ['typescript','python']
  outputDir: text("output_dir").notNull().default(".emitkit/"),
  sdkNpmScope: text("sdk_npm_scope"),
  sdkPypiName: text("sdk_pypi_name"),
  sdkVersionStrategy: text("sdk_version_strategy")
    .notNull()
    .default("emitkit-managed"),
  geminiApiKey: text("gemini_api_key"), // encrypted
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});
```

#### 2. Create generation_runs table

```ts
// packages/db/src/schema/runs.ts
export const generationRuns = sqliteTable("generation_runs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  configId: text("config_id")
    .notNull()
    .references(() => projectConfigs.id),
  triggeredBy: text("triggered_by").notNull(), // 'manual' | 'webhook'
  status: text("status").notNull().default("queued"), // queued|running|success|failed
  commitSha: text("commit_sha"),
  specSnapshot: text("spec_snapshot"), // JSON of ParsedSpec
  sdkVersion: text("sdk_version"),
  branchName: text("branch_name"),
  prUrl: text("pr_url"),
  logs: text("logs").default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
});
```

#### 3. Create sdk_versions table

```ts
// packages/db/src/schema/versions.ts
export const sdkVersions = sqliteTable("sdk_versions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  runId: text("run_id")
    .notNull()
    .references(() => generationRuns.id),
  changeType: text("change_type").notNull(), // 'major'|'minor'|'patch'
  changelog: text("changelog"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});
```

### Backend Implementation

#### 1. Queue package setup

```ts
// packages/queue/src/index.ts
import { Queue, Worker, Job } from "bullmq";
import { Redis } from "ioredis";

export const QUEUES = {
  GENERATION: "generation",
} as const;

export interface GenerationJobData {
  runId: string;
}

export interface GenerationJobResult {
  prUrl?: string;
  sdkVersion?: string;
}

export function createQueue(name: string, redis: Redis) {
  return new Queue(name, {
    connection: redis,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      timeout: 300000, // 5 minutes
    },
  });
}
```

#### 2. Config service

```ts
// packages/api/src/services/config.ts
import { db } from "@Emitkit/db";
import { projectConfigs } from "@Emitkit/db/schema/configs";
import { encrypt } from "@Emitkit/auth/crypto";
import { z } from "zod";

const configSchema = z.object({
  outputs: z.array(z.enum(["SDK", "CLI", "MCP", "DOCS"])),
  sdkLanguages: z.array(z.enum(["typescript", "python"])),
  outputDir: z.string().default(".emitkit/"),
  sdkNpmScope: z.string().optional(),
  sdkPypiName: z.string().optional(),
  sdkVersionStrategy: z.enum(["emitkit-managed", "spec-version"]),
  geminiApiKey: z.string().optional(),
});

export async function getLatestConfig(projectId: string) {
  const [config] = await db
    .select()
    .from(projectConfigs)
    .where(eq(projectConfigs.projectId, projectId))
    .orderBy(desc(projectConfigs.createdAt))
    .limit(1);

  return config;
}

export async function saveConfig(
  projectId: string,
  data: z.infer<typeof configSchema>,
) {
  const validated = configSchema.parse(data);

  const config = {
    id: crypto.randomUUID(),
    projectId,
    outputs: JSON.stringify(validated.outputs),
    sdkLanguages: JSON.stringify(validated.sdkLanguages),
    outputDir: validated.outputDir,
    sdkNpmScope: validated.sdkNpmScope,
    sdkPypiName: validated.sdkPypiName,
    sdkVersionStrategy: validated.sdkVersionStrategy,
    geminiApiKey: validated.geminiApiKey
      ? encrypt(validated.geminiApiKey)
      : null,
    createdAt: Date.now(),
  };

  await db.insert(projectConfigs).values(config);
  return config;
}
```

#### 3. Run service

```ts
// packages/api/src/services/runs.ts
import { db } from "@Emitkit/db";
import { generationRuns } from "@Emitkit/db/schema/runs";
import { createQueue, QUEUES, GenerationJobData } from "@Emitkit/queue";
import { redis } from "../lib/redis";

const generationQueue = createQueue(QUEUES.GENERATION, redis);

export async function createRun(
  projectId: string,
  configId: string,
  triggeredBy: string,
) {
  const run = {
    id: crypto.randomUUID(),
    projectId,
    configId,
    triggeredBy,
    status: "queued",
    createdAt: Date.now(),
  };

  await db.insert(generationRuns).values(run);
  return run;
}

export async function enqueueGenerationJob(runId: string) {
  await generationQueue.add("generate", { runId } as GenerationJobData);
}

export async function listRuns(projectId: string, limit = 50, offset = 0) {
  return db
    .select()
    .from(generationRuns)
    .where(eq(generationRuns.projectId, projectId))
    .orderBy(desc(generationRuns.createdAt))
    .limit(limit)
    .offset(offset);
}
```

#### 4. oRPC procedures

```ts
// packages/api/src/routers/projects.ts (extend)
export const projectsRouter = router({
  // ... previous procedures

  config: router({
    get: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ ctx, input }) => {
        const project = await getProject(input.projectId);
        await verifyOrgMembership(ctx.user.id, project.orgId);

        return configService.getLatestConfig(input.projectId);
      }),

    save: protectedProcedure
      .input(
        z.object({
          projectId: z.string(),
          outputs: z.array(z.enum(["SDK", "CLI", "MCP", "DOCS"])),
          sdkLanguages: z.array(z.enum(["typescript", "python"])),
          outputDir: z.string(),
          sdkNpmScope: z.string().optional(),
          sdkPypiName: z.string().optional(),
          sdkVersionStrategy: z.enum(["emitkit-managed", "spec-version"]),
          geminiApiKey: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { projectId, ...configData } = input;
        const project = await getProject(projectId);
        await verifyOrgMembership(ctx.user.id, project.orgId);

        return configService.saveConfig(projectId, configData);
      }),
  }),

  runs: router({
    list: protectedProcedure
      .input(
        z.object({
          projectId: z.string(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        }),
      )
      .query(async ({ ctx, input }) => {
        const project = await getProject(input.projectId);
        await verifyOrgMembership(ctx.user.id, project.orgId);

        return runService.listRuns(input.projectId, input.limit, input.offset);
      }),

    get: protectedProcedure
      .input(z.object({ runId: z.string() }))
      .query(async ({ ctx, input }) => {
        const [run] = await ctx.db
          .select()
          .from(generationRuns)
          .where(eq(generationRuns.id, input.runId));

        if (!run) throw new Error("NOT_FOUND");

        const project = await getProject(run.projectId);
        await verifyOrgMembership(ctx.user.id, project.orgId);

        return run;
      }),

    trigger: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const project = await getProject(input.projectId);
        await verifyOrgMembership(ctx.user.id, project.orgId);

        const config = await configService.getLatestConfig(input.projectId);
        if (!config) throw new Error("No configuration found");

        const run = await runService.createRun(
          input.projectId,
          config.id,
          "manual",
        );

        await runService.enqueueGenerationJob(run.id);

        return run;
      }),
  }),
});
```

#### 5. Setup Redis connection

```ts
// apps/server/src/lib/redis.ts
import { Redis } from "ioredis";
import { env } from "@Emitkit/env/server";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
```

### Frontend Implementation

#### 1. Project detail page with tabs

```tsx
// apps/web/src/pages/project-detail.tsx
import { useParams } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { orpcClient } from "@/lib/orpc";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@Emitkit/ui/components/tabs";
import { Button } from "@Emitkit/ui/components/button";
import { ConfigTab } from "@/components/projects/config-tab";
import { RunsTab } from "@/components/projects/runs-tab";

export function ProjectDetailPage() {
  const { projectId } = useParams();

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => orpcClient.projects.get({ projectId }),
  });

  const triggerMutation = useMutation({
    mutationFn: () => orpcClient.projects.runs.trigger({ projectId }),
    onSuccess: () => {
      // Show toast
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">{project?.repoFullName}</h1>
          <p className="text-muted-foreground">{project?.specPath}</p>
        </div>
        <Button onClick={() => triggerMutation.mutate()}>
          Trigger Generation
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="mt-4">
            <p>Project overview content</p>
          </div>
        </TabsContent>

        <TabsContent value="runs">
          <RunsTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="config">
          <ConfigTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="versions">
          <p>Versions content (Phase 7)</p>
        </TabsContent>

        <TabsContent value="settings">
          <p>Settings content</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### 2. Config tab

```tsx
// apps/web/src/components/projects/config-tab.tsx
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { orpcClient } from "@/lib/orpc";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
} from "@Emitkit/ui/components/form";
import { Checkbox } from "@Emitkit/ui/components/checkbox";
import { Input } from "@Emitkit/ui/components/input";
import { Button } from "@Emitkit/ui/components/button";
import { RadioGroup, RadioGroupItem } from "@Emitkit/ui/components/radio-group";

const configSchema = z.object({
  outputs: z.array(z.enum(["SDK", "CLI", "MCP", "DOCS"])),
  sdkLanguages: z.array(z.enum(["typescript", "python"])),
  outputDir: z.string(),
  sdkNpmScope: z.string().optional(),
  sdkPypiName: z.string().optional(),
  sdkVersionStrategy: z.enum(["emitkit-managed", "spec-version"]),
  geminiApiKey: z.string().optional(),
});

interface ConfigTabProps {
  projectId: string;
}

export function ConfigTab({ projectId }: ConfigTabProps) {
  const { data: config } = useQuery({
    queryKey: ["config", projectId],
    queryFn: () => orpcClient.projects.config.get({ projectId }),
  });

  const form = useForm({
    resolver: zodResolver(configSchema),
    values: config
      ? {
          outputs: JSON.parse(config.outputs),
          sdkLanguages: JSON.parse(config.sdkLanguages),
          outputDir: config.outputDir,
          sdkNpmScope: config.sdkNpmScope,
          sdkPypiName: config.sdkPypiName,
          sdkVersionStrategy: config.sdkVersionStrategy,
        }
      : undefined,
  });

  const saveMutation = useMutation({
    mutationFn: (data: z.infer<typeof configSchema>) =>
      orpcClient.projects.config.save({ projectId, ...data }),
    onSuccess: () => {
      // Show toast
    },
  });

  const outputs = form.watch("outputs") || [];
  const sdkLanguages = form.watch("sdkLanguages") || [];

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="outputs"
          render={() => (
            <FormItem>
              <FormLabel>Outputs</FormLabel>
              <div className="space-y-2">
                {["SDK", "CLI", "MCP", "DOCS"].map((output) => (
                  <div key={output} className="flex items-center space-x-2">
                    <Checkbox
                      checked={outputs.includes(output)}
                      onCheckedChange={(checked) => {
                        const newOutputs = checked
                          ? [...outputs, output]
                          : outputs.filter((o) => o !== output);
                        form.setValue("outputs", newOutputs);
                      }}
                    />
                    <label>{output}</label>
                  </div>
                ))}
              </div>
            </FormItem>
          )}
        />

        {outputs.includes("SDK") && (
          <FormField
            control={form.control}
            name="sdkLanguages"
            render={() => (
              <FormItem>
                <FormLabel>SDK Languages</FormLabel>
                <div className="space-y-2">
                  {["typescript", "python"].map((lang) => (
                    <div key={lang} className="flex items-center space-x-2">
                      <Checkbox
                        checked={sdkLanguages.includes(lang)}
                        onCheckedChange={(checked) => {
                          const newLangs = checked
                            ? [...sdkLanguages, lang]
                            : sdkLanguages.filter((l) => l !== lang);
                          form.setValue("sdkLanguages", newLangs);
                        }}
                      />
                      <label className="capitalize">{lang}</label>
                    </div>
                  ))}
                </div>
              </FormItem>
            )}
          />
        )}

        {sdkLanguages.includes("typescript") && (
          <FormField
            control={form.control}
            name="sdkNpmScope"
            render={({ field }) => (
              <FormItem>
                <FormLabel>npm Scope (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="@acme" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="outputDir"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Output Directory</FormLabel>
              <FormControl>
                <Input placeholder=".emitkit/" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sdkVersionStrategy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Version Strategy</FormLabel>
              <FormControl>
                <RadioGroup value={field.value} onValueChange={field.onChange}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="emitkit-managed" />
                    <label>Emitkit Managed</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="spec-version" />
                    <label>Use Spec Version</label>
                  </div>
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={saveMutation.isPending}>
          Save Configuration
        </Button>
      </form>
    </Form>
  );
}
```

#### 3. Runs tab

```tsx
// apps/web/src/components/projects/runs-tab.tsx
import { useQuery } from "@tanstack/react-query";
import { orpcClient } from "@/lib/orpc";
import { RunStatusBadge } from "./run-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@Emitkit/ui/components/table";
import { Link } from "@tanstack/react-router";

interface RunsTabProps {
  projectId: string;
}

export function RunsTab({ projectId }: RunsTabProps) {
  const { data: runs } = useQuery({
    queryKey: ["runs", projectId],
    queryFn: () => orpcClient.projects.runs.list({ projectId }),
  });

  if (!runs?.length) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No runs yet. Trigger your first generation.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Run ID</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Triggered By</TableHead>
          <TableHead>Started At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell>
              <Link to={`/runs/${run.id}`} className="hover:underline">
                {run.id.substring(0, 8)}
              </Link>
            </TableCell>
            <TableCell>
              <RunStatusBadge status={run.status} />
            </TableCell>
            <TableCell>{run.triggeredBy}</TableCell>
            <TableCell>{new Date(run.createdAt).toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

#### 4. Run status badge

```tsx
// apps/web/src/components/runs/run-status-badge.tsx
import { Badge } from "@Emitkit/ui/components/badge";
import { Clock, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface RunStatusBadgeProps {
  status: string;
}

export function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const variants = {
    queued: { variant: "secondary" as const, icon: Clock, label: "Queued" },
    running: { variant: "default" as const, icon: Loader2, label: "Running" },
    success: {
      variant: "success" as const,
      icon: CheckCircle2,
      label: "Success",
    },
    failed: { variant: "destructive" as const, icon: XCircle, label: "Failed" },
  };

  const config = variants[status as keyof typeof variants] || variants.queued;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
}
```

### Unit Tests

Similar patterns to previous phases - testing config service, run service, queue setup, and oRPC procedures.

### Integration Tests

Full flow: save config, trigger run, verify job enqueued in BullMQ.

### E2E Tests

```ts
// apps/web/e2e/configuration.test.ts
import { test, expect } from "@playwright/test";

test("configure project and trigger generation", async ({ page }) => {
  await page.goto("/projects/test-project-id");

  // Go to Config tab
  await page.click('button:has-text("Config")');

  // Select outputs
  await page.check("text=SDK");
  await page.check("text=CLI");

  // Select languages
  await page.check("text=TypeScript");

  // Save
  await page.click('button:has-text("Save Configuration")');
  await expect(page.locator("text=Configuration saved")).toBeVisible();

  // Trigger generation
  await page.click('button:has-text("Trigger Generation")');
  await expect(page.locator("text=Generation started")).toBeVisible();

  // Go to Runs tab
  await page.click('button:has-text("Runs")');

  // Verify run appears
  await expect(page.locator("text=queued")).toBeVisible();
});
```

### Demo

- Configure project with multiple outputs and languages
- Save configuration
- Trigger generation manually
- See run appear in Runs tab with "queued" status
- Show job in BullMQ queue (Redis CLI or BullMQ UI)

---

## Phase 4: Worker Process & Core Generation Pipeline

### Objective

Build the BullMQ worker that processes generation jobs: fetch spec, parse, calculate version, and update run status (no actual code generation yet - just pipeline structure).

### Backend Implementation

#### 1. Worker app setup

```ts
// apps/worker/src/index.ts
import { Worker, Job } from "bullmq";
import { redis } from "./lib/redis";
import { QUEUES, GenerationJobData } from "@Emitkit/queue";
import { processGenerationJob } from "./processors/generation";
import { db } from "@Emitkit/db";
import { generationRuns } from "@Emitkit/db/schema/runs";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";

const worker = new Worker<GenerationJobData>(
  QUEUES.GENERATION,
  processGenerationJob,
  {
    connection: redis,
    concurrency: 3,
  },
);

// Mark stale running runs as failed on startup
async function markStaleRunsAsFailed() {
  await db
    .update(generationRuns)
    .set({
      status: "failed",
      logs: "Worker restarted; run aborted",
      finishedAt: Date.now(),
    })
    .where(eq(generationRuns.status, "running"));
}

markStaleRunsAsFailed().then(() => {
  logger.info("Worker started");
});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err }, "Job failed");
});

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Job completed");
});
```

#### 2. Generation job processor

```ts
// apps/worker/src/processors/generation.ts
import { Job } from "bullmq";
import { GenerationJobData } from "@Emitkit/queue";
import { db } from "@Emitkit/db";
import { generationRuns, projects, projectConfigs } from "@Emitkit/db/schema";
import { eq } from "drizzle-orm";
import { fetchSpec } from "../steps/fetch-spec";
import { parseSpec } from "../steps/parse-spec";
import { diffSpec } from "../steps/diff-spec";
import { calcVersion } from "../steps/calc-version";
import { logStep } from "../lib/logger";

export async function processGenerationJob(job: Job<GenerationJobData>) {
  const { runId } = job.data;

  try {
    // Update status to running
    await db
      .update(generationRuns)
      .set({ status: "running" })
      .where(eq(generationRuns.id, runId));

    await logStep(runId, "Starting generation...");

    // Fetch run details
    const [run] = await db
      .select()
      .from(generationRuns)
      .where(eq(generationRuns.id, runId));

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, run.projectId));

    const [config] = await db
      .select()
      .from(projectConfigs)
      .where(eq(projectConfigs.id, run.configId));

    // Step 1: Fetch spec
    await logStep(runId, "Fetching OpenAPI spec...");
    const { content, sha } = await fetchSpec(project);

    await db
      .update(generationRuns)
      .set({ commitSha: sha })
      .where(eq(generationRuns.id, runId));

    // Step 2: Parse spec
    await logStep(runId, "Parsing OpenAPI spec...");
    const parsedSpec = await parseSpec(content);

    // Step 3: Diff spec
    await logStep(runId, "Analyzing changes...");
    const diff = await diffSpec(parsedSpec, run.projectId);

    // Step 4: Calculate version
    await logStep(runId, "Calculating version...");
    const version = await calcVersion(config, diff, parsedSpec);

    await db
      .update(generationRuns)
      .set({
        sdkVersion: version,
        specSnapshot: JSON.stringify(parsedSpec),
      })
      .where(eq(generationRuns.id, runId));

    await logStep(runId, `Version: ${version}`);

    // Update to success (temporarily, until we add code generation)
    await db
      .update(generationRuns)
      .set({
        status: "success",
        finishedAt: Date.now(),
      })
      .where(eq(generationRuns.id, runId));

    await logStep(runId, "[DONE]");

    return { sdkVersion: version };
  } catch (error: any) {
    await logStep(runId, `ERROR: ${error.message}`);

    await db
      .update(generationRuns)
      .set({
        status: "failed",
        finishedAt: Date.now(),
      })
      .where(eq(generationRuns.id, runId));

    await logStep(runId, "[DONE]");

    throw error;
  }
}
```

#### 3. Fetch spec step

```ts
// apps/worker/src/steps/fetch-spec.ts
import { GitHubClient } from "@Emitkit/github/client";
import { getRepoContent } from "@Emitkit/github/repo";

export async function fetchSpec(project: any) {
  const [owner, repo] = project.repoFullName.split("/");

  // Get user's GitHub token (you'll need to fetch this from account table)
  const githubClient = new GitHubClient(/* encrypted token */);

  const { content, sha } = await getRepoContent(
    githubClient,
    owner,
    repo,
    project.specPath,
    project.defaultBranch,
  );

  // Validate size
  if (content.length > 2 * 1024 * 1024) {
    throw new Error("Spec file exceeds 2MB limit");
  }

  return { content, sha };
}
```

#### 4. Parse spec step

```ts
// apps/worker/src/steps/parse-spec.ts
import SwaggerParser from "@apidevtools/swagger-parser";

export async function parseSpec(content: string) {
  try {
    const api = await SwaggerParser.validate(content);

    // Transform to internal ParsedSpec format
    const operations = [];

    for (const [path, pathItem] of Object.entries(api.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (["get", "post", "put", "patch", "delete"].includes(method)) {
          operations.push({
            operationId: operation.operationId || `${method}_${path}`,
            method: method.toUpperCase(),
            path,
            summary: operation.summary,
            description: operation.description,
            tags: operation.tags || [],
            parameters: operation.parameters || [],
            requestBody: operation.requestBody,
            responses: operation.responses || {},
            security: operation.security,
          });
        }
      }
    }

    return {
      info: api.info,
      servers: api.servers?.map((s: any) => s.url) || [],
      operations,
      schemas: api.components?.schemas || {},
      security: api.security || [],
    };
  } catch (error: any) {
    throw new Error(`Failed to parse OpenAPI spec: ${error.message}`);
  }
}
```

#### 5. Diff spec step

```ts
// apps/worker/src/steps/diff-spec.ts
import { db } from "@Emitkit/db";
import { generationRuns } from "@Emitkit/db/schema/runs";
import { eq, desc } from "drizzle-orm";

export async function diffSpec(currentSpec: any, projectId: string) {
  // Find last successful run
  const [lastRun] = await db
    .select()
    .from(generationRuns)
    .where(
      eq(generationRuns.projectId, projectId),
      eq(generationRuns.status, "success"),
    )
    .orderBy(desc(generationRuns.createdAt))
    .limit(1);

  if (!lastRun?.specSnapshot) {
    return {
      isFirstRun: true,
      addedOperations: currentSpec.operations.length,
      removedOperations: 0,
      modifiedOperations: 0,
    };
  }

  const previousSpec = JSON.parse(lastRun.specSnapshot);

  const prevOpIds = new Set(
    previousSpec.operations.map((op: any) => op.operationId),
  );
  const currentOpIds = new Set(
    currentSpec.operations.map((op: any) => op.operationId),
  );

  const addedOperations = [...currentOpIds].filter((id) => !prevOpIds.has(id));
  const removedOperations = [...prevOpIds].filter(
    (id) => !currentOpIds.has(id),
  );

  // Check for breaking changes (required params added, etc.)
  const breakingChanges = [];

  for (const op of currentSpec.operations) {
    const prevOp = previousSpec.operations.find(
      (o: any) => o.operationId === op.operationId,
    );
    if (prevOp) {
      const requiredParams = op.parameters?.filter((p: any) => p.required);
      const prevRequiredParams = prevOp.parameters?.filter(
        (p: any) => p.required,
      );

      if (requiredParams?.length > prevRequiredParams?.length) {
        breakingChanges.push(op.operationId);
      }
    }
  }

  return {
    isFirstRun: false,
    addedOperations: addedOperations.length,
    removedOperations: removedOperations.length,
    modifiedOperations: breakingChanges.length,
    breakingChanges,
  };
}
```

#### 6. Calculate version step

```ts
// apps/worker/src/steps/calc-version.ts
import semver from "semver";

export async function calcVersion(config: any, diff: any, parsedSpec: any) {
  if (config.sdkVersionStrategy === "spec-version") {
    return parsedSpec.info.version;
  }

  // Emitkit-managed
  if (diff.isFirstRun) {
    return "0.1.0";
  }

  // Get last version (you'd fetch this from sdk_versions table)
  const lastVersion = "0.1.0"; // TODO: fetch from DB

  // Determine bump type
  let bumpType: "major" | "minor" | "patch" = "patch";

  if (diff.breakingChanges?.length > 0 || diff.removedOperations > 0) {
    bumpType = "minor"; // Breaking changes bump minor (we're pre-1.0)
  } else if (diff.addedOperations > 0) {
    bumpType = "patch";
  }

  return semver.inc(lastVersion, bumpType) || lastVersion;
}
```

#### 7. Logger utility

```ts
// apps/worker/src/lib/logger.ts
import pino from "pino";
import { redis } from "./redis";
import { db } from "@Emitkit/db";
import { generationRuns } from "@Emitkit/db/schema/runs";
import { eq } from "drizzle-orm";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

export async function logStep(runId: string, message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;

  // Append to DB
  const [run] = await db
    .select()
    .from(generationRuns)
    .where(eq(generationRuns.id, runId));

  const updatedLogs = (run.logs || "") + logLine;

  await db
    .update(generationRuns)
    .set({ logs: updatedLogs })
    .where(eq(generationRuns.id, runId));

  // Publish to Redis for SSE
  await redis.publish(`run-logs:${runId}`, logLine);

  logger.info({ runId, message });
}
```

#### 8. SSE endpoint

```ts
// apps/server/src/routes/sse.ts
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { redis } from "../lib/redis";

const app = new Hono();

app.get("/runs/:runId/logs/stream", async (c) => {
  const { runId } = c.req.param();

  return streamSSE(c, async (stream) => {
    const subscriber = redis.duplicate();
    await subscriber.connect();

    await subscriber.subscribe(`run-logs:${runId}`);

    subscriber.on("message", (channel, message) => {
      if (channel === `run-logs:${runId}`) {
        stream.writeSSE({ data: message });

        if (message.includes("[DONE]")) {
          subscriber.quit();
          stream.close();
        }
      }
    });

    // Handle client disconnect
    c.req.raw.signal.addEventListener("abort", () => {
      subscriber.quit();
    });
  });
});

export default app;
```

### Frontend Implementation

#### 1. Run detail page

```tsx
// apps/web/src/pages/run-detail.tsx
import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { orpcClient } from "@/lib/orpc";
import { RunStatusBadge } from "@/components/runs/run-status-badge";
import { LogStream } from "@/components/runs/log-stream";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@Emitkit/ui/components/card";

export function RunDetailPage() {
  const { runId } = useParams();

  const { data: run } = useQuery({
    queryKey: ["run", runId],
    queryFn: () => orpcClient.projects.runs.get({ runId }),
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Run Details</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">Run ID</dt>
              <dd className="font-mono">{run?.id}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd>
                <RunStatusBadge status={run?.status || "queued"} />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Triggered By</dt>
              <dd>{run?.triggeredBy}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Started At</dt>
              <dd>
                {run?.createdAt && new Date(run.createdAt).toLocaleString()}
              </dd>
            </div>
            {run?.commitSha && (
              <div>
                <dt className="text-sm text-muted-foreground">Commit SHA</dt>
                <dd className="font-mono text-sm">
                  {run.commitSha.substring(0, 7)}
                </dd>
              </div>
            )}
            {run?.sdkVersion && (
              <div>
                <dt className="text-sm text-muted-foreground">SDK Version</dt>
                <dd>{run.sdkVersion}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <LogStream runId={runId} />
        </CardContent>
      </Card>
    </div>
  );
}
```

#### 2. Log stream component

```tsx
// apps/web/src/components/runs/log-stream.tsx
import { useEffect, useState, useRef } from "react";
import { Alert, AlertDescription } from "@Emitkit/ui/components/alert";

interface LogStreamProps {
  runId: string;
}

export function LogStream({ runId }: LogStreamProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eventSource = new EventSource(`/api/runs/${runId}/logs/stream`);

    eventSource.onopen = () => {
      setIsConnecting(false);
    };

    eventSource.onmessage = (event) => {
      const logLine = event.data;

      if (logLine.includes("[DONE]")) {
        setIsComplete(true);
        eventSource.close();
      } else {
        setLogs((prev) => [...prev, logLine]);
      }
    };

    eventSource.onerror = () => {
      setError("Connection lost. Attempting to reconnect...");
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [runId]);

  useEffect(() => {
    if (!isComplete) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isComplete]);

  return (
    <div>
      {isConnecting && (
        <Alert>
          <AlertDescription>Connecting to log stream...</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <pre className="bg-muted p-4 rounded-md overflow-auto max-h-[600px] font-mono text-sm">
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
        <div ref={logsEndRef} />
      </pre>

      {isComplete && (
        <Alert className="mt-4">
          <AlertDescription>✓ Run complete</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

### Unit Tests

```ts
// apps/worker/src/steps/fetch-spec.test.ts
import { describe, it, expect, vi } from "vitest";
import { fetchSpec } from "./fetch-spec";

describe("Fetch Spec", () => {
  it("fetches spec content from GitHub", async () => {
    // Mock GitHub client
    const project = {
      repoFullName: "acme/api",
      specPath: "openapi.yaml",
      defaultBranch: "main",
    };

    // Mock implementation would be here
    const result = await fetchSpec(project);

    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("sha");
  });

  it("rejects specs larger than 2MB", async () => {
    // Test large file rejection
  });
});
```

```ts
// apps/worker/src/steps/parse-spec.test.ts
import { describe, it, expect } from "vitest";
import { parseSpec } from "./parse-spec";

describe("Parse Spec", () => {
  it("parses valid OpenAPI spec", async () => {
    const spec = `
openapi: 3.1.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: getUsers
      responses:
        200:
          description: Success
`;

    const parsed = await parseSpec(spec);

    expect(parsed.info.title).toBe("Test API");
    expect(parsed.operations).toHaveLength(1);
    expect(parsed.operations[0].operationId).toBe("getUsers");
  });

  it("throws on invalid YAML", async () => {
    await expect(parseSpec("invalid: yaml: [")).rejects.toThrow();
  });
});
```

### Integration Tests

```ts
// apps/worker/src/integration/generation-pipeline.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { processGenerationJob } from "../processors/generation";
import { createTestDb } from "@Emitkit/testing";

describe("Generation Pipeline", () => {
  it("processes job end-to-end without generators", async () => {
    const db = createTestDb();

    // Seed project, config, run
    // Mock GitHub API

    const job = {
      data: { runId: "test-run-id" },
    };

    await processGenerationJob(job as any);

    // Verify run status updated to success
    // Verify version calculated
    // Verify logs written
  });
});
```

### E2E Tests

```ts
// apps/web/e2e/run-detail.test.ts
import { test, expect } from "@playwright/test";

test("view run logs in real-time", async ({ page }) => {
  // Mock SSE stream
  await page.route("**/runs/*/logs/stream", (route) => {
    // Mock SSE responses
  });

  await page.goto("/runs/test-run-id");

  await expect(page.locator("pre")).toBeVisible();
  await expect(page.locator("text=Fetching OpenAPI spec")).toBeVisible();
  await expect(page.locator("text=Version: 0.1.0")).toBeVisible();
});
```

### Demo

- Trigger generation run
- Navigate to run detail page
- Watch logs stream in real-time
- See run complete with version calculated
- Show run status updates in Runs tab
- Verify logs persisted in database

---

## Phase 5: Generator Modules (SDK, CLI, MCP, Docs)

### Objective

Implement all code generators, syntax checking, formatting, and integrate them into the worker pipeline to produce actual output files.

### Backend Implementation

#### 1. Generator types

```ts
// packages/generators/src/types.ts
export interface Generator {
  generate(spec: ParsedSpec, config: GeneratorConfig): Promise<GeneratorResult>;
}

export interface GeneratorResult {
  files: OutputFile[];
  error?: string;
}

export interface OutputFile {
  path: string;
  content: string;
  skipIfExists?: boolean;
}

export interface ParsedSpec {
  info: { title: string; version: string; description?: string };
  servers: string[];
  operations: Operation[];
  schemas: Record<string, any>;
  security: any[];
}

export interface Operation {
  operationId: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: any[];
  requestBody?: any;
  responses: Record<string, any>;
  security?: any[];
}

export interface GeneratorConfig {
  outputDir: string;
  version: string;
  npmScope?: string;
  pypiName?: string;
}
```

#### 2. TypeScript SDK generator

```ts
// packages/generators/src/sdk/typescript/index.ts
import {
  Generator,
  ParsedSpec,
  GeneratorConfig,
  OutputFile,
} from "../../types";
import { generateTypes } from "./types";
import { generateClient } from "./client";
import { generateResources } from "./resources";

export class TypeScriptSDKGenerator implements Generator {
  async generate(
    spec: ParsedSpec,
    config: GeneratorConfig,
  ): Promise<GeneratorResult> {
    try {
      const files: OutputFile[] = [];

      // Generate types.ts
      files.push({
        path: `${config.outputDir}/sdk/typescript/types.ts`,
        content: generateTypes(spec.schemas),
      });

      // Generate client.ts
      files.push({
        path: `${config.outputDir}/sdk/typescript/client.ts`,
        content: generateClient(spec),
      });

      // Generate errors.ts
      files.push({
        path: `${config.outputDir}/sdk/typescript/errors.ts`,
        content: generateErrorClasses(),
      });

      // Generate resources
      const resourceFiles = generateResources(spec.operations, config);
      files.push(...resourceFiles);

      // Generate custom stubs (skipIfExists)
      const customStubs = generateCustomStubs(spec.operations);
      files.push(...customStubs.map((f) => ({ ...f, skipIfExists: true })));

      // Generate package.json
      files.push({
        path: `${config.outputDir}/sdk/typescript/package.json`,
        content: generatePackageJson(spec, config),
      });

      // Generate tsconfig.json
      files.push({
        path: `${config.outputDir}/sdk/typescript/tsconfig.json`,
        content: JSON.stringify(
          {
            compilerOptions: {
              target: "ES2020",
              module: "ESNext",
              moduleResolution: "bundler",
              strict: true,
              esModuleInterop: true,
            },
          },
          null,
          2,
        ),
      });

      return { files };
    } catch (error: any) {
      return { files: [], error: error.message };
    }
  }
}

function generateErrorClasses(): string {
  return `export class EmitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmitError";
  }
}

export class EmitHttpError extends EmitError {
  constructor(public status: number, public body: any) {
    super(\`HTTP \${status}: \${JSON.stringify(body)}\`);
    this.name = "EmitHttpError";
  }
}
`;
}
```

#### 3. Python SDK generator

```ts
// packages/generators/src/sdk/python/index.ts
import { Generator, ParsedSpec, GeneratorConfig } from "../../types";

export class PythonSDKGenerator implements Generator {
  async generate(spec: ParsedSpec, config: GeneratorConfig) {
    // Similar structure to TypeScript generator
    // Generate: __init__.py, client.py, types.py, errors.py, resources/
    // Use Pydantic for types, httpx for client

    const files = [];

    files.push({
      path: `${config.outputDir}/sdk/python/__init__.py`,
      content: generatePythonInit(spec),
    });

    files.push({
      path: `${config.outputDir}/sdk/python/client.py`,
      content: generatePythonClient(spec),
    });

    files.push({
      path: `${config.outputDir}/sdk/python/pyproject.toml`,
      content: generatePyProjectToml(spec, config),
    });

    return { files };
  }
}
```

#### 4. CLI generator

```ts
// packages/generators/src/cli/index.ts
import { Generator, ParsedSpec, GeneratorConfig } from "../types";

export class CLIGenerator implements Generator {
  async generate(spec: ParsedSpec, config: GeneratorConfig) {
    const files = [];

    files.push({
      path: `${config.outputDir}/cli/index.ts`,
      content: generateCLI(spec),
    });

    files.push({
      path: `${config.outputDir}/cli/package.json`,
      content: JSON.stringify(
        {
          name: `${spec.info.title.toLowerCase()}-cli`,
          version: config.version,
          bin: {
            [spec.info.title.toLowerCase()]: "./index.js",
          },
          dependencies: {
            commander: "^11.0.0",
          },
        },
        null,
        2,
      ),
    });

    return { files };
  }
}

function generateCLI(spec: ParsedSpec): string {
  return `#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('${spec.info.title.toLowerCase()}')
  .description('${spec.info.description || "CLI for " + spec.info.title}')
  .version('${spec.info.version}');

${spec.operations
  .map(
    (op) => `
program
  .command('${op.operationId}')
  .description('${op.summary || op.description || ""}')
  .action(async () => {
    // Implementation
    console.log('Executing ${op.operationId}');
  });
`,
  )
  .join("\n")}

program.parse();
`;
}
```

#### 5. MCP generator

```ts
// packages/generators/src/mcp/index.ts
import { Generator, ParsedSpec, GeneratorConfig } from "../types";

export class MCPGenerator implements Generator {
  async generate(spec: ParsedSpec, config: GeneratorConfig) {
    const files = [];

    files.push({
      path: `${config.outputDir}/mcp/index.ts`,
      content: generateMCPServer(spec),
    });

    files.push({
      path: `${config.outputDir}/mcp/package.json`,
      content: JSON.stringify(
        {
          name: `${spec.info.title.toLowerCase()}-mcp`,
          version: config.version,
          dependencies: {
            "@modelcontextprotocol/sdk": "^1.0.0",
          },
        },
        null,
        2,
      ),
    });

    return { files };
  }
}

function generateMCPServer(spec: ParsedSpec): string {
  return `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  {
    name: '${spec.info.title}',
    version: '${spec.info.version}',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

${spec.operations
  .map(
    (op) => `
server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === '${op.operationId}') {
    // Implementation
    return {
      content: [
        {
          type: 'text',
          text: 'Result of ${op.operationId}',
        },
      ],
    };
  }
});

server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: '${op.operationId}',
      description: '${op.summary || op.description || ""}',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}));
`,
  )
  .join("\n")}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
`;
}
```

#### 6. Docs generator

```ts
// packages/generators/src/docs/index.ts
import { Generator, ParsedSpec, GeneratorConfig } from "../types";
import { enrichOperationDocs } from "./gemini";

export class DocsGenerator implements Generator {
  async generate(spec: ParsedSpec, config: GeneratorConfig) {
    const files = [];

    // Generate README
    files.push({
      path: `${config.outputDir}/docs/v${config.version}/README.md`,
      content: generateReadme(spec),
    });

    // Group operations by tag
    const byTag = new Map<string, any[]>();
    for (const op of spec.operations) {
      const tag = op.tags[0] || "default";
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(op);
    }

    // Generate markdown per tag
    for (const [tag, operations] of byTag) {
      let content = `# ${tag}\n\n`;

      for (const op of operations) {
        // Try Gemini enrichment if API key available
        if (config.geminiApiKey) {
          try {
            const enriched = await enrichOperationDocs(op, config.geminiApiKey);
            content += enriched + "\n\n";
          } catch (error) {
            content += generatePlainDocs(op) + "\n\n";
          }
        } else {
          content += generatePlainDocs(op) + "\n\n";
        }
      }

      files.push({
        path: `${config.outputDir}/docs/v${config.version}/${tag}.md`,
        content,
      });
    }

    return { files };
  }
}

function generatePlainDocs(operation: any): string {
  return `## ${operation.operationId}

**${operation.method} ${operation.path}**

${operation.description || operation.summary || ""}

### Parameters

${operation.parameters?.map((p: any) => `- **${p.name}** (${p.in}): ${p.description || ""}`).join("\n") || "None"}

### Responses

${Object.entries(operation.responses)
  .map(
    ([code, resp]: [string, any]) => `- **${code}**: ${resp.description || ""}`,
  )
  .join("\n")}
`;
}
```

#### 7. Gemini integration

```ts
// packages/generators/src/docs/gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function enrichOperationDocs(
  operation: any,
  apiKey: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Generate documentation for the following API operation.

Operation: ${operation.method} ${operation.path}
Summary: ${operation.summary || ""}
Description: ${operation.description || ""}

Parameters:
${JSON.stringify(operation.parameters, null, 2)}

Write:
1. A clear 2-3 sentence description
2. A curl usage example
3. A TypeScript usage example
4. A Python usage example
5. Common errors and handling

Respond with markdown only. No preamble.`;

  const result = (await Promise.race([
    model.generateContent(prompt),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Gemini timeout")), 15000),
    ),
  ])) as any;

  return result.response.text();
}
```

#### 8. Syntax check & format

```ts
// apps/worker/src/steps/syntax-check.ts
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

export async function syntaxCheckAndFormat(files: OutputFile[], runId: string) {
  const tempDir = `/tmp/emitkit-${runId}`;

  try {
    // Create temp dir
    await mkdir(tempDir, { recursive: true });

    // Write files
    for (const file of files) {
      const fullPath = path.join(tempDir, file.path);
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, file.content);
    }

    const validatedFiles: OutputFile[] = [];

    // Check TypeScript files
    const tsFiles = files.filter((f) => f.path.includes("/typescript/"));
    if (tsFiles.length > 0) {
      try {
        const tsDir = path.join(
          tempDir,
          tsFiles[0].path.split("/typescript/")[0],
          "typescript",
        );
        await execAsync(`tsc --noEmit --strict`, { cwd: tsDir });
        await execAsync(`prettier --write "**/*.ts"`, { cwd: tsDir });

        // Read back formatted files
        for (const file of tsFiles) {
          const fullPath = path.join(tempDir, file.path);
          const formatted = await readFile(fullPath, "utf-8");
          validatedFiles.push({ ...file, content: formatted });
        }
      } catch (error: any) {
        console.error("TypeScript syntax check failed:", error.message);
        // Exclude TS files from commit
      }
    }

    // Check Python files
    const pyFiles = files.filter((f) => f.path.includes("/python/"));
    if (pyFiles.length > 0) {
      try {
        const pyDir = path.join(
          tempDir,
          pyFiles[0].path.split("/python/")[0],
          "python",
        );
        await execAsync(`ruff check --fix .`, { cwd: pyDir });
        await execAsync(`ruff format .`, { cwd: pyDir });

        // Read back formatted files
        for (const file of pyFiles) {
          const fullPath = path.join(tempDir, file.path);
          const formatted = await readFile(fullPath, "utf-8");
          validatedFiles.push({ ...file, content: formatted });
        }
      } catch (error: any) {
        console.warn("Python formatting warning:", error.message);
        // Still include Python files (ruff warnings are non-fatal)
        validatedFiles.push(...pyFiles);
      }
    }

    return validatedFiles;
  } finally {
    // Cleanup
    await rm(tempDir, { recursive: true, force: true });
  }
}
```

#### 9. Run generators step

```ts
// apps/worker/src/steps/run-generators.ts
import { TypeScriptSDKGenerator } from "@Emitkit/generators/sdk/typescript";
import { PythonSDKGenerator } from "@Emitkit/generators/sdk/python";
import { CLIGenerator } from "@Emitkit/generators/cli";
import { MCPGenerator } from "@Emitkit/generators/mcp";
import { DocsGenerator } from "@Emitkit/generators/docs";

export async function runGenerators(
  parsedSpec: any,
  config: any,
  version: string,
) {
  const outputs = JSON.parse(config.outputs);
  const languages = JSON.parse(config.sdkLanguages);

  const generatorConfig = {
    outputDir: config.outputDir,
    version,
    npmScope: config.sdkNpmScope,
    pypiName: config.sdkPypiName,
    geminiApiKey: config.geminiApiKey,
  };

  const results = await Promise.allSettled([
    outputs.includes("SDK") && languages.includes("typescript")
      ? new TypeScriptSDKGenerator().generate(parsedSpec, generatorConfig)
      : Promise.resolve({ files: [] }),

    outputs.includes("SDK") && languages.includes("python")
      ? new PythonSDKGenerator().generate(parsedSpec, generatorConfig)
      : Promise.resolve({ files: [] }),

    outputs.includes("CLI")
      ? new CLIGenerator().generate(parsedSpec, generatorConfig)
      : Promise.resolve({ files: [] }),

    outputs.includes("MCP")
      ? new MCPGenerator().generate(parsedSpec, generatorConfig)
      : Promise.resolve({ files: [] }),

    outputs.includes("DOCS")
      ? new DocsGenerator().generate(parsedSpec, generatorConfig)
      : Promise.resolve({ files: [] }),
  ]);

  const allFiles = [];

  for (const result of results) {
    if (result.status === "fulfilled" && !result.value.error) {
      allFiles.push(...result.value.files);
    } else {
      console.error("Generator failed:", result);
    }
  }

  return allFiles;
}
```

#### 10. Update generation processor

```ts
// apps/worker/src/processors/generation.ts (update)
// Add after calcVersion:

await logStep(runId, "Running generators...");
const generatedFiles = await runGenerators(parsedSpec, config, version);
await logStep(runId, `Generated ${generatedFiles.length} files`);

await logStep(runId, "Checking syntax and formatting...");
const validatedFiles = await syntaxCheckAndFormat(generatedFiles, runId);
await logStep(runId, `Validated ${validatedFiles.length} files`);

// Temporarily store files (Phase 6 will commit them)
```

### Unit Tests

Test each generator individually with minimal spec inputs, verify correct file structure and content.

### Integration Tests

Run full generation pipeline with all generators, verify syntax check passes, verify formatting applied.

### E2E Tests

```ts
test("complete generation with all outputs", async ({ page }) => {
  await page.goto("/projects/test-id");
  await page.click('button:has-text("Config")');
  await page.check("text=SDK");
  await page.check("text=CLI");
  await page.check("text=MCP");
  await page.check("text=DOCS");
  await page.click('button:has-text("Save")');
  await page.click('button:has-text("Trigger Generation")');

  await page.goto("/runs/latest-run-id");
  await expect(page.locator("text=Generated")).toBeVisible();
  await expect(page.locator("text=Success")).toBeVisible();
});
```

### Demo

- Trigger generation with all outputs
- Watch logs show each generator running
- See syntax checking and formatting
- Verify run completes successfully

---

## Phase 6: GitHub Integration (Commit & PR Creation)

### Objective

Complete the worker pipeline by committing generated files to GitHub, creating a branch, opening a PR, and generating GitHub Actions workflows.

### Backend Implementation

#### 1. Workflow generator

```ts
// packages/generators/src/workflows/index.ts
export function generateNpmWorkflow(outputDir: string): string {
  return `name: Publish to npm
on:
  pull_request:
    types: [closed]
    branches: [main]
jobs:
  publish:
    if: github.event.pull_request.merged == true && startsWith(github.head_ref, 'emitkit/')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: "https://registry.npmjs.org"
      - run: cd ${outputDir}/sdk/typescript && npm ci && npm publish
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
`;
}

export function generatePyPIWorkflow(outputDir: string): string {
  return `name: Publish to PyPI
on:
  pull_request:
    types: [closed]
    branches: [main]
jobs:
  publish:
    if: github.event.pull_request.merged == true && startsWith(github.head_ref, 'emitkit/')
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: cd ${outputDir}/sdk/python && pip install build && python -m build
      - uses: pypa/gh-action-pypi-publish@release/v1
        with:
          packages-dir: ${outputDir}/sdk/python/dist/
`;
}
```

#### 2. GitHub PR service

```ts
// packages/github/src/pr.ts
import { GitHubClient } from "./client";

export async function createBranch(
  client: GitHubClient,
  owner: string,
  repo: string,
  branchName: string,
  baseSha: string,
) {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });
  });
}

export async function checkFileExists(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<boolean> {
  try {
    await client.withRetry(async () => {
      const octokit = client.getOctokit();
      await octokit.repos.getContent({ owner, repo, path, ref });
    });
    return true;
  } catch {
    return false;
  }
}

export async function createCommitWithFiles(
  client: GitHubClient,
  owner: string,
  repo: string,
  branchName: string,
  files: Array<{ path: string; content: string }>,
  message: string,
) {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();

    // Get current commit SHA
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
    });
    const currentSha = ref.object.sha;

    // Get base tree
    const { data: commit } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: currentSha,
    });
    const baseTreeSha = commit.tree.sha;

    // Create blobs
    const blobs = await Promise.all(
      files.map(async (file) => {
        const { data } = await octokit.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString("base64"),
          encoding: "base64",
        });
        return { path: file.path, sha: data.sha };
      }),
    );

    // Create tree
    const { data: tree } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: blobs.map((blob) => ({
        path: blob.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      })),
    });

    // Create commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message,
      tree: tree.sha,
      parents: [currentSha],
    });

    // Update ref
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
      sha: newCommit.sha,
    });

    return newCommit.sha;
  });
}

export async function createPullRequest(
  client: GitHubClient,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string,
) {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();
    const { data } = await octokit.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    });
    return data.html_url;
  });
}

export async function createTag(
  client: GitHubClient,
  owner: string,
  repo: string,
  tagName: string,
  sha: string,
) {
  return client.withRetry(async () => {
    const octokit = client.getOctokit();
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/tags/${tagName}`,
      sha,
    });
  });
}
```

#### 3. Commit output step

```ts
// apps/worker/src/steps/commit-output.ts
import { GitHubClient } from "@Emitkit/github/client";
import * as prService from "@Emitkit/github/pr";
import {
  generateNpmWorkflow,
  generatePyPIWorkflow,
} from "@Emitkit/generators/workflows";

export async function commitOutput(
  project: any,
  config: any,
  files: any[],
  runId: string,
  version: string,
  githubClient: GitHubClient,
) {
  const [owner, repo] = project.repoFullName.split("/");

  // Determine output repo
  const outputRepo =
    project.outputMode === "separate"
      ? project.outputRepoFullName
      : project.repoFullName;

  const [outputOwner, outputRepoName] = outputRepo.split("/");

  // Check which custom/ files exist
  const customFiles = files.filter((f) => f.path.includes("/custom/"));
  const existingCustomFiles = [];

  for (const file of customFiles) {
    const exists = await prService.checkFileExists(
      githubClient,
      outputOwner,
      outputRepoName,
      file.path,
      project.defaultBranch,
    );
    if (exists) existingCustomFiles.push(file.path);
  }

  // Filter out existing custom files
  const filesToCommit = files.filter(
    (f) => !existingCustomFiles.includes(f.path),
  );

  // Add workflow files
  const outputs = JSON.parse(config.outputs);
  const languages = JSON.parse(config.sdkLanguages);

  if (outputs.includes("SDK") && languages.includes("typescript")) {
    filesToCommit.push({
      path: ".github/workflows/publish-npm.yml",
      content: generateNpmWorkflow(config.outputDir),
    });
  }

  if (outputs.includes("SDK") && languages.includes("python")) {
    filesToCommit.push({
      path: ".github/workflows/publish-pypi.yml",
      content: generatePyPIWorkflow(config.outputDir),
    });
  }

  // Create branch
  const branchName = `emitkit/run-${runId}`;

  // Get current commit SHA
  const { data: refData } = await githubClient.getOctokit().git.getRef({
    owner: outputOwner,
    repo: outputRepoName,
    ref: `heads/${project.defaultBranch}`,
  });

  await prService.createBranch(
    githubClient,
    outputOwner,
    outputRepoName,
    branchName,
    refData.object.sha,
  );

  // Commit files
  const commitMessage = `chore: emitkit run #${runId} — ${version}`;

  await prService.createCommitWithFiles(
    githubClient,
    outputOwner,
    outputRepoName,
    branchName,
    filesToCommit,
    commitMessage,
  );

  // Create PR
  const prTitle = `Emitkit: Generated SDK v${version}`;
  const prBody = `## Emitkit Generation Run

**Run ID:** ${runId}
**Version:** ${version}
**Outputs:** ${outputs.join(", ")}

### Generated Files
${filesToCommit.map((f) => `- ${f.path}`).join("\n")}

---
*This PR was automatically generated by Emitkit.*
`;

  const prUrl = await prService.createPullRequest(
    githubClient,
    outputOwner,
    outputRepoName,
    prTitle,
    prBody,
    branchName,
    project.defaultBranch,
  );

  return { prUrl, branchName };
}
```

#### 4. Update generation processor

```ts
// apps/worker/src/processors/generation.ts (final update)
// After syntaxCheckAndFormat:

await logStep(runId, "Committing to GitHub...");
const { prUrl, branchName } = await commitOutput(
  project,
  config,
  validatedFiles,
  runId,
  version,
  githubClient,
);

await db
  .update(generationRuns)
  .set({
    status: "success",
    prUrl,
    branchName,
    finishedAt: Date.now(),
  })
  .where(eq(generationRuns.id, runId));

await logStep(runId, `PR created: ${prUrl}`);
await logStep(runId, "[DONE]");
```

#### 5. Webhook handler

```ts
// apps/server/src/routes/webhook.ts
import { Hono } from "hono";
import { verifyWebhookSignature } from "@Emitkit/github/webhook";
import { db } from "@Emitkit/db";
import { projects } from "@Emitkit/db/schema/projects";
import { createRun, enqueueGenerationJob } from "@Emitkit/api/services/runs";
import { getLatestConfig } from "@Emitkit/api/services/config";
import { decrypt } from "@Emitkit/auth/crypto";

const app = new Hono();

app.post("/github", async (c) => {
  const signature = c.req.header("x-hub-signature-256");
  const body = await c.req.text();

  if (!signature) {
    return c.json({ error: "Missing signature" }, 401);
  }

  const payload = JSON.parse(body);

  // Find project by repo
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.repoFullName, payload.repository.full_name));

  if (!project) {
    return c.json({ error: "Unknown repository" }, 404);
  }

  // Verify signature
  const secret = decrypt(project.webhookSecret);
  const isValid = verifyWebhookSignature(body, signature, secret);

  if (!isValid) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  // Handle push event
  if (payload.event === "push") {
    const changedFiles = payload.commits?.flatMap((c: any) => [
      ...c.added,
      ...c.modified,
    ]) || [];

    if (changedFiles.includes(project.specPath)) {
      const config = await getLatestConfig(project.id);
      const run = await createRun(project.id, config.id, "webhook");
      await enqueueGenerationJob(run.id);
    }
  }

  // Handle PR merged event
  if (
    payload.event === "pull_request" &&
    payload.action === "closed" &&
    payload.pull_request.merged &&
    payload.pull_request.head.ref.startsWith("emitkit/")
  ) {
    // Extract run ID from branch name
    const runId = payload.pull_request.head.ref.replace("emitkit/run-", "");

    // Create tags
    const [run] = await db
      .select()
      .from(generationRuns)
      .where(eq(generationRuns.id, runId));

    if (run?.sdkVersion) {
      const [owner, repo] = project.repoFullName.split("/");
      const githubClient = /* get client */;

      await createTag(
        githubClient,
        owner,
        repo,
        `sdk/v${run.sdkVersion}`,
        payload.pull_request.merge_commit_sha
      );

      // Check if MCP was generated
      const config = await getLatestConfig(project.id);
      const outputs = JSON.parse(config.outputs);

      if (outputs.includes("MCP")) {
        await createTag(
          githubClient,
          owner,
          repo,
          `mcp/v${run.sdkVersion}`,
          payload.pull_request.merge_commit_sha
        );
      }
    }
  }

  return c.json({ success: true });
});

export default app;
```

### Frontend Implementation

Update run detail page to show PR URL and branch name.

### Unit Tests

Test GitHub PR service functions, workflow generators, commit logic.

### Integration Tests

Full pipeline: generate, commit, create PR, verify webhook triggers new run.

### E2E Tests

```ts
test("complete generation with PR", async ({ page }) => {
  await page.goto("/projects/test-id");
  await page.click('button:has-text("Trigger Generation")');

  // Wait for completion
  await page.waitForSelector("text=Success");

  // Navigate to run detail
  await page.click("text=Run");

  // Verify PR link
  await expect(page.locator('a:has-text("View PR")')).toBeVisible();
});
```

### Demo

- Trigger generation
- Watch worker commit files to GitHub
- See PR created (show in GitHub UI)
- Merge PR and verify Git tags created
- Push to spec file and see webhook trigger new run

---

## Phase 7: Frontend Polish & Spec Editor

### Objective

Complete the frontend with versions tab, spec editor with live validation, and UI polish.

### Backend Implementation

#### 1. Versions service & procedures

```ts
// packages/api/src/routers/versions.ts
export const versionsRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      await verifyOrgMembership(ctx.user.id, project.orgId);

      return ctx.db
        .select({
          id: sdkVersions.id,
          version: sdkVersions.version,
          changeType: sdkVersions.changeType,
          changelog: sdkVersions.changelog,
          createdAt: sdkVersions.createdAt,
          runId: sdkVersions.runId,
        })
        .from(sdkVersions)
        .where(eq(sdkVersions.projectId, input.projectId))
        .orderBy(desc(sdkVersions.createdAt));
    }),
});
```

#### 2. Spec service & procedures

```ts
// packages/api/src/services/spec.ts
export async function getSpec(projectId: string, githubClient: GitHubClient) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));

  const [owner, repo] = project.repoFullName.split("/");
  const { content, sha } = await getRepoContent(
    githubClient,
    owner,
    repo,
    project.specPath,
    project.defaultBranch
  );

  const format = project.specPath.endsWith(".json") ? "json" : "yaml";

  return { content, sha, format };
}

export async function saveSpec(
  projectId: string,
  content: string,
  expectedSha: string,
  githubClient: GitHubClient
) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  const [owner, repo] = project.repoFullName.split("/");

  try {
    const octokit = githubClient.getOctokit();
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: project.specPath,
      message: "docs: update openapi spec via Emitkit editor",
      content: Buffer.from(content).toString("base64"),
      sha: expectedSha,
      branch: project.defaultBranch,
    });

    return { commitSha: data.commit.sha };
  } catch (error: any) {
    if (error.status === 409) {
      throw new Error("CONFLICT");
    }
    throw error;
  }
}

// Add to projects router:
spec: router({
  get: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      await verifyOrgMembership(ctx.user.id, project.orgId);
      const githubClient = await getGitHubClientForUser(ctx.user.id);
      return specService.getSpec(input.projectId, githubClient);
    }),

  save: protectedProcedure
    .input(z.object({ projectId: z.string(), content: z.string(), sha: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProject(input.projectId);
      await verifyOrgMembership(ctx.user.id, project.orgId);
      const githubClient = await getGitHubClientForUser(ctx.user.id);
      return specService.saveSpec(input.projectId, input.content, input.sha, githubClient);
    }),
}),
```

### Frontend Implementation

#### 1. Versions tab

```tsx
// apps/web/src/components/projects/versions-tab.tsx
import { useQuery } from "@tanstack/react-query";
import { orpcClient } from "@/lib/orpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@Emitkit/ui/components/table";
import { Badge } from "@Emitkit/ui/components/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

export function VersionsTab({ projectId }: { projectId: string }) {
  const { data: versions } = useQuery({
    queryKey: ["versions", projectId],
    queryFn: () => orpcClient.versions.list({ projectId }),
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!versions?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No versions published yet
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Version</TableHead>
          <TableHead>Change Type</TableHead>
          <TableHead>Run ID</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {versions.map((version) => (
          <>
            <TableRow key={version.id}>
              <TableCell className="font-mono">{version.version}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    version.changeType === "major" ? "destructive" : "default"
                  }
                >
                  {version.changeType}
                </Badge>
              </TableCell>
              <TableCell>
                <Link to={`/runs/${version.runId}`} className="hover:underline">
                  {version.runId.substring(0, 8)}
                </Link>
              </TableCell>
              <TableCell>
                {new Date(version.createdAt).toLocaleDateString()}
              </TableCell>
            </TableRow>
            {expanded.has(version.id) && version.changelog && (
              <TableRow>
                <TableCell colSpan={4} className="bg-muted">
                  <pre className="text-sm">{version.changelog}</pre>
                </TableCell>
              </TableRow>
            )}
          </>
        ))}
      </TableBody>
    </Table>
  );
}
```

#### 2. Spec editor tab

```tsx
// apps/web/src/components/projects/editor-tab.tsx
import { useQuery, useMutation } from "@tanstack/react-query";
import { orpcClient } from "@/lib/orpc";
import { useState, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { json } from "@codemirror/lang-json";
import { Button } from "@Emitkit/ui/components/button";
import { Alert, AlertDescription } from "@Emitkit/ui/components/alert";
import SwaggerParser from "@apidevtools/swagger-parser";
import { useDebounce } from "@/hooks/use-debounce";

export function EditorTab({ projectId }: { projectId: string }) {
  const { data: spec } = useQuery({
    queryKey: ["spec", projectId],
    queryFn: () => orpcClient.projects.spec.get({ projectId }),
  });

  const [content, setContent] = useState(spec?.content || "");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const debouncedContent = useDebounce(content, 800);

  useEffect(() => {
    if (spec?.content) {
      setContent(spec.content);
    }
  }, [spec?.content]);

  useEffect(() => {
    if (debouncedContent && debouncedContent !== spec?.content) {
      validateSpec(debouncedContent);
    }
  }, [debouncedContent]);

  async function validateSpec(specContent: string) {
    try {
      await SwaggerParser.validate(specContent);
      setValidationErrors([]);
    } catch (error: any) {
      setValidationErrors([error.message]);
    }
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      orpcClient.projects.spec.save({
        projectId,
        content,
        sha: spec!.sha,
      }),
    onSuccess: () => {
      setIsDirty(false);
      // Show toast
    },
    onError: (error: any) => {
      if (error.message === "CONFLICT") {
        alert("Spec was updated externally. Please reload.");
      }
    },
  });

  const saveAndGenerateMutation = useMutation({
    mutationFn: async () => {
      await saveMutation.mutateAsync();
      return orpcClient.projects.runs.trigger({ projectId });
    },
  });

  const extension = spec?.format === "json" ? json() : yaml();

  return (
    <div>
      <div className="flex justify-end gap-2 mb-4">
        <Button onClick={() => saveMutation.mutate()} disabled={!isDirty}>
          Save
        </Button>
        <Button
          onClick={() => saveAndGenerateMutation.mutate()}
          disabled={!isDirty}
        >
          Save & Generate
        </Button>
      </div>

      {validationErrors.length > 0 ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            ✗ {validationErrors.length} error(s)
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="mb-4">
          <AlertDescription>✓ Valid OpenAPI spec</AlertDescription>
        </Alert>
      )}

      <CodeMirror
        value={content}
        height="600px"
        extensions={[extension]}
        onChange={(value) => {
          setContent(value);
          setIsDirty(value !== spec?.content);
        }}
      />
    </div>
  );
}
```

### E2E Tests

```ts
test("edit spec in browser", async ({ page }) => {
  await page.goto("/projects/test-id");
  await page.click('button:has-text("Editor")');

  await page.fill(
    ".cm-content",
    "openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}",
  );

  await expect(page.locator("text=✓ Valid")).toBeVisible();

  await page.click('button:has-text("Save")');
  await expect(page.locator("text=Saved")).toBeVisible();
});
```

### Demo

- View versions list with changelogs
- Edit spec in browser with live validation
- Save spec and trigger generation
- Show responsive design and dark mode

---

## Summary

This 7-phase implementation plan delivers **Emitkit** incrementally:

### Phase Outcomes

| Phase       | Deliverable              | Key Features                                                          |
| ----------- | ------------------------ | --------------------------------------------------------------------- |
| **Phase 0** | Testing Infrastructure   | Vitest + Playwright setup, test utilities, smoke tests                |
| **Phase 1** | GitHub OAuth & Orgs      | GitHub authentication, organization management, encrypted tokens      |
| **Phase 2** | Project Management       | Connect/create repos, webhook registration, project CRUD              |
| **Phase 3** | Configuration & Triggers | Output configuration, manual run triggers, BullMQ queue setup         |
| **Phase 4** | Core Pipeline            | Worker process, spec fetching/parsing, version calculation, live logs |
| **Phase 5** | Code Generation          | All generators (TS/Python SDK, CLI, MCP, Docs), syntax checking       |
| **Phase 6** | GitHub Integration       | Commit files, create PRs, workflow generation, webhook handling       |
| **Phase 7** | Frontend Polish          | Versions tab, spec editor, dark mode, responsive design               |

### Test Coverage

Each phase includes:

- ✅ **Unit tests** (Vitest) - Individual functions and components
- ✅ **Integration tests** (Vitest) - Multi-component flows with database
- ✅ **E2E tests** (Playwright) - Full user workflows in browser

### Key Technical Decisions

1. **Monorepo structure** preserved from better-t-stack
2. **BullMQ + Redis** for async job processing with separate worker process
3. **SSE over Redis pub/sub** for real-time log streaming
4. **Optimistic concurrency** (SHA-based) for spec editing
5. **Custom file protection** via `skipIfExists` flag
6. **Syntax checking in temp dirs** before committing
7. **GitHub Actions** for publishing (not Emitkit-managed credentials)
8. **Encrypted storage** for tokens/API keys (AES-256-GCM)

### Development Workflow

```bash
# Start all services
bun run dev           # Web + Server + Worker

# Run tests
bun test              # All unit + integration tests
bun test:e2e          # Playwright E2E tests
bun test:coverage     # Coverage report

# Database
bun run db:push       # Apply schema changes
bun run db:studio     # View data
```

### Next Steps After Completion

1. Deploy to production (separate Redis, worker instances)
2. Add monitoring (Sentry, logging, metrics)
3. Implement rate limiting per organization
4. Add email/Slack notifications for run completions
5. Support additional SDK languages (Go, Ruby, Java)
6. Build public API for external integrations

---

**Total Estimated Timeline:** 6-8 weeks (1 week per phase + buffer)

Each phase is independently demoable and deployable, allowing for incremental value delivery and early feedback loops.

---
