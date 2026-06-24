import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRun, enqueueGenerationJob, listRuns } from "./runs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@Emitkit/db/schema";
import { migrate } from "drizzle-orm/libsql/migrator";
import { organizations, projects, projectConfigs, generationRuns } from "@Emitkit/db/schema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

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

async function createTestDb() {
  dbFile = `test-runs-${randomUUID()}.db`;
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

describe("runs service", () => {
  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.insert(organizations).values({
      id: "org-1",
      githubOrgId: "12345",
      name: "test-org",
      slug: "test-org",
    });
    await testDb.insert(projects).values({
      id: "project-1",
      orgId: "org-1",
      repoFullName: "test-org/test-repo",
      specPath: "openapi.yaml",
    });
    await testDb.insert(projectConfigs).values({
      id: "config-1",
      projectId: "project-1",
      outputs: ["SDK"],
      sdkLanguages: ["typescript"],
      outputDir: ".emitkit/",
      sdkVersionStrategy: "emitkit-managed",
    });
    vi.clearAllMocks();
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

  it("createRun saves new queued run with empty logs", async () => {
    const run = await createRun("project-1", "config-1", "manual", testDb);

    expect(run).toBeDefined();
    expect(run.id).toBeDefined();
    expect(run.projectId).toBe("project-1");
    expect(run.configId).toBe("config-1");
    expect(run.triggeredBy).toBe("manual");
    expect(run.status).toBe("queued");
    expect(run.logs).toBe("");

    // Verify stored record in DB
    const saved = await testDb.select().from(generationRuns).where(eq(generationRuns.id, run.id));
    expect(saved).toHaveLength(1);
    expect(saved[0].status).toBe("queued");
  });

  it("enqueueGenerationJob adds a job to the generation queue", async () => {
    const runId = "run-123";
    await enqueueGenerationJob(runId);

    const { createQueue } = await import("@Emitkit/queue");
    expect(createQueue).toHaveBeenCalledWith("generation", expect.any(Object));
    expect(mockAdd).toHaveBeenCalledWith("generate", { runId });
    expect(mockClose).toHaveBeenCalled();
  });

  it("listRuns retrieves runs in descending order of creation with limit/offset", async () => {
    const run1 = await createRun("project-1", "config-1", "manual", testDb);

    // Manually insert a second run with a newer timestamp to guarantee sorting order
    const run2Id = randomUUID();
    await testDb.insert(generationRuns).values({
      id: run2Id,
      projectId: "project-1",
      configId: "config-1",
      triggeredBy: "webhook",
      status: "running",
      createdAt: new Date(run1.createdAt.getTime() + 5000), // 5 seconds later
    });

    const runs = await listRuns("project-1", 10, 0, testDb);

    expect(runs).toHaveLength(2);
    expect(runs[0].id).toBe(run2Id);
    expect(runs[0].triggeredBy).toBe("webhook");
    expect(runs[1].id).toBe(run1.id);
    expect(runs[1].triggeredBy).toBe("manual");

    // Test offset and limit
    const runsLimit = await listRuns("project-1", 1, 0, testDb);
    expect(runsLimit).toHaveLength(1);
    expect(runsLimit[0].id).toBe(run2Id);

    const runsOffset = await listRuns("project-1", 10, 1, testDb);
    expect(runsOffset).toHaveLength(1);
    expect(runsOffset[0].id).toBe(run1.id);
  });
});
