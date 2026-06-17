import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { syncGitHubOrgsForUser } from "../services/github-sync";
import { organizations, organizationMembers, user } from "@Emitkit/db/schema";
import { Octokit } from "@octokit/rest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@Emitkit/db/schema";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testDb: any;
let dbFile: string | null = null;
let client: any = null;

async function createTestDb() {
  dbFile = `test-integration-${randomUUID()}.db`;
  client = createClient({ url: `file:${dbFile}` });
  const db = drizzle({ client, schema });

  const paths = [
    path.resolve(process.cwd(), "packages/db/src/migrations"),
    path.resolve(process.cwd(), "db/src/migrations"),
    path.resolve(process.cwd(), "../db/src/migrations"),
    path.resolve(__dirname, "../../../../db/src/migrations"),
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

describe("GitHub OAuth Integration Flow", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
    // Seed test users
    await testDb.insert(user).values([
      { id: "user-1", name: "User 1", email: "user1@example.com", githubId: "gh-1" },
    ]);
    vi.clearAllMocks();
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
    expect(orgs.length).toBe(3);

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
    expect(memberships.length).toBe(3);

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
