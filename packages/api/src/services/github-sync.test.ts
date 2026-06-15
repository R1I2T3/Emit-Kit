import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncGitHubOrgsForUser } from "./github-sync";
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

let testDb: any;

vi.mock("@Emitkit/db", () => {
  return {
    get db() {
      return testDb;
    },
  };
});

const mockListForAuthenticatedUser = vi.fn();

vi.mock("@octokit/rest", () => {
  return {
    Octokit: vi.fn().mockImplementation(() => {
      return {
        orgs: {
          listForAuthenticatedUser: mockListForAuthenticatedUser,
        },
      };
    }),
  };
});

vi.mock("@Emitkit/auth/crypto", () => {
  return {
    encrypt: (text: string) => `encrypted:${text}`,
  };
});

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

describe("github-sync service", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
    // Seed users to satisfy foreign key constraints
    await testDb.insert(user).values([
      { id: "user-1", name: "User 1", email: "user1@example.com", githubId: "gh-1" },
      { id: "user-2", name: "User 2", email: "user2@example.com", githubId: "gh-2" },
    ]);
    vi.clearAllMocks();
  });

  it("should sync organizations and memberships for a user", async () => {
    mockListForAuthenticatedUser.mockResolvedValue({
      data: [
        {
          id: 12345,
          login: "My-Org",
          role: "admin",
        },
        {
          id: 67890,
          login: "Other-Org",
          role: "member",
        },
      ],
    });

    const encryptedToken = await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

    expect(encryptedToken).toBe("encrypted:gh-token-abc");

    // Check orgs were created
    const orgs = await testDb.select().from(organizations);
    expect(orgs.length).toBe(2);

    const myOrg = orgs.find((o: any) => o.githubOrgId === "12345");
    expect(myOrg).toBeDefined();
    expect(myOrg.name).toBe("My-Org");
    expect(myOrg.slug).toBe("my-org");

    const otherOrg = orgs.find((o: any) => o.githubOrgId === "67890");
    expect(otherOrg).toBeDefined();
    expect(otherOrg.name).toBe("Other-Org");
    expect(otherOrg.slug).toBe("other-org");

    // Check memberships
    const memberships = await testDb.select().from(organizationMembers);
    expect(memberships.length).toBe(2);

    const myOrgMember = memberships.find((m: any) => m.orgId === myOrg.id);
    expect(myOrgMember).toBeDefined();
    expect(myOrgMember.userId).toBe("user-1");
    expect(myOrgMember.role).toBe("owner");

    const otherOrgMember = memberships.find((m: any) => m.orgId === otherOrg.id);
    expect(otherOrgMember).toBeDefined();
    expect(otherOrgMember.userId).toBe("user-1");
    expect(otherOrgMember.role).toBe("member");
  });

  it("should not duplicate organizations but should update/create new membership if org exists", async () => {
    // Seed existing organization
    await testDb.insert(organizations).values({
      id: "existing-org-uuid",
      githubOrgId: "12345",
      name: "Old Name",
      slug: "old-name",
    });

    mockListForAuthenticatedUser.mockResolvedValue({
      data: [
        {
          id: 12345,
          login: "My-Org",
          role: "admin",
        },
      ],
    });

    await syncGitHubOrgsForUser("user-2", "gh-token-abc", testDb);

    // Organization count should still be 1
    const orgs = await testDb.select().from(organizations);
    expect(orgs.length).toBe(1);
    expect(orgs[0].id).toBe("existing-org-uuid");

    // Membership should be created for user-2
    const memberships = await testDb.select().from(organizationMembers);
    expect(memberships.length).toBe(1);
    expect(memberships[0].orgId).toBe("existing-org-uuid");
    expect(memberships[0].userId).toBe("user-2");
    expect(memberships[0].role).toBe("owner");
  });
});
