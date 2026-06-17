# Personal Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users without GitHub organization memberships to use Emitkit by auto-creating a personal workspace alongside org workspaces.

**Architecture:** Add `isPersonal` and `ownerUserId` columns to the existing `organizations` table. During GitHub OAuth sync, create a personal workspace row before syncing org workspaces. The frontend adapts the org switcher and dashboard cards based on the `isPersonal` flag.

**Tech Stack:** Drizzle ORM (SQLite), oRPC, Octokit, React, TanStack Query, TanStack Router, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/db/src/schema/organizations.ts` | Modify | Add `isPersonal` and `ownerUserId` columns |
| `packages/db/src/migrations/` | Generate | New migration for schema changes |
| `packages/api/src/services/github-sync.ts` | Modify | Add personal workspace creation before org sync |
| `packages/api/src/services/github-sync.test.ts` | Modify | Add tests for personal workspace sync |
| `packages/api/src/routers/orgs.ts` | Modify | Return `isPersonal` from `list` and `get` endpoints |
| `packages/api/src/routers/orgs.test.ts` | Modify | Add tests for `isPersonal` in responses |
| `apps/web/src/components/layout/org-switcher.tsx` | Modify | Show personal workspace with User icon, sorted first |
| `apps/web/src/routes/_auth/dashboard.tsx` | Modify | Adapt card labels for personal workspaces |

---

### Task 1: Add schema columns to organizations table

**Files:**
- Modify: `packages/db/src/schema/organizations.ts:1-17`

- [ ] **Step 1: Add `isPersonal` and `ownerUserId` columns to organizations schema**

In `packages/db/src/schema/organizations.ts`, add two new columns to the `organizations` table definition:

```ts
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  githubOrgId: text("github_org_id").unique().notNull(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  isPersonal: integer("is_personal", { mode: "boolean" }).default(false).notNull(),
  ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});
```

The `organizationMembers` table below stays unchanged.

- [ ] **Step 2: Generate the Drizzle migration**

Run from the project root:

```bash
bun run db:generate
```

Expected: A new migration file appears in `packages/db/src/migrations/` with ALTER TABLE statements adding `is_personal` and `owner_user_id` columns.

- [ ] **Step 3: Apply migration to local database**

```bash
bun run db:push
```

Expected: Schema pushed successfully with the new columns.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/organizations.ts packages/db/src/migrations/
git commit -m "feat(db): add isPersonal and ownerUserId columns to organizations"
```

---

### Task 2: Add personal workspace creation to github-sync service

**Files:**
- Modify: `packages/api/src/services/github-sync.ts`
- Test: `packages/api/src/services/github-sync.test.ts`

- [ ] **Step 1: Write failing tests for personal workspace sync**

Add these tests to the existing `describe("github-sync service")` block in `packages/api/src/services/github-sync.test.ts`:

First, add a mock for `octokit.users.getAuthenticated` alongside the existing mock. Update the Octokit mock to include `users`:

Replace the existing `vi.mock("@octokit/rest"` block with:

```ts
const mockListForAuthenticatedUser = vi.fn();
const mockGetAuthenticated = vi.fn();

vi.mock("@octokit/rest", () => {
  return {
    Octokit: vi.fn().mockImplementation(() => {
      return {
        orgs: {
          listForAuthenticatedUser: mockListForAuthenticatedUser,
        },
        users: {
          getAuthenticated: mockGetAuthenticated,
        },
      };
    }),
  };
});
```

Add `mockGetAuthenticated.mockResolvedValue(...)` to `beforeEach`:

```ts
beforeEach(async () => {
  testDb = await createTestDb();
  await testDb.insert(user).values([
    { id: "user-1", name: "User 1", email: "user1@example.com", githubId: "gh-1" },
    { id: "user-2", name: "User 2", email: "user2@example.com", githubId: "gh-2" },
  ]);
  vi.clearAllMocks();
  // Default mock for authenticated user
  mockGetAuthenticated.mockResolvedValue({
    data: { id: 99999, login: "testuser" },
  });
});
```

