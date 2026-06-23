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
