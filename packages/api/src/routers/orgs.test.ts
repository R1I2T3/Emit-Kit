import { describe, it, expect, beforeEach } from "vitest";
import { orgsRouter } from "./orgs";
import { call } from "@orpc/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@Emitkit/db/schema";
import { migrate } from "drizzle-orm/libsql/migrator";
import { organizations, organizationMembers, user } from "@Emitkit/db/schema";
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

describe("orgsRouter", () => {
  let db: any;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("should list user's organizations", async () => {
    // Seed users
    await db.insert(user).values([
      { id: "user-1", name: "User 1", email: "user1@example.com", githubId: "gh-1" },
      { id: "user-2", name: "User 2", email: "user2@example.com", githubId: "gh-2" },
    ]);

    // Seed orgs
    await db.insert(organizations).values([
      { id: "org-1", githubOrgId: "100", name: "Org 1", slug: "org-1" },
      { id: "org-2", githubOrgId: "200", name: "Org 2", slug: "org-2" },
      { id: "org-3", githubOrgId: "300", name: "Org 3", slug: "org-3" },
    ]);

    // Seed memberships (user-1 is member of org-1 and org-3)
    await db.insert(organizationMembers).values([
      { orgId: "org-1", userId: "user-1", role: "owner" },
      { orgId: "org-3", userId: "user-1", role: "member" },
      { orgId: "org-2", userId: "user-2", role: "owner" },
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
    expect(result.map((o: any) => o.id)).toContain("org-1");
    expect(result.map((o: any) => o.id)).toContain("org-3");
    expect(result.map((o: any) => o.id)).not.toContain("org-2");
  });

  it("should get specific organization details with memberCount", async () => {
    // Seed users
    await db.insert(user).values([
      { id: "user-1", name: "User 1", email: "user1@example.com", githubId: "gh-1" },
      { id: "user-2", name: "User 2", email: "user2@example.com", githubId: "gh-2" },
    ]);

    await db.insert(organizations).values({
      id: "org-1",
      githubOrgId: "100",
      name: "Org 1",
      slug: "org-1",
    });

    await db.insert(organizationMembers).values([
      { orgId: "org-1", userId: "user-1", role: "owner" },
      { orgId: "org-1", userId: "user-2", role: "member" },
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

    const result = await call(orgsRouter.get, { orgId: "org-1" }, { context });

    expect(result).toBeDefined();
    expect(result.id).toBe("org-1");
    expect(result.name).toBe("Org 1");
    expect(result.memberCount).toBe(2);
  });

  it("should throw UNAUTHORIZED if not logged in", async () => {
    const context = {
      db,
      session: null,
    };

    await expect(
      call(orgsRouter.list, undefined, { context }),
    ).rejects.toThrow();
  });

  it("should throw FORBIDDEN if user is not a member of the organization", async () => {
    // Seed users
    await db.insert(user).values([
      { id: "user-1", name: "User 1", email: "user1@example.com", githubId: "gh-1" },
      { id: "user-2", name: "User 2", email: "user2@example.com", githubId: "gh-2" },
    ]);

    await db.insert(organizations).values({
      id: "org-1",
      githubOrgId: "100",
      name: "Org 1",
      slug: "org-1",
    });

    // user-1 is not a member (org is empty or only other users are members)
    await db.insert(organizationMembers).values({
      orgId: "org-1",
      userId: "user-2",
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

    try {
      await call(orgsRouter.get, { orgId: "org-1" }, { context });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });

  it("should throw FORBIDDEN if organization does not exist", async () => {
    // User is part of no orgs
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

    try {
      await call(orgsRouter.get, { orgId: "non-existent" }, { context });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });

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
});

