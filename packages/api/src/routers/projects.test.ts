import { describe, it, expect, vi, beforeEach } from "vitest";
import { projectsRouter } from "./projects";
import { call } from "@orpc/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@Emitkit/db/schema";
import { migrate } from "drizzle-orm/libsql/migrator";
import { organizations, organizationMembers, projects, account, user } from "@Emitkit/db/schema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockCreateFromExistingRepo = vi.fn();
const mockCreateNewRepo = vi.fn();
const mockDeleteProject = vi.fn();

vi.mock("../services/projects", () => {
  return {
    createFromExistingRepo: (...args: any[]) => mockCreateFromExistingRepo(...args),
    createNewRepo: (...args: any[]) => mockCreateNewRepo(...args),
    deleteProject: (...args: any[]) => mockDeleteProject(...args),
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

describe("projectsRouter", () => {
  let db: any;

  beforeEach(async () => {
    db = await createTestDb();
    vi.clearAllMocks();

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
  });

  it("list returns projects for user's organization", async () => {
    // Seed projects
    await db.insert(projects).values([
      { id: "p-1", orgId: "org-1", repoFullName: "o/r1", specPath: "o.yaml", defaultBranch: "main" },
      { id: "p-2", orgId: "org-2", repoFullName: "o/r2", specPath: "o.yaml", defaultBranch: "main" },
    ]);

    const context = {
      db,
      session: {
        user: { id: "user-1", email: "user1@example.com" },
      },
    };

    const result = await call(projectsRouter.list, { orgId: "org-1" }, { context });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p-1");
  });

  it("list throws FORBIDDEN if user is not member of organization", async () => {
    const context = {
      db,
      session: {
        user: { id: "user-1", email: "user1@example.com" },
      },
    };

    await expect(
      call(projectsRouter.list, { orgId: "org-2" }, { context }),
    ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("get returns a project and verifies membership", async () => {
    await db.insert(projects).values({
      id: "p-1",
      orgId: "org-1",
      repoFullName: "o/r1",
      specPath: "o.yaml",
      defaultBranch: "main",
    });

    const context = {
      db,
      session: {
        user: { id: "user-1", email: "user1@example.com" },
      },
    };

    const result = await call(projectsRouter.get, { projectId: "p-1" }, { context });
    expect(result).toBeDefined();
    expect(result.id).toBe("p-1");
  });

  it("get throws FORBIDDEN if project org membership check fails", async () => {
    await db.insert(projects).values({
      id: "p-2",
      orgId: "org-2",
      repoFullName: "o/r2",
      specPath: "o.yaml",
      defaultBranch: "main",
    });

    const context = {
      db,
      session: {
        user: { id: "user-1", email: "user1@example.com" },
      },
    };

    await expect(
      call(projectsRouter.get, { projectId: "p-2" }, { context }),
    ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("createFromExistingRepo invokes the projects service with user's github client", async () => {
    await db.insert(account).values({
      id: "acc-1",
      accountId: "gh-acc-1",
      providerId: "github",
      userId: "user-1",
      accessToken: "gh-access-token",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockCreateFromExistingRepo.mockResolvedValue({ id: "p-1", repoFullName: "owner/repo" });

    const context = {
      db,
      session: {
        user: { id: "user-1", email: "user1@example.com" },
      },
    };

    const result = await call(
      projectsRouter.createFromExistingRepo,
      {
        orgId: "org-1",
        repoFullName: "owner/repo",
        specPath: "openapi.yaml",
        defaultBranch: "main",
      },
      { context }
    );

    expect(mockCreateFromExistingRepo).toHaveBeenCalledWith(
      "org-1",
      "owner/repo",
      "openapi.yaml",
      "main",
      expect.any(Object),
      db
    );
    expect(result.id).toBe("p-1");
  });

  it("createNewRepo invokes projects service with user's github client", async () => {
    await db.insert(account).values({
      id: "acc-1",
      accountId: "gh-acc-1",
      providerId: "github",
      userId: "user-1",
      accessToken: "gh-access-token",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockCreateNewRepo.mockResolvedValue({ id: "p-1", repoFullName: "owner/new-repo" });

    const context = {
      db,
      session: {
        user: { id: "user-1", email: "user1@example.com" },
      },
    };

    const result = await call(
      projectsRouter.createNewRepo,
      {
        orgId: "org-1",
        repoName: "new-repo",
        visibility: "private",
        orgLogin: "owner",
      },
      { context }
    );

    expect(mockCreateNewRepo).toHaveBeenCalledWith(
      "org-1",
      "new-repo",
      "private",
      "owner",
      expect.any(Object),
      db
    );
    expect(result.id).toBe("p-1");
  });

  it("delete deletes the project and verifies membership", async () => {
    await db.insert(projects).values({
      id: "p-1",
      orgId: "org-1",
      repoFullName: "o/r1",
      specPath: "o.yaml",
      defaultBranch: "main",
    });

    const context = {
      db,
      session: {
        user: { id: "user-1", email: "user1@example.com" },
      },
    };

    await call(projectsRouter.delete, { projectId: "p-1" }, { context });
    expect(mockDeleteProject).toHaveBeenCalledWith("p-1", db);
  });
});
