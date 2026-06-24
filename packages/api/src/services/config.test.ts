import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { saveConfig, getLatestConfig } from "./config";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@Emitkit/db/schema";
import { migrate } from "drizzle-orm/libsql/migrator";
import { organizations, projects, projectConfigs } from "@Emitkit/db/schema";
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

vi.mock("@Emitkit/auth/crypto", () => {
  return {
    encrypt: (text: string) => `encrypted:${text}`,
    decrypt: (text: string) => text.replace("encrypted:", ""),
  };
});

async function createTestDb() {
  dbFile = `test-config-${randomUUID()}.db`;
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

describe("config service", () => {
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

  it("saveConfig saves configuration, encrypts geminiApiKey and returns config", async () => {
    const inputConfig = {
      outputs: ["SDK", "CLI"] as ("SDK" | "CLI" | "MCP" | "DOCS")[],
      sdkLanguages: ["typescript"] as ("typescript" | "python")[],
      outputDir: ".emitkit-custom/",
      sdkNpmScope: "@scope",
      sdkPypiName: null,
      sdkVersionStrategy: "emitkit-managed" as "emitkit-managed" | "spec-version",
      geminiApiKey: "my-gemini-key",
    };

    const result = await saveConfig("project-1", inputConfig, testDb);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.projectId).toBe("project-1");
    expect(result.outputs).toEqual(["SDK", "CLI"]);
    expect(result.sdkLanguages).toEqual(["typescript"]);
    expect(result.outputDir).toBe(".emitkit-custom/");
    expect(result.sdkNpmScope).toBe("@scope");
    expect(result.sdkPypiName).toBeNull();
    expect(result.sdkVersionStrategy).toBe("emitkit-managed");
    expect(result.geminiApiKey).toBe("encrypted:my-gemini-key");

    // Verify stored config in DB
    const saved = await testDb.select().from(projectConfigs).where(eq(projectConfigs.id, result.id));
    expect(saved).toHaveLength(1);
    expect(saved[0].geminiApiKey).toBe("encrypted:my-gemini-key");
  });

  it("saveConfig transforms empty string optional values to null", async () => {
    const inputConfig = {
      outputs: ["SDK"] as ("SDK" | "CLI" | "MCP" | "DOCS")[],
      sdkLanguages: ["typescript"] as ("typescript" | "python")[],
      outputDir: ".emitkit/",
      sdkNpmScope: "",
      sdkPypiName: "",
      sdkVersionStrategy: "emitkit-managed" as "emitkit-managed" | "spec-version",
      geminiApiKey: "",
    };

    const result = await saveConfig("project-1", inputConfig, testDb);

    expect(result.sdkNpmScope).toBeNull();
    expect(result.sdkPypiName).toBeNull();
    expect(result.geminiApiKey).toBeNull();
  });

  it("getLatestConfig fetches the newest config based on createdAt descending", async () => {
    const config1 = await saveConfig("project-1", {
      outputs: ["SDK"],
      sdkLanguages: ["typescript"],
      outputDir: ".emitkit/",
      sdkVersionStrategy: "emitkit-managed",
    }, testDb);

    // Wait slightly to ensure different timestamps, or manually update one
    // Since SQLITE default is milliseconds timestamp, we'll manually insert the second one to ensure a newer timestamp
    const config2Id = randomUUID();
    await testDb.insert(projectConfigs).values({
      id: config2Id,
      projectId: "project-1",
      outputs: ["CLI"],
      sdkLanguages: ["python"],
      outputDir: ".emitkit-new/",
      sdkVersionStrategy: "spec-version",
      createdAt: new Date(config1.createdAt.getTime() + 10000), // 10s newer
    });

    const latest = await getLatestConfig("project-1", testDb);

    expect(latest).toBeDefined();
    expect(latest.id).toBe(config2Id);
    expect(latest.outputs).toEqual(["CLI"]);
    expect(latest.sdkLanguages).toEqual(["python"]);
    expect(latest.outputDir).toBe(".emitkit-new/");
  });

  it("getLatestConfig returns undefined if no config is found", async () => {
    const latest = await getLatestConfig("project-2-non-existent", testDb);
    expect(latest).toBeUndefined();
  });
});
