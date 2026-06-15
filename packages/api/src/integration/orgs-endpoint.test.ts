import { describe, it, expect, beforeEach } from "vitest";
import { orgsRouter } from "../routers/orgs";
import { call } from "@orpc/server";
import { createTestDb } from "./test-utils";
import { organizations, organizationMembers, user } from "@Emitkit/db/schema";

describe("Orgs Endpoint Integration Tests", () => {
  let db: any;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("returns user's organizations and details correctly", async () => {
    // Seed users
    await db.insert(user).values([
      { id: "user-1", name: "User 1", email: "user1@example.com", githubId: "gh-1" },
      { id: "user-2", name: "User 2", email: "user2@example.com", githubId: "gh-2" },
    ]);

    // Seed 2 orgs
    const org1 = {
      id: "org-1",
      githubOrgId: "1",
      name: "Org 1",
      slug: "org-1",
    };
    const org2 = {
      id: "org-2",
      githubOrgId: "2",
      name: "Org 2",
      slug: "org-2",
    };
    await db.insert(organizations).values([org1, org2]);

    // Seed memberships
    await db.insert(organizationMembers).values([
      { orgId: "org-1", userId: "user-1", role: "owner" },
      { orgId: "org-2", userId: "user-1", role: "member" },
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

    // Test list procedure
    const listResult = await call(orgsRouter.list, undefined, { context });
    expect(listResult).toHaveLength(2);
    expect(listResult.map((o: any) => o.name)).toEqual(["Org 1", "Org 2"]);

    // Test get procedure
    const getResult1 = await call(orgsRouter.get, { orgId: "org-1" }, { context });
    expect(getResult1).toBeDefined();
    expect(getResult1.name).toBe("Org 1");
    expect(getResult1.memberCount).toBe(1);

    const getResult2 = await call(orgsRouter.get, { orgId: "org-2" }, { context });
    expect(getResult2).toBeDefined();
    expect(getResult2.name).toBe("Org 2");
    expect(getResult2.memberCount).toBe(2);
  });
});
