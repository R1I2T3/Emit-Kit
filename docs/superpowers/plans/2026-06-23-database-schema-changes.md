# Database Schema Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `project_configs`, `generation_runs`, and `sdk_versions` tables in the database schema, export them, and generate and apply Drizzle migrations.

**Architecture:** Create new schema files for each of the three tables inside `packages/db/src/schema`, export them in `packages/db/src/schema/index.ts`, run drizzle-kit to generate migrations, apply migrations, and verify correctness.

**Tech Stack:** Drizzle ORM, SQLite (via Turso/libsql), Bun.

---

### Task 1: Create `project_configs` table schema
**Files:**
- Create: [packages/db/src/schema/configs.ts](file:///home/ritesh/workspace/Emit-Kit/packages/db/src/schema/configs.ts)

- [ ] **Step 1: Write `project_configs` schema**
  Implement the table schema exactly as requested:
  ```typescript
  import { sql } from "drizzle-orm";
  import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
  import { projects } from "./projects";

  export const projectConfigs = sqliteTable("project_configs", {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    outputs: text("outputs").notNull(), // JSON array of output types e.g. ['SDK', 'CLI', 'MCP', 'DOCS']
    sdkLanguages: text("sdk_languages").notNull(), // JSON array of languages e.g. ['typescript', 'python']
    outputDir: text("output_dir").notNull().default(".emitkit/"),
    sdkNpmScope: text("sdk_npm_scope"),
    sdkPypiName: text("sdk_pypi_name"),
    sdkVersionStrategy: text("sdk_version_strategy").notNull().default("emitkit-managed"),
    geminiApiKey: text("gemini_api_key"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  });
  ```

---

### Task 2: Create `generation_runs` table schema
**Files:**
- Create: [packages/db/src/schema/runs.ts](file:///home/ritesh/workspace/Emit-Kit/packages/db/src/schema/runs.ts)

- [ ] **Step 1: Write `generation_runs` schema**
  Implement the table schema:
  ```typescript
  import { sql } from "drizzle-orm";
  import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
  import { projects } from "./projects";
  import { projectConfigs } from "./configs";

  export const generationRuns = sqliteTable("generation_runs", {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    configId: text("config_id")
      .notNull()
      .references(() => projectConfigs.id),
    triggeredBy: text("triggered_by", { enum: ["manual", "webhook"] }).notNull(),
    status: text("status", { enum: ["queued", "running", "success", "failed"] })
      .notNull()
      .default("queued"),
    commitSha: text("commit_sha"),
    specSnapshot: text("spec_snapshot"),
    sdkVersion: text("sdk_version"),
    branchName: text("branch_name"),
    prUrl: text("pr_url"),
    logs: text("logs").default("").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  });
  ```

---

### Task 3: Create `sdk_versions` table schema
**Files:**
- Create: [packages/db/src/schema/versions.ts](file:///home/ritesh/workspace/Emit-Kit/packages/db/src/schema/versions.ts)

- [ ] **Step 1: Write `sdk_versions` schema**
  Implement the table schema:
  ```typescript
  import { sql } from "drizzle-orm";
  import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
  import { projects } from "./projects";
  import { generationRuns } from "./runs";

  export const sdkVersions = sqliteTable("sdk_versions", {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    runId: text("run_id")
      .notNull()
      .references(() => generationRuns.id),
    changeType: text("change_type", { enum: ["major", "minor", "patch"] }).notNull(),
    changelog: text("changelog"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  });
  ```

---

### Task 4: Export schemas from index file
**Files:**
- Modify: [packages/db/src/schema/index.ts](file:///home/ritesh/workspace/Emit-Kit/packages/db/src/schema/index.ts)

- [ ] **Step 1: Update index file exports**
  Append the export statements to export the new schemas:
  ```typescript
  export * from "./configs";
  export * from "./runs";
  export * from "./versions";
  ```

---

### Task 5: Generate and apply migrations, and verify baseline tests
**Files:**
- Modify: Automatically generated migrations under [packages/db/src/migrations/](file:///home/ritesh/workspace/Emit-Kit/packages/db/src/migrations/)

- [ ] **Step 1: Generate Drizzle migrations**
  Run `bun run db:generate` in the `packages/db` directory or `bun run db:generate` in the workspace root.
  Verify a new SQL file is created in `packages/db/src/migrations`.

- [ ] **Step 2: Run baseline tests to verify nothing is broken**
  Run `bun run test -- --force` in the workspace root.
  Verify that all tests pass.
