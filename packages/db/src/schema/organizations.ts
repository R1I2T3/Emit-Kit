import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const organizations = sqliteTable(
  "organizations",
  {
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
    isPersonal: integer("is_personal", { mode: "boolean" }).default(false).notNull(),
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("organizations_ownerUserId_idx").on(table.ownerUserId),
  ],
);

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