Then add these new test cases:

```ts
it("should create a personal workspace for the user", async () => {
  mockGetAuthenticated.mockResolvedValue({
    data: { id: 11111, login: "PersonalUser" },
  });
  mockListForAuthenticatedUser.mockResolvedValue({ data: [] });

  await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

  const orgs = await testDb.select().from(organizations);
  expect(orgs.length).toBe(1);

  const personalOrg = orgs[0];
  expect(personalOrg.isPersonal).toBe(true);
  expect(personalOrg.ownerUserId).toBe("user-1");
  expect(personalOrg.githubOrgId).toBe("11111");
  expect(personalOrg.name).toBe("PersonalUser");
  expect(personalOrg.slug).toBe("personaluser");

  const memberships = await testDb.select().from(organizationMembers);
  expect(memberships.length).toBe(1);
  expect(memberships[0].orgId).toBe(personalOrg.id);
  expect(memberships[0].userId).toBe("user-1");
  expect(memberships[0].role).toBe("owner");
});

it("should not duplicate personal workspace on subsequent syncs", async () => {
  mockGetAuthenticated.mockResolvedValue({
    data: { id: 11111, login: "PersonalUser" },
  });
  mockListForAuthenticatedUser.mockResolvedValue({ data: [] });

  await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);
  await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

  const orgs = await testDb.select().from(organizations);
  const personalOrgs = orgs.filter((o: any) => o.isPersonal === true);
  expect(personalOrgs.length).toBe(1);
});

it("should create personal workspace even when user has org memberships", async () => {
  mockGetAuthenticated.mockResolvedValue({
    data: { id: 11111, login: "PersonalUser" },
  });
  mockListForAuthenticatedUser.mockResolvedValue({
    data: [{ id: 12345, login: "My-Org", role: "admin" }],
  });

  await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

  const orgs = await testDb.select().from(organizations);
  expect(orgs.length).toBe(2);

  const personalOrg = orgs.find((o: any) => o.isPersonal === true);
  expect(personalOrg).toBeDefined();
  expect(personalOrg.ownerUserId).toBe("user-1");

  const regularOrg = orgs.find((o: any) => o.isPersonal === false);
  expect(regularOrg).toBeDefined();
  expect(regularOrg.name).toBe("My-Org");
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/api && bun run test -- --reporter=verbose src/services/github-sync.test.ts
```

Expected: The 3 new tests FAIL because `syncGitHubOrgsForUser` doesn't create personal workspaces yet, and `isPersonal`/`ownerUserId` columns don't exist in the assertion context.

- [ ] **Step 3: Implement personal workspace creation in github-sync.ts**

Replace the contents of `packages/api/src/services/github-sync.ts` with:

```ts
import { Octokit } from "@octokit/rest";
import { eq, and } from "drizzle-orm";
import { db } from "@Emitkit/db";
import { organizations, organizationMembers } from "@Emitkit/db/schema";
import { encrypt } from "@Emitkit/auth/crypto";
import { randomUUID } from "crypto";

export async function syncGitHubOrgsForUser(
  userId: string,
  accessToken: string,
  database = db,
): Promise<string> {
  const octokit = new Octokit({ auth: accessToken });

  // 1. Create/ensure personal workspace exists
  const { data: ghUser } = await octokit.users.getAuthenticated();
  const personalGithubId = String(ghUser.id);

  const [existingPersonal] = await database
    .select()
    .from(organizations)
    .where(
      and(
        eq(organizations.isPersonal, true),
        eq(organizations.ownerUserId, userId),
      ),
    )
    .limit(1);

  if (!existingPersonal) {
    const personalOrgId = randomUUID();
    await database.insert(organizations).values({
      id: personalOrgId,
      githubOrgId: personalGithubId,
      name: ghUser.login,
      slug: ghUser.login.toLowerCase(),
      isPersonal: true,
      ownerUserId: userId,
    });

    await database
      .insert(organizationMembers)
      .values({
        orgId: personalOrgId,
        userId,
        role: "owner",
      })
      .onConflictDoNothing();
  }

  // 2. Sync GitHub organization workspaces (existing logic)
  const { data: orgs } = await octokit.orgs.listForAuthenticatedUser();

  for (const org of orgs) {
    const githubOrgId = String(org.id);

    const [existingOrg] = await database
      .select()
      .from(organizations)
      .where(eq(organizations.githubOrgId, githubOrgId))
      .limit(1);

    let orgId = existingOrg?.id;

    if (!orgId) {
      orgId = randomUUID();
      await database.insert(organizations).values({
        id: orgId,
        githubOrgId,
        name: org.login,
        slug: org.login.toLowerCase(),
      });
    }

    const role = org.role === "admin" ? "owner" : "member";

    await database
      .insert(organizationMembers)
      .values({
        orgId,
        userId,
        role,
      })
      .onConflictDoNothing();
  }

  return encrypt(accessToken);
}
```

