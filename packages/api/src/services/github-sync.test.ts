import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { syncGitHubOrgsForUser } from "./github-sync";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@Emitkit/db/schema";
import { migrate } from "drizzle-orm/libsql/migrator";
import { organizations, organizationMembers, user } from "@Emitkit/db/schema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testDb: any;
let dbFile: string | null = null;
let client: any = null;

vi.mock("@Emitkit/db", () => {
  return {
    get db() {
      return testDb;
    },
  };
});

const mockListForAuthenticatedUser = vi.fn();
const mockGetAuthenticated = vi.fn();

vi.mock("@octokit/rest", () => {
  return {
    Octokit: vi.fn().mockImplementation(() => {
      return {
        orgs: {
          listForAuthenticatedUser: mockListForAuthenticatedUser,
        },
        users: {
          getAuthenticated: mockGetAuthenticated,
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
  dbFile = `test-${randomUUID()}.db`;
  client = createClient({ url: `file:${dbFile}` });
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
    // Default mock for authenticated user
    mockGetAuthenticated.mockResolvedValue({
      data: { id: 99999, login: "testuser" },
    });
  });

  afterEach(async () => {
    if (client) {
      client.close();
      client = null;
    }
    if (dbFile && fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
      dbFile = null;
    }
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
    expect(orgs.length).toBe(3);

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
    expect(memberships.length).toBe(3);

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

    // Organization count should be 2 (1 existing + 1 personal)
    const orgs = await testDb.select().from(organizations);
    expect(orgs.length).toBe(2);
    expect(orgs.some((o: any) => o.id === "existing-org-uuid")).toBe(true);

    // Membership should be created for user-2 and the personal org
    const memberships = await testDb.select().from(organizationMembers);
    expect(memberships.length).toBe(2);

    const regularMemberships = memberships.filter((m: any) => m.orgId === "existing-org-uuid");
    expect(regularMemberships.length).toBe(1);
    expect(regularMemberships[0].orgId).toBe("existing-org-uuid");
    expect(regularMemberships[0].userId).toBe("user-2");
    expect(regularMemberships[0].role).toBe("owner");
  });

  it("should create a personal workspace for the user", async () => {
    mockGetAuthenticated.mockResolvedValue({
      data: { id: 11111, login: "PersonalUser" },
    });
    mockListForAuthenticatedUser.mockResolvedValue({ data: [] });

    await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

    const orgs = await testDb.select().from(organizations);
    expect(orgs.length).toBe(1);

    const personalOrg = orgs[0];
    expect(personalOrg.isPersonal).toBe(true);
    expect(personalOrg.ownerUserId).toBe("user-1");
    expect(personalOrg.githubOrgId).toBe("11111");
    expect(personalOrg.name).toBe("PersonalUser");
    expect(personalOrg.slug).toBe("personaluser");

    const memberships = await testDb.select().from(organizationMembers);
    expect(memberships.length).toBe(1);
    expect(memberships[0].orgId).toBe(personalOrg.id);
    expect(memberships[0].userId).toBe("user-1");
    expect(memberships[0].role).toBe("owner");
  });

  it("should not duplicate personal workspace on subsequent syncs", async () => {
    mockGetAuthenticated.mockResolvedValue({
      data: { id: 11111, login: "PersonalUser" },
    });
    mockListForAuthenticatedUser.mockResolvedValue({ data: [] });

    await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);
    await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

    const orgs = await testDb.select().from(organizations);
    const personalOrgs = orgs.filter((o: any) => o.isPersonal === true);
    expect(personalOrgs.length).toBe(1);
  });

  it("should create personal workspace even when user has org memberships", async () => {
    mockGetAuthenticated.mockResolvedValue({
      data: { id: 11111, login: "PersonalUser" },
    });
    mockListForAuthenticatedUser.mockResolvedValue({
      data: [{ id: 12345, login: "My-Org", role: "admin" }],
    });

    await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

    const orgs = await testDb.select().from(organizations);
    expect(orgs.length).toBe(2);

    const personalOrg = orgs.find((o: any) => o.isPersonal === true);
    expect(personalOrg).toBeDefined();
    expect(personalOrg.ownerUserId).toBe("user-1");

    const regularOrg = orgs.find((o: any) => o.isPersonal === false);
    expect(regularOrg).toBeDefined();
    expect(regularOrg.name).toBe("My-Org");
  });

  it("should restore user's membership to personal workspace on subsequent syncs if missing", async () => {
    mockGetAuthenticated.mockResolvedValue({
      data: { id: 11111, login: "PersonalUser" },
    });
    mockListForAuthenticatedUser.mockResolvedValue({ data: [] });

    // First sync to create personal workspace and membership
    await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

    // Verify it exists
    const membershipsBefore = await testDb.select().from(organizationMembers);
    expect(membershipsBefore.length).toBe(1);

    // Delete membership
    await testDb.delete(organizationMembers);

    // Second sync
    await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

    // Verify membership is restored
    const membershipsAfter = await testDb.select().from(organizationMembers);
    expect(membershipsAfter.length).toBe(1);
    expect(membershipsAfter[0].userId).toBe("user-1");
  });

  it("should update personal workspace name and slug if user changes their GitHub login", async () => {
    mockGetAuthenticated.mockResolvedValue({
      data: { id: 11111, login: "PersonalUser" },
    });
    mockListForAuthenticatedUser.mockResolvedValue({ data: [] });

    await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

    // User changes username on GitHub
    mockGetAuthenticated.mockResolvedValue({
      data: { id: 11111, login: "NewUsername" },
    });

    await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

    const orgs = await testDb.select().from(organizations);
    expect(orgs.length).toBe(1);
    expect(orgs[0].name).toBe("NewUsername");
    expect(orgs[0].slug).toBe("newusername");
  });

  it("should handle slug collisions by appending a suffix", async () => {
    // Seed an existing organization with the slug "personaluser"
    await testDb.insert(organizations).values({
      id: "another-org-uuid",
      githubOrgId: "99999",
      name: "Existing Org",
      slug: "personaluser",
    });

    mockGetAuthenticated.mockResolvedValue({
      data: { id: 11111, login: "PersonalUser" },
    });
    mockListForAuthenticatedUser.mockResolvedValue({ data: [] });

    await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

    const orgs = await testDb.select().from(organizations);
    // 1 seeded + 1 personal
    expect(orgs.length).toBe(2);

    const personalOrg = orgs.find((o: any) => o.githubOrgId === "11111");
    expect(personalOrg).toBeDefined();
    expect(personalOrg.slug).toBe("personaluser-1");
  });

  it("should update regular org name and slug if they changed on GitHub", async () => {
    mockGetAuthenticated.mockResolvedValue({
      data: { id: 11111, login: "PersonalUser" },
    });
    mockListForAuthenticatedUser.mockResolvedValue({
      data: [{ id: 12345, login: "Old-Name", role: "admin" }],
    });

    await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

    // Org name changes on GitHub
    mockListForAuthenticatedUser.mockResolvedValue({
      data: [{ id: 12345, login: "New-Name", role: "admin" }],
    });

    await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

    const orgs = await testDb.select().from(organizations);
    const regularOrg = orgs.find((o: any) => o.githubOrgId === "12345");
    expect(regularOrg).toBeDefined();
    expect(regularOrg.name).toBe("New-Name");
    expect(regularOrg.slug).toBe("new-name");
  });

  it("should update personal workspace when user links a different GitHub account", async () => {
    mockGetAuthenticated.mockResolvedValue({
      data: { id: 11111, login: "PersonalUser" },
    });
    mockListForAuthenticatedUser.mockResolvedValue({ data: [] });

    await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

    // User links a different GitHub account (different ID and login)
    mockGetAuthenticated.mockResolvedValue({
      data: { id: 22222, login: "BrandNewAccount" },
    });

    await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

    const orgs = await testDb.select().from(organizations);
    expect(orgs.length).toBe(1);
    expect(orgs[0].githubOrgId).toBe("22222");
    expect(orgs[0].name).toBe("BrandNewAccount");
    expect(orgs[0].slug).toBe("brandnewaccount");
  });

  it("should update organization membership role if it changes on GitHub", async () => {
    mockGetAuthenticated.mockResolvedValue({
      data: { id: 11111, login: "PersonalUser" },
    });
    mockListForAuthenticatedUser.mockResolvedValue({
      data: [{ id: 12345, login: "My-Org", role: "member" }],
    });

    // Sync first time - role is member
    await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

    const orgs = await testDb.select().from(organizations);
    const regularOrg = orgs.find((o: any) => o.githubOrgId === "12345");
    expect(regularOrg).toBeDefined();

    const getMembership = async () => {
      const ms = await testDb.select().from(organizationMembers);
      return ms.find((m: any) => m.orgId === regularOrg.id);
    };

    const mBefore = await getMembership();
    expect(mBefore).toBeDefined();
    expect(mBefore.role).toBe("member");

    // Sync second time - role promoted to admin (owner)
    mockListForAuthenticatedUser.mockResolvedValue({
      data: [{ id: 12345, login: "My-Org", role: "admin" }],
    });

    await syncGitHubOrgsForUser("user-1", "gh-token-abc", testDb);

    const mAfter = await getMembership();
    expect(mAfter).toBeDefined();
    expect(mAfter.role).toBe("owner");
  });
});
