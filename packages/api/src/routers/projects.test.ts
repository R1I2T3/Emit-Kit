import { describe, it, expect, vi, beforeEach } from "vitest";
import { projectsRouter } from "./projects";
import { call } from "@orpc/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "@Emitkit/db/schema";
import { migrate } from "drizzle-orm/libsql/migrator";
import {
  organizations,
  organizationMembers,
  projects,
  account,
  user,
  projectConfigs,
  generationRuns,
} from "@Emitkit/db/schema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockCreateFromExistingRepo = vi.fn();
const mockCreateNewRepo = vi.fn();
const mockDeleteProject = vi.fn();
const mockListUserRepos = vi.fn();

vi.mock("../services/projects", () => {
  return {
    createFromExistingRepo: (...args: any[]) => mockCreateFromExistingRepo(...args),
    createNewRepo: (...args: any[]) => mockCreateNewRepo(...args),
    deleteProject: (...args: any[]) => mockDeleteProject(...args),
  };
});

vi.mock("@Emitkit/github", () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => {
      return {};
    }),
    listUserRepos: (...args: any[]) => mockListUserRepos(...args),
  };
});

const mockAdd = vi.fn();
const mockClose = vi.fn();

vi.mock("@Emitkit/queue", () => {
  return {
    QUEUES: {
      GENERATION: "generation",
    },
    createQueue: vi.fn().mockImplementation(() => {
      return {
        add: mockAdd,
        close: mockClose,
      };
    }),
  };
});

vi.mock("../lib/redis", () => {
  return {
    redis: {
      options: {},
    },
  };
});