- [ ] **Step 4: Update the existing tests to account for personal workspace**

The existing test "should sync organizations and memberships for a user" now also creates a personal workspace, so the expected org count changes from 2 to 3 and membership count from 2 to 3. Update these assertions in the existing test:

In the test `"should sync organizations and memberships for a user"`:
- Change `expect(orgs.length).toBe(2)` to `expect(orgs.length).toBe(3)` (2 regular + 1 personal)
- Change `expect(memberships.length).toBe(2)` to `expect(memberships.length).toBe(3)` (2 regular + 1 personal)

In the test `"should not duplicate organizations but should update/create new membership if org exists"`:
- Change `expect(orgs.length).toBe(1)` to `expect(orgs.length).toBe(2)` (1 existing + 1 personal)
- Change `expect(memberships.length).toBe(1)` to `expect(memberships.length).toBe(2)` (1 regular + 1 personal)
- Update the membership assertion to filter for non-personal org:
  ```ts
  const regularMemberships = memberships.filter((m: any) => m.orgId === "existing-org-uuid");
  expect(regularMemberships.length).toBe(1);
  expect(regularMemberships[0].orgId).toBe("existing-org-uuid");
  expect(regularMemberships[0].userId).toBe("user-2");
  expect(regularMemberships[0].role).toBe("owner");
  ```

- [ ] **Step 5: Run all github-sync tests to verify they pass**

```bash
cd packages/api && bun run test -- --reporter=verbose src/services/github-sync.test.ts
```

Expected: All 5 tests PASS (2 existing + 3 new).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/services/github-sync.ts packages/api/src/services/github-sync.test.ts
git commit -m "feat(api): create personal workspace during GitHub sync"
```

---

### Task 3: Update orgs router to return isPersonal flag

**Files:**
- Modify: `packages/api/src/routers/orgs.ts`
- Test: `packages/api/src/routers/orgs.test.ts`

- [ ] **Step 1: Write failing tests for isPersonal in router responses**

Add these tests to the existing `describe("orgsRouter")` block in `packages/api/src/routers/orgs.test.ts`:

```ts
it("should return isPersonal flag in list response", async () => {
  await db.insert(user).values([
    { id: "user-1", name: "User 1", email: "user1@example.com", githubId: "gh-1" },
  ]);

  await db.insert(organizations).values([
    { id: "personal-1", githubOrgId: "100", name: "user1", slug: "user1", isPersonal: true, ownerUserId: "user-1" },
    { id: "org-1", githubOrgId: "200", name: "Org 1", slug: "org-1" },
  ]);

  await db.insert(organizationMembers).values([
    { orgId: "personal-1", userId: "user-1", role: "owner" },
    { orgId: "org-1", userId: "user-1", role: "member" },
  ]);

  const context = {
    db,
    session: {
      user: { id: "user-1", email: "user1@example.com" },
      expiresAt: new Date(),
      id: "session-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "user-1",
    },
  };

  const result = await call(orgsRouter.list, undefined, { context });

  expect(result).toHaveLength(2);

  const personal = result.find((o: any) => o.id === "personal-1");
  expect(personal).toBeDefined();
  expect(personal.isPersonal).toBe(true);

  const regular = result.find((o: any) => o.id === "org-1");
  expect(regular).toBeDefined();
  expect(regular.isPersonal).toBe(false);
});

