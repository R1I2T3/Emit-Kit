import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";
import { organizations } from "./organizations";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    repoFullName: text("repo_full_name").notNull(),
    specPath: text("spec_path").notNull(),
    defaultBranch: text("default_branch").notNull().default("main"),
    outputMode: text("output_mode", { enum: ["append", "separate"] })
      .notNull()
      .default("append"),
    outputRepoFullName: text("output_repo_full_name"),
    webhookId: integer("webhook_id"),
    webhookSecret: text("webhook_secret"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    uniqueOrgRepo: unique("uniqueOrgRepo").on(table.orgId, table.repoFullName),
  }),
);