vi.mock("@Emitkit/auth/crypto", () => {
  return {
    encrypt: (text: string) => `encrypted:${text}`,
    decrypt: (text: string) => text.replace("encrypted:", ""),
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
    expect(mockDeleteProject).toHaveBeenCalledWith("p-1", expect.any(Object), db);
  });

  it("listGithubRepos calls listUserRepos and returns repository info list", async () => {
    await db.insert(account).values({
      id: "acc-1",
      accountId: "gh-acc-1",
      providerId: "github",
      userId: "user-1",
      accessToken: "gh-access-token",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const expectedRepos = [
      { id: 123, name: "repo-1", owner: "user1", url: "https://github.com/user1/repo-1" },
    ];
    mockListUserRepos.mockResolvedValue(expectedRepos);

    const context = {
      db,
      session: {
        user: { id: "user-1", email: "user1@example.com" },
      },
    };

    const result = await call(projectsRouter.listGithubRepos, {}, { context });
    expect(mockListUserRepos).toHaveBeenCalled();
    expect(result).toEqual(expectedRepos);
  });

  describe("config", () => {
    it("get returns config and redacts api key if present", async () => {
      await db.insert(projects).values({
        id: "p-1",
        orgId: "org-1",
        repoFullName: "o/r1",
        specPath: "o.yaml",
      });

      await db.insert(projectConfigs).values({
        id: "conf-1",
        projectId: "p-1",
        outputs: ["SDK"],
        sdkLanguages: ["typescript"],
        outputDir: ".emitkit/",
        sdkVersionStrategy: "emitkit-managed",
        geminiApiKey: "encrypted:my-secret-key",
      });

      const context = {
        db,
        session: {
          user: { id: "user-1", email: "user1@example.com" },
        },
      };

      const result = await call(projectsRouter.config.get, { projectId: "p-1" }, { context });
      expect(result).toBeDefined();
      expect(result?.id).toBe("conf-1");
      expect(result?.geminiApiKey).toBe("********");
    });

    it("get returns null if no config is found", async () => {
      await db.insert(projects).values({
        id: "p-1",
        orgId: "org-1",
        repoFullName: "o/r1",
        specPath: "o.yaml",
      });

      const context = {
        db,
        session: {
          user: { id: "user-1", email: "user1@example.com" },
        },
      };

      const result = await call(projectsRouter.config.get, { projectId: "p-1" }, { context });
      expect(result).toBeNull();
    });

    it("get verifies org membership", async () => {
      await db.insert(projects).values({
        id: "p-2",
        orgId: "org-2",
        repoFullName: "o/r2",
        specPath: "o.yaml",
      });

      const context = {
        db,
        session: {
          user: { id: "user-1", email: "user1@example.com" },
        },
      };

      await expect(
        call(projectsRouter.config.get, { projectId: "p-2" }, { context }),
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    });

    it("save saves new config and redacts api key in response", async () => {
      await db.insert(projects).values({
        id: "p-1",
        orgId: "org-1",
        repoFullName: "o/r1",
        specPath: "o.yaml",
      });

      const context = {
        db,
        session: {
          user: { id: "user-1", email: "user1@example.com" },
        },
      };

      const result = await call(
        projectsRouter.config.save,
        {
          projectId: "p-1",
          outputs: ["SDK"],
          sdkLanguages: ["typescript"],
          outputDir: ".emitkit-new/",
          geminiApiKey: "new-raw-key",
        },
        { context }
      );

      expect(result).toBeDefined();
      expect(result.geminiApiKey).toBe("********");

      const [stored] = await db
        .select()
        .from(projectConfigs)
        .where(eq(projectConfigs.id, result.id));
      expect(stored.geminiApiKey).toBe("encrypted:new-raw-key");
    });

    it("save preserves existing API key if input is placeholder", async () => {
      await db.insert(projects).values({
        id: "p-1",
        orgId: "org-1",
        repoFullName: "o/r1",
        specPath: "o.yaml",
      });

      await db.insert(projectConfigs).values({
        id: "conf-1",
        projectId: "p-1",
        outputs: ["SDK"],
        sdkLanguages: ["typescript"],
        outputDir: ".emitkit/",
        sdkVersionStrategy: "emitkit-managed",
        geminiApiKey: "encrypted:existing-key",
      });

      const context = {
        db,
        session: {
          user: { id: "user-1", email: "user1@example.com" },
        },
      };

      const result = await call(
        projectsRouter.config.save,
        {
          projectId: "p-1",
          outputs: ["SDK"],
          sdkLanguages: ["typescript"],
          outputDir: ".emitkit-new/",
          geminiApiKey: "********",
        },
        { context }
      );

      expect(result).toBeDefined();
      expect(result.geminiApiKey).toBe("********");

      const [stored] = await db
        .select()
        .from(projectConfigs)
        .where(eq(projectConfigs.id, result.id));
      expect(stored.geminiApiKey).toBe("encrypted:existing-key");
    });

    it("save verifies org membership", async () => {
      await db.insert(projects).values({
        id: "p-2",
        orgId: "org-2",
        repoFullName: "o/r2",
        specPath: "o.yaml",
      });

      const context = {
        db,
        session: {
          user: { id: "user-1", email: "user1@example.com" },
        },
      };

      await expect(
        call(
          projectsRouter.config.save,
          {
            projectId: "p-2",
            outputs: ["SDK"],
            sdkLanguages: ["typescript"],
          },
          { context }
        ),
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    });
  });

  describe("runs", () => {
    it("list returns generation runs for a project", async () => {
      await db.insert(projects).values({
        id: "p-1",
        orgId: "org-1",
        repoFullName: "o/r1",
        specPath: "o.yaml",
      });

      await db.insert(projectConfigs).values({
        id: "conf-1",
        projectId: "p-1",
        outputs: ["SDK"],
        sdkLanguages: ["typescript"],
        outputDir: ".emitkit/",
        sdkVersionStrategy: "emitkit-managed",
      });

      await db.insert(generationRuns).values([
        {
          id: "run-1",
          projectId: "p-1",
          configId: "conf-1",
          triggeredBy: "manual",
          status: "success",
          createdAt: new Date("2026-06-24T12:00:00Z"),
        },
        {
          id: "run-2",
          projectId: "p-1",
          configId: "conf-1",
          triggeredBy: "webhook",
          status: "failed",
          createdAt: new Date("2026-06-24T12:05:00Z"),
        },
      ]);

      const context = {
        db,
        session: {
          user: { id: "user-1", email: "user1@example.com" },
        },
      };

      const result = await call(projectsRouter.runs.list, { projectId: "p-1" }, { context });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("run-2"); // Descending order
      expect(result[1].id).toBe("run-1");
    });

    it("list verifies org membership", async () => {
      await db.insert(projects).values({
        id: "p-2",
        orgId: "org-2",
        repoFullName: "o/r2",
        specPath: "o.yaml",
      });

      const context = {
        db,
        session: {
          user: { id: "user-1", email: "user1@example.com" },
        },
      };

      await expect(
        call(projectsRouter.runs.list, { projectId: "p-2" }, { context }),
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    });

    it("get returns a specific generation run", async () => {
      await db.insert(projects).values({
        id: "p-1",
        orgId: "org-1",
        repoFullName: "o/r1",
        specPath: "o.yaml",
      });

      await db.insert(projectConfigs).values({
        id: "conf-1",
        projectId: "p-1",
        outputs: ["SDK"],
        sdkLanguages: ["typescript"],
        outputDir: ".emitkit/",
        sdkVersionStrategy: "emitkit-managed",
      });

      await db.insert(generationRuns).values({
        id: "run-1",
        projectId: "p-1",
        configId: "conf-1",
        triggeredBy: "manual",
        status: "queued",
      });

      const context = {
        db,
        session: {
          user: { id: "user-1", email: "user1@example.com" },
        },
      };

      const result = await call(projectsRouter.runs.get, { runId: "run-1" }, { context });
      expect(result).toBeDefined();
      expect(result.id).toBe("run-1");
      expect(result.projectId).toBe("p-1");
    });

    it("get verifies membership of the project", async () => {
      await db.insert(projects).values({
        id: "p-2",
        orgId: "org-2",
        repoFullName: "o/r2",
        specPath: "o.yaml",
      });

      await db.insert(projectConfigs).values({
        id: "conf-2",
        projectId: "p-2",
        outputs: ["SDK"],
        sdkLanguages: ["typescript"],
        outputDir: ".emitkit/",
        sdkVersionStrategy: "emitkit-managed",
      });

      await db.insert(generationRuns).values({
        id: "run-2",
        projectId: "p-2",
        configId: "conf-2",
        triggeredBy: "manual",
        status: "queued",
      });

      const context = {
        db,
        session: {
          user: { id: "user-1", email: "user1@example.com" },
        },
      };

      await expect(
        call(projectsRouter.runs.get, { runId: "run-2" }, { context }),
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    });

    it("trigger creates a run and enqueues BullMQ job", async () => {
      await db.insert(projects).values({
        id: "p-1",
        orgId: "org-1",
        repoFullName: "o/r1",
        specPath: "o.yaml",
      });

      await db.insert(projectConfigs).values({
        id: "conf-1",
        projectId: "p-1",
        outputs: ["SDK"],
        sdkLanguages: ["typescript"],
        outputDir: ".emitkit/",
        sdkVersionStrategy: "emitkit-managed",
      });

      const context = {
        db,
        session: {
          user: { id: "user-1", email: "user1@example.com" },
        },
      };

      const result = await call(projectsRouter.runs.trigger, { projectId: "p-1" }, { context });
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.projectId).toBe("p-1");
      expect(result.status).toBe("queued");
      expect(result.triggeredBy).toBe("manual");

      // Verify DB entry
      const [stored] = await db
        .select()
        .from(generationRuns)
        .where(eq(generationRuns.id, result.id));
      expect(stored).toBeDefined();
      expect(stored.configId).toBe("conf-1");

      // Verify queue is called
      expect(mockAdd).toHaveBeenCalledWith("generate", { runId: result.id });
    });

    it("trigger throws BAD_REQUEST if configuration does not exist", async () => {
      await db.insert(projects).values({
        id: "p-1",
        orgId: "org-1",
        repoFullName: "o/r1",
        specPath: "o.yaml",
      });

      const context = {
        db,
        session: {
          user: { id: "user-1", email: "user1@example.com" },
        },
      };

      await expect(
        call(projectsRouter.runs.trigger, { projectId: "p-1" }, { context }),
      ).rejects.toThrowError(
        expect.objectContaining({
          code: "BAD_REQUEST",
          message: "No configuration found for this project. Please save a configuration first.",
        })
      );
    });

    it("trigger verifies org membership", async () => {
      await db.insert(projects).values({
        id: "p-2",
        orgId: "org-2",
        repoFullName: "o/r2",
        specPath: "o.yaml",
      });

      const context = {
        db,
        session: {
          user: { id: "user-1", email: "user1@example.com" },
        },
      };

      await expect(
        call(projectsRouter.runs.trigger, { projectId: "p-2" }, { context }),
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    });
  });
});