it("should return isPersonal flag in get response", async () => {
  await db.insert(user).values([
    { id: "user-1", name: "User 1", email: "user1@example.com", githubId: "gh-1" },
  ]);

  await db.insert(organizations).values({
    id: "personal-1",
    githubOrgId: "100",
    name: "user1",
    slug: "user1",
    isPersonal: true,
    ownerUserId: "user-1",
  });

  await db.insert(organizationMembers).values({
    orgId: "personal-1",
    userId: "user-1",
    role: "owner",
  });

  const context = {
    db,
    session: {
      user: { id: "user-1", email: "user1@example.com" },
      expiresAt: new Date(),
      id: "session-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "user-1",
    },
  };

  const result = await call(orgsRouter.get, { orgId: "personal-1" }, { context });

  expect(result.isPersonal).toBe(true);
  expect(result.memberCount).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/api && bun run test -- --reporter=verbose src/routers/orgs.test.ts
```

Expected: The 2 new tests FAIL because `isPersonal` is not in the select fields.

- [ ] **Step 3: Update orgs.ts router to include isPersonal**

Replace the contents of `packages/api/src/routers/orgs.ts` with:

```ts
import { z } from "zod";
import { protectedProcedure } from "../index";
import { organizations, organizationMembers } from "@Emitkit/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";

export const orgsRouter = {
  list: protectedProcedure.handler(async ({ context }) => {
    const orgs = await context.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        githubOrgId: organizations.githubOrgId,
        isPersonal: organizations.isPersonal,
      })
      .from(organizations)
      .innerJoin(
        organizationMembers,
        eq(organizations.id, organizationMembers.orgId),
      )
      .where(eq(organizationMembers.userId, context.user.id));

    return orgs;
  }),

  get: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .handler(async ({ context, input }) => {
      // Verify user is member
      const membership = await context.db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.orgId, input.orgId),
            eq(organizationMembers.userId, context.user.id),
          ),
        )
        .limit(1);

      if (!membership.length) {
        throw new ORPCError("FORBIDDEN");
      }

      const [org] = await context.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.orgId))
        .limit(1);

      if (!org) {
        throw new ORPCError("NOT_FOUND");
      }

      // Get member count
      const memberCountResult = await context.db
        .select({ count: sql<number>`count(*)` })
        .from(organizationMembers)
        .where(eq(organizationMembers.orgId, input.orgId));

      return { ...org, memberCount: memberCountResult[0]?.count ?? 0 };
    }),
};
```

- [ ] **Step 4: Run all orgs router tests to verify they pass**

```bash
cd packages/api && bun run test -- --reporter=verbose src/routers/orgs.test.ts
```

Expected: All 6 tests PASS (4 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routers/orgs.ts packages/api/src/routers/orgs.test.ts
git commit -m "feat(api): return isPersonal flag from orgs router"
```

---

### Task 4: Update OrgSwitcher component for personal workspaces

**Files:**
- Modify: `apps/web/src/components/layout/org-switcher.tsx`

- [ ] **Step 1: Update OrgSwitcher to show personal workspace with User icon and sort it first**

Replace the contents of `apps/web/src/components/layout/org-switcher.tsx` with:

