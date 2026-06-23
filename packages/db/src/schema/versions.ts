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
