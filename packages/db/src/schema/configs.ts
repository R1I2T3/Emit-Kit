import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { projects } from "./projects";

export const projectConfigs = sqliteTable(
  "project_configs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    outputs: text("outputs", { mode: "json" }).$type<("SDK" | "CLI" | "MCP" | "DOCS")[]>().notNull(),
    sdkLanguages: text("sdk_languages", { mode: "json" }).$type<("typescript" | "python")[]>().notNull(),
    outputDir: text("output_dir").notNull().default(".emitkit/"),
    sdkNpmScope: text("sdk_npm_scope"),
    sdkPypiName: text("sdk_pypi_name"),
    sdkVersionStrategy: text("sdk_version_strategy").notNull().default("emitkit-managed"),
    geminiApiKey: text("gemini_api_key"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => ({
    projectIdIdx: index("project_configs_project_id_idx").on(table.projectId),
  })
);

