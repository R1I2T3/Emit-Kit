import { describe, it, expect, beforeEach } from "vitest";
import { versionsRouter } from "./versions";
import { call } from "@orpc/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@Emitkit/db/schema";
import { migrate } from "drizzle-orm/libsql/migrator";
import {
  organizations,
  organizationMembers,
  projects,
  user,
  generationRuns,
  sdkVersions,
  projectConfigs,
} from "@Emitkit/db/schema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createTestDb() {
  const client = createClient({ url: "file::memory:" });
  const db = drizzle({ client, schema });

  const paths = [
    path.resolve(process.cwd(), "packages/db/src/migrations"),
    path.resolve(process.cwd(), "db/src/migrations"),
    path.resolve(process.cwd(), "../db/src/migrations"),
    path.resolve(__dirname, "../../../db/src/migrations"),
  ];
  let migrationsFolder = "";
  for (const p of paths) {
    if (fs.existsSync(p)) {
      migrationsFolder = p;
      break;
    }
  }
  if (!migrationsFolder) {
    throw new Error("Could not find migrations folder");
  }

  await migrate(db, { migrationsFolder });
  return db;
}

describe("versionsRouter", () => {
  let db: any;

  beforeEach(async () => {
    db = await createTestDb();

    // Seed users
    await db.insert(user).values([
      { id: "user-1", name: "User 1", email: "user1@example.com", githubId: "gh-1" },
      { id: "user-2", name: "User 2", email: "user2@example.com", githubId: "gh-2" },
    ]);

    // Seed organizations
    await db.insert(organizations).values([
      { id: "org-1", githubOrgId: "100", name: "Org 1", slug: "org-1" },
      { id: "org-2", githubOrgId: "200", name: "Org 2", slug: "org-2" },
    ]);

    // Seed memberships
    await db.insert(organizationMembers).values([
      { orgId: "org-1", userId: "user-1", role: "owner" },
      { orgId: "org-2", userId: "user-2", role: "owner" },
    ]);

    // Seed projects
    await db.insert(projects).values([
      { id: "p-1", orgId: "org-1", repoFullName: "o/r1", specPath: "o.yaml", defaultBranch: "main" },
      { id: "p-2", orgId: "org-2", repoFullName: "o/r2", specPath: "o.yaml", defaultBranch: "main" },
    ]);

    // Seed projectConfig for runs FK constraints
    await db.insert(projectConfigs).values([
      { id: "config-1", projectId: "p-1", outputDir: ".emitkit/", outputs: ["SDK"], sdkLanguages: ["typescript"] },
    ]);

    // Seed runs
    await db.insert(generationRuns).values([
      { id: "run-1", projectId: "p-1", configId: "config-1", status: "success", triggeredBy: "manual" },
      { id: "run-2", projectId: "p-1", configId: "config-1", status: "success", triggeredBy: "manual" },
    ]);
  });

  it("successfully lists versions ordered by createdAt descending", async () => {
    const now = Date.now();
    await db.insert(sdkVersions).values([
      {
        id: "v-1",
        projectId: "p-1",
        version: "1.0.0",
        runId: "run-1",
        changeType: "major",
        changelog: "First release",
        createdAt: new Date(now - 10000), // 10s ago
      },
      {
        id: "v-2",
        projectId: "p-1",
        version: "1.0.1",
        runId: "run-2",
        changeType: "patch",
        changelog: "Fix bug",
        createdAt: new Date(now), // now (latest)
      },
    ]);

    const context = {
      db,
      session: {
        user: { id: "user-1", email: "user1@example.com" },
      },
    };

    const result = await call(versionsRouter.list, { projectId: "p-1" }, { context });

    expect(result).toHaveLength(2);
    // Should be descending by createdAt
    expect(result[0].id).toBe("v-2");
    expect(result[0].version).toBe("1.0.1");
    expect(result[0].changeType).toBe("patch");
    expect(result[0].changelog).toBe("Fix bug");
    expect(result[0].runId).toBe("run-2");

    expect(result[1].id).toBe("v-1");
    expect(result[1].version).toBe("1.0.0");
    expect(result[1].changeType).toBe("major");
    expect(result[1].changelog).toBe("First release");
    expect(result[1].runId).toBe("run-1");

    // Only these fields should be returned: id, version, changeType, changelog, createdAt, runId
    const keys = Object.keys(result[0]).sort();
    expect(keys).toEqual(["changeType", "changelog", "createdAt", "id", "runId", "version"]);
  });

  it("throws NOT_FOUND when the project does not exist", async () => {
    const context = {
      db,
      session: {
        user: { id: "user-1", email: "user1@example.com" },
      },
    };

    try {
      await call(versionsRouter.list, { projectId: "non-existent" }, { context });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.code).toBe("NOT_FOUND");
    }
  });

  it("throws FORBIDDEN when user is not a member of the project's organization", async () => {
    const context = {
      db,
      session: {
        user: { id: "user-1", email: "user1@example.com" },
      },
    };

    // p-2 is in org-2, which user-1 is not a member of
    try {
      await call(versionsRouter.list, { projectId: "p-2" }, { context });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });
});