```tsx
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@Emitkit/ui/components/select";
import { Skeleton } from "@Emitkit/ui/components/skeleton";
import { Building2, User } from "lucide-react";
import { useMemo } from "react";

interface OrgSwitcherProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function OrgSwitcher({ value, onValueChange }: OrgSwitcherProps) {
  const { data: orgs, isLoading, isError } = useQuery(orpc.orgs.list.queryOptions());

  // Sort: personal workspace first, then orgs alphabetically
  const sortedOrgs = useMemo(() => {
    if (!orgs) return [];
    return [...orgs].sort((a, b) => {
      if (a.isPersonal && !b.isPersonal) return -1;
      if (!a.isPersonal && b.isPersonal) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [orgs]);

  if (isLoading) {
    return (
      <div className="flex h-12 w-full items-center gap-3 rounded-xl border border-border/60 bg-background/30 px-3 py-2 backdrop-blur-xs">
        <Skeleton className="size-7 rounded-lg shrink-0" />
        <div className="flex-1 space-y-1 min-w-0">
          <Skeleton className="h-3.5 w-24 rounded-xs" />
          <Skeleton className="h-2.5 w-16 rounded-xs mt-0.5" />
        </div>
      </div>
    );
  }

  const selectedOrg = sortedOrgs.find((org) => org.id === value);

  return (
    <div className="w-full">
      <Select
        value={value}
        onValueChange={(val) => {
          if (val) {
            onValueChange(val);
          }
        }}
      >
        <SelectTrigger className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 backdrop-blur-md px-3 py-2 text-sm shadow-xs transition-all duration-200 hover:bg-accent/10 hover:border-border focus:border-ring focus:ring-1 focus:ring-ring/50 cursor-pointer">
          <div className="flex items-center gap-2.5 text-left min-w-0">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary dark:bg-primary/20 ring-1 ring-primary/20">
              {selectedOrg ? (
                selectedOrg.isPersonal ? (
                  <User className="size-4" />
                ) : (
                  selectedOrg.name.slice(0, 2).toUpperCase()
                )
              ) : (
                <Building2 className="size-4 opacity-70" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs text-foreground truncate leading-none">
                {selectedOrg ? (
                  <span className="flex items-center gap-1.5">
                    {selectedOrg.name}
                    {selectedOrg.isPersonal && (
                      <span className="text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full leading-none">
                        Personal
                      </span>
                    )}
                  </span>
                ) : (
                  <SelectValue placeholder="Select workspace" />
                )}
              </span>
              {selectedOrg?.slug && (
                <span className="text-[10px] text-muted-foreground truncate mt-0.5 leading-none">
                  {selectedOrg.slug}
                </span>
              )}
            </div>
          </div>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          className="rounded-xl border border-border/80 bg-popover/90 backdrop-blur-xl p-1 shadow-lg ring-1 ring-black/5 dark:ring-white/5 animate-in fade-in-50 zoom-in-95 duration-100"
        >
          {isError ? (
            <div className="p-2 text-xs text-destructive text-center font-medium">
              Failed to load workspaces
            </div>
          ) : sortedOrgs.length > 0 ? (
            sortedOrgs.map((org) => (
              <SelectItem
                key={org.id}
                value={org.id}
                className="flex items-center gap-2.5 rounded-lg pl-2.5 pr-8 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
              >
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/20 ring-1 ring-primary/20 text-[10px] font-bold">
                  {org.isPersonal ? (
                    <User className="size-3.5" />
                  ) : (
                    org.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-foreground truncate flex items-center gap-1.5">
                    {org.name}
                    {org.isPersonal && (
                      <span className="text-[8px] font-medium text-muted-foreground bg-muted/60 px-1 py-0.5 rounded-full leading-none">
                        Personal
                      </span>
                    )}
                  </span>
                  {org.slug && (
                    <span className="text-[9px] text-muted-foreground truncate">{org.slug}</span>
                  )}
                </div>
              </SelectItem>
            ))
          ) : (
            <div className="p-2 text-xs text-muted-foreground text-center">
              No workspaces
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
```

