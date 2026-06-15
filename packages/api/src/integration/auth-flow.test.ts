import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncGitHubOrgsForUser } from "../services/github-sync";
import { createTestDb } from "./test-utils";
import { organizations, organizationMembers, user } from "@Emitkit/db/schema";
import { Octokit } from "@octokit/rest";

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

describe("GitHub OAuth Integration Flow", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
    // Seed test users
    await testDb.insert(user).values([
      { id: "user-1", name: "User 1", email: "user1@example.com", githubId: "gh-1" },
    ]);
    vi.clearAllMocks();
  });

  it("creates user, organizations, and memberships on OAuth callback sync", async () => {
    mockListForAuthenticatedUser.mockResolvedValue({
      data: [
        { id: 12345, login: "Acme-Corp", role: "admin" },
        { id: 67890, login: "Demo-Org", role: "member" },
      ],
    });

    const encryptedToken = await syncGitHubOrgsForUser("user-1", "mock_oauth_access_token", testDb);

    // Assert token is encrypted
    expect(encryptedToken).toBe("encrypted:mock_oauth_access_token");

    // Verify organizations created in SQLite database
    const orgs = await testDb.select().from(organizations);
    expect(orgs.length).toBe(2);

    const acmeOrg = orgs.find((o: any) => o.githubOrgId === "12345");
    expect(acmeOrg).toBeDefined();
    expect(acmeOrg.name).toBe("Acme-Corp");
    expect(acmeOrg.slug).toBe("acme-corp");

    const demoOrg = orgs.find((o: any) => o.githubOrgId === "67890");
    expect(demoOrg).toBeDefined();
    expect(demoOrg.name).toBe("Demo-Org");
    expect(demoOrg.slug).toBe("demo-org");

    // Verify memberships created in SQLite database
    const memberships = await testDb.select().from(organizationMembers);
    expect(memberships.length).toBe(2);

    const acmeMembership = memberships.find((m: any) => m.orgId === acmeOrg.id);
    expect(acmeMembership).toBeDefined();
    expect(acmeMembership.userId).toBe("user-1");
    expect(acmeMembership.role).toBe("owner"); // admin -> owner

    const demoMembership = memberships.find((m: any) => m.orgId === demoOrg.id);
    expect(demoMembership).toBeDefined();
    expect(demoMembership.userId).toBe("user-1");
    expect(demoMembership.role).toBe("member"); // member -> member
  });
});
