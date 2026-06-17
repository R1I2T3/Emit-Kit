# Personal Workspace Design Spec

**Date**: 2026-06-17
**Status**: Approved

## Problem

Users who are not part of any GitHub Organization cannot use Emitkit. After login, the org switcher shows "No organizations" and the dashboard is empty/useless. Users should be able to work with their personal GitHub repositories without needing an org.

## Solution

Treat the user's personal GitHub account as another workspace in the existing `organizations` table. The org switcher shows `[Personal Account]` + `[Org 1]` + `[Org 2]`, and selecting the personal account shows an adapted dashboard with repository count instead of member count.

## Design Decisions

- **Unified model**: Personal workspaces are rows in the `organizations` table with `isPersonal=true`, not a separate table. This minimizes code changes and mirrors GitHub's own internal model.
- **Adapted dashboard cards**: Personal workspace shows "Repositories" count, "Workspace Slug", and "GitHub User ID" instead of "Members", "Workspace Slug", and "GitHub Org ID".
- **Personal workspace sorted first**: In the switcher dropdown, the personal workspace always appears at the top.

---

## Database Changes

### `organizations` table — add 2 columns

| Column | Type | Default | Nullable | Notes |
|--------|------|---------|----------|-------|
| `is_personal` | `integer` (boolean) | `false` | NOT NULL | Flags personal workspaces |
| `owner_user_id` | `text` | — | YES | FK → `user.id`, CASCADE on delete. Only set for personal workspaces. |

The `githubOrgId` column (already unique) stores the user's GitHub user ID for personal workspaces — this naturally prevents duplicates since a user can only have one personal workspace.

### Migration

A new Drizzle migration adds the two columns. No data migration needed — existing org rows get `isPersonal=false` and `ownerUserId=null` by default.

---

## Backend Changes

### 1. `packages/db/src/schema/organizations.ts`

Add the two new columns to the `organizations` schema:

```ts
isPersonal: integer("is_personal", { mode: "boolean" }).default(false).notNull(),
ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "cascade" }),
```

### 2. `packages/api/src/services/github-sync.ts`

After the existing org sync loop, add personal workspace creation:

```
1. Get authenticated GitHub user profile via octokit.users.getAuthenticated()
2. Check if organizations row exists WHERE isPersonal=true AND ownerUserId=userId
3. If not exists:
   a. Create organizations row with:
      - id: randomUUID()
      - githubOrgId: String(githubUser.id)
      - name: githubUser.login
      - slug: githubUser.login.toLowerCase()
      - isPersonal: true
      - ownerUserId: userId
   b. Create organizationMembers row with role="owner"
4. If exists: no-op (personal workspace already created)
```

The personal workspace creation should happen **before** the org sync loop so the user always has at least one workspace available even if the org sync fails.

### 3. `packages/api/src/routers/orgs.ts`

**`list` endpoint**: Add `isPersonal` to the select fields. Sort results so personal workspace appears first.

```ts
.select({
  id: organizations.id,
  name: organizations.name,
  slug: organizations.slug,
  githubOrgId: organizations.githubOrgId,
  isPersonal: organizations.isPersonal,  // NEW
})
```

**`get` endpoint**: Return `isPersonal` flag. For personal workspaces, skip member count and instead return a placeholder `repoCount: null` (actual repo count will be a future enhancement or fetched client-side).

Actually, to keep it simple for now: always return `memberCount` (which will be 1 for personal workspaces) and also return `isPersonal`. The frontend uses `isPersonal` to decide card labels. This avoids needing a GitHub API call on every dashboard load.

Updated return shape:
```ts
{ ...org, memberCount, isPersonal }
```

---

## Frontend Changes

### 1. `apps/web/src/components/layout/org-switcher.tsx`

- Import `User` icon from lucide-react alongside `Building2`
- For items where `isPersonal === true`:
  - Show `User` icon instead of initials badge
  - Append a subtle "(Personal)" label or badge
- Sort: personal workspace first, then orgs alphabetically

### 2. `apps/web/src/routes/_auth/dashboard.tsx`

When `org.isPersonal` is true, adapt the 3 stats cards:

| Card | Org Dashboard | Personal Dashboard |
|------|---------------|-------------------|
| Card 1 | Members (count) | Repositories (member count shows 1, label changes) |
| Card 2 | Workspace Slug | Workspace Slug (unchanged) |
| Card 3 | GitHub Org ID | GitHub User ID (same data, different label) |

Specifically:
- Card 1: Icon changes from `Users` to `GitBranch`/`BookOpen`, label "Repositories" (for now show memberCount which is 1; repo count is a future enhancement)
- Card 3: Label changes from "GitHub Org ID" to "GitHub User ID"
- Header icon: `User` instead of `Building2`

### 3. `apps/web/src/routes/_auth/route.tsx`

No changes needed. The `OrgContext` and auto-select-first logic works unchanged since personal workspaces appear in the same `orgs.list` response.

---

## Testing

### Unit Tests (`packages/api/src/services/github-sync.test.ts`)

- Test that personal workspace is created on first sync
- Test that personal workspace is not duplicated on subsequent syncs
- Test that personal workspace is created even if user has zero org memberships

### Unit Tests (`packages/api/src/routers/orgs.test.ts`)

- Test that `list` returns personal workspace with `isPersonal: true`
- Test that `get` returns `isPersonal` flag
- Test that personal workspace appears in results even with no org memberships

### E2E

- Existing org switcher E2E tests should continue to pass
- Personal workspace should appear in switcher after login

---

## Scope Boundaries

**In scope**:
- Database schema changes (2 columns)
- Personal workspace auto-creation during GitHub sync
- Org switcher UI adaptation
- Dashboard card label adaptation
- Tests for all of the above

**Out of scope (future work)**:
- Fetching actual personal repository count from GitHub API
- Listing/managing individual repositories within a workspace
- Personal workspace settings page