Key changes:
- Import `User` icon from lucide-react and `useMemo` from react
- Add `sortedOrgs` memo that sorts personal workspace first
- Use `User` icon for personal workspaces instead of initials
- Add "(Personal)" badge next to the name
- Change placeholder text from "Select organization" to "Select workspace"
- Change empty state from "No organizations" to "No workspaces"
- Change error message from "Failed to load organizations" to "Failed to load workspaces"

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/org-switcher.tsx
git commit -m "feat(web): adapt OrgSwitcher for personal workspaces"
```

---

### Task 5: Update dashboard for personal workspace card labels

**Files:**
- Modify: `apps/web/src/routes/_auth/dashboard.tsx`
- Modify: `apps/web/src/routes/_auth/route.tsx`

- [ ] **Step 1: Update dashboard to adapt card labels based on isPersonal**

In `apps/web/src/routes/_auth/dashboard.tsx`, make the following changes:

First, update the imports — add `User` and `GitFork` from lucide-react:

```ts
import {
  Building2,
  Users,
  Terminal,
  FolderPlus,
  AlertCircle,
  Plus,
  User,
  GitFork,
} from "lucide-react";
```

Then, in the "Premium, modern Dashboard View" return block (line 124 onwards), update the **Header Section** to use `User` icon for personal workspaces:

Replace the header section (lines 127-139):

```tsx
      {/* Header Section */}
      <div className="flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-xl text-white shadow-md ${
          org.isPersonal
            ? "bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-violet-500/20"
            : "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20"
        }`}>
          {org.isPersonal ? <User className="size-5" /> : <Building2 className="size-5" />}
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-b from-foreground to-foreground/80 bg-clip-text text-transparent">
            {org.name}
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            {org.isPersonal ? "Personal Workspace" : "Workspace Dashboard"}
          </p>
        </div>
      </div>
```

Replace Card 1 "Members" (lines 143-157) with a conditional card:

```tsx
        {/* Card 1: Members / Repositories */}
        <Card className="relative overflow-hidden border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-6 shadow-xs hover:shadow-md transition-all duration-300 group">
          {/* Top border glow gradient */}
          <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${
            org.isPersonal
              ? "from-violet-500/40 via-fuchsia-500/40 to-transparent"
              : "from-emerald-500/40 via-teal-500/40 to-transparent"
          } opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {org.isPersonal ? "Repositories" : "Members"}
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">{org.memberCount}</p>
            </div>
            <div className={`flex size-10 items-center justify-center rounded-xl border group-hover:scale-105 transition-transform duration-300 ${
              org.isPersonal
                ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            }`}>
              {org.isPersonal ? <GitFork className="size-5" /> : <Users className="size-5" />}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-4">
            {org.isPersonal ? "Accessible personal repositories" : "Active collaborators in workspace"}
          </p>
        </Card>
```

Replace Card 3 "GitHub Org ID" (lines 176-193) with a conditional card:

```tsx
        {/* Card 3: GitHub Integration */}
        <Card className="relative overflow-hidden border border-border/80 bg-card/40 backdrop-blur-md rounded-2xl p-6 shadow-xs hover:shadow-md transition-all duration-300 group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-pink-500/40 via-purple-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="flex items-center justify-between">
            <div className="space-y-1 min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {org.isPersonal ? "GitHub User ID" : "GitHub Org ID"}
              </p>
              <p className="text-base font-bold text-foreground truncate mt-2" title={org.githubOrgId}>
                {org.githubOrgId}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 group-hover:scale-105 transition-transform duration-300 shrink-0">
              <svg className="size-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-4">
            {org.isPersonal ? "Linked personal account" : "Linked version control provider"}
          </p>
        </Card>
```

- [ ] **Step 2: Update the sidebar label in route.tsx**

In `apps/web/src/routes/_auth/route.tsx`, change the label above the OrgSwitcher from "Organization" to "Workspace" (line 61):

```tsx
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block px-1">
              Workspace
            </label>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_auth/dashboard.tsx apps/web/src/routes/_auth/route.tsx
git commit -m "feat(web): adapt dashboard and sidebar for personal workspaces"
```

---

### Task 6: Run full test suite and verify

**Files:** None (verification only)

- [ ] **Step 1: Run all unit tests**

```bash
cd /home/ritesh/workspace/Emitkit && bun run test
```

Expected: All tests PASS.

- [ ] **Step 2: Run type checking**

```bash
cd /home/ritesh/workspace/Emitkit && bun run check-types
```

Expected: No type errors.

- [ ] **Step 3: Final commit (if any fixes needed)**

If any fixes were required during verification, commit them:

```bash
git add -A
git commit -m "fix: address test/type issues from personal workspace feature"
```
