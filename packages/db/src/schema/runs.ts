import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { projects } from "./projects";
import { projectConfigs } from "./configs";

export const generationRuns = sqliteTable(
  "generation_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    configId: text("config_id")
      .notNull()
      .references(() => projectConfigs.id, { onDelete: "cascade" }),
    triggeredBy: text("triggered_by", { enum: ["manual", "webhook"] }).notNull(),
    status: text("status", { enum: ["queued", "running", "success", "failed"] })
      .notNull()
      .default("queued"),
    commitSha: text("commit_sha"),
    specSnapshot: text("spec_snapshot", { mode: "json" }),
    sdkVersion: text("sdk_version"),
    branchName: text("branch_name"),
    prUrl: text("pr_url"),
    logs: text("logs").default("").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    projectIdIdx: index("generation_runs_project_id_idx").on(table.projectId),
    configIdIdx: index("generation_runs_config_id_idx").on(table.configId),
  })
);

