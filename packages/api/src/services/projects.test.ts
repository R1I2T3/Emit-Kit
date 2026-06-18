import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFromExistingRepo, createNewRepo, deleteProject } from "./projects";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@Emitkit/db/schema";
import { migrate } from "drizzle-orm/libsql/migrator";
import { organizations, projects, user } from "@Emitkit/db/schema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { GitHubClient } from "@Emitkit/github";

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

const mockGetRepoContent = vi.fn();
const mockRegisterWebhook = vi.fn();
const mockCreateRepo = vi.fn();
const mockCreateInitialCommit = vi.fn();
const mockDeleteWebhook = vi.fn();

vi.mock("@Emitkit/github", () => {
  return {
    GitHubClient: vi.fn().mockImplementation(() => {
      return {};
    }),
    getRepoContent: (...args: any[]) => mockGetRepoContent(...args),
    registerWebhook: (...args: any[]) => mockRegisterWebhook(...args),
    createRepo: (...args: any[]) => mockCreateRepo(...args),
    createInitialCommit: (...args: any[]) => mockCreateInitialCommit(...args),
    deleteWebhook: (...args: any[]) => mockDeleteWebhook(...args),
  };
});

vi.mock("@Emitkit/auth/crypto", () => {
  return {
    encrypt: (text: string) => `encrypted:${text}`,
    decrypt: (text: string) => text.replace("encrypted:", ""),
  };
});

async function createTestDb() {
  dbFile = `test-projects-${randomUUID()}.db`;
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

describe("projects service", () => {
  let ghClient: any;

  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.insert(organizations).values({
      id: "org-1",
      githubOrgId: "12345",
      name: "test-org",
      slug: "test-org",
    });
    vi.clearAllMocks();
    ghClient = new GitHubClient("encrypted-token");
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

  it("createFromExistingRepo checks for file, registers webhook, and inserts project", async () => {
    mockGetRepoContent.mockResolvedValue({ content: "openapi spec content", sha: "sha-1" });
    mockRegisterWebhook.mockResolvedValue({ id: 123456 });

    const project = await createFromExistingRepo("org-1", "my-owner/my-repo", "openapi.yaml", "main", ghClient, testDb);

    expect(mockGetRepoContent).toHaveBeenCalledWith(ghClient, "my-owner", "my-repo", "openapi.yaml", "main");
    expect(mockRegisterWebhook).toHaveBeenCalledWith(
      ghClient,
      "my-owner",
      "my-repo",
      expect.stringContaining("/webhooks/github"),
      expect.any(String)
    );

    expect(project).toBeDefined();
    expect(project.orgId).toBe("org-1");
    expect(project.repoFullName).toBe("my-owner/my-repo");
    expect(project.specPath).toBe("openapi.yaml");
    expect(project.defaultBranch).toBe("main");
    expect(project.outputMode).toBe("append");
    expect(project.webhookId).toBe(123456);
    expect(project.webhookSecret).toContain("encrypted:");

    // Verify db insertion
    const saved = await testDb.select().from(projects);
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(project.id);
  });

  it("createNewRepo creates repo, commits starter spec, registers webhook, and inserts project", async () => {
    mockCreateRepo.mockResolvedValue({ url: "https://github.com/my-org/my-new-repo", fullName: "my-org/my-new-repo", defaultBranch: "main" });
    mockCreateInitialCommit.mockResolvedValue({ commitSha: "commit-sha" });
    mockRegisterWebhook.mockResolvedValue({ id: 7890 });

    const project = await createNewRepo("org-1", "my-new-repo", "private", "my-org", ghClient, testDb);

    expect(mockCreateRepo).toHaveBeenCalledWith(ghClient, "my-new-repo", "private", "my-org");
    expect(mockCreateInitialCommit).toHaveBeenCalledWith(
      ghClient,
      "my-org",
      "my-new-repo",
      "openapi.yaml",
      expect.stringContaining("openapi: 3.1.0")
    );
    expect(mockRegisterWebhook).toHaveBeenCalledWith(
      ghClient,
      "my-org",
      "my-new-repo",
      expect.stringContaining("/webhooks/github"),
      expect.any(String)
    );

    expect(project).toBeDefined();
    expect(project.repoFullName).toBe("my-org/my-new-repo");
    expect(project.specPath).toBe("openapi.yaml");
    expect(project.defaultBranch).toBe("main");
    expect(project.webhookId).toBe(7890);

    const saved = await testDb.select().from(projects);
    expect(saved).toHaveLength(1);
  });

  it("deleteProject deletes a project by id", async () => {
    await testDb.insert(projects).values({
      id: "project-1",
      orgId: "org-1",
      repoFullName: "my-owner/my-repo",
      specPath: "openapi.yaml",
      defaultBranch: "main",
      outputMode: "append",
    });

    await deleteProject("project-1", null, testDb);

    const saved = await testDb.select().from(projects);
    expect(saved).toHaveLength(0);
  });

  it("deleteProject deletes a project and calls deleteWebhook on GitHub", async () => {
    await testDb.insert(projects).values({
      id: "project-1",
      orgId: "org-1",
      repoFullName: "my-owner/my-repo",
      specPath: "openapi.yaml",
      defaultBranch: "main",
      outputMode: "append",
      webhookId: 98765,
    });

    const ghClient = new GitHubClient("token");
    await deleteProject("project-1", ghClient, testDb);

    expect(mockDeleteWebhook).toHaveBeenCalledWith(ghClient, "my-owner", "my-repo", 98765);
    const saved = await testDb.select().from(projects);
    expect(saved).toHaveLength(0);
  });
});
