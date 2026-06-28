import { describe, it, expect } from "vitest";
import { CLIGenerator } from "./index";
import type { ParsedSpec, GeneratorConfig } from "../types";

describe("CLI Generator", () => {
  const spec: ParsedSpec = {
    info: { title: "Test Service", version: "2.3.4", description: "My service CLI" },
    servers: [],
    operations: [
      {
        operationId: "getUser",
        method: "GET",
        path: "/users/{id}",
        tags: ["users"],
        parameters: [
          { name: "id", in: "path", required: true },
          { name: "fields", in: "query", required: false, description: "Fields to return" }
        ],
        responses: {},
      },
      {
        operationId: "updateUser",
        method: "PUT",
        path: "/users/{id}",
        tags: ["users"],
        parameters: [{ name: "id", in: "path", required: true }],
        requestBody: { content: { "application/json": {} } },
        responses: {},
      }
    ],
    schemas: {},
    security: [],
  };

  const config: GeneratorConfig = {
    outputDir: "out",
    version: "1.0.0",
  };

  it("should generate all expected files", async () => {
    const generator = new CLIGenerator();
    const result = await generator.generate(spec, config);

    expect(result.error).toBeUndefined();
    expect(result.files).toHaveLength(3);

    const paths = result.files.map((f) => f.path);
    expect(paths).toContain("out/cli/index.ts");
    expect(paths).toContain("out/cli/package.json");
    expect(paths).toContain("out/cli/tsconfig.json");

    const cliIndex = result.files.find((f) => f.path === "out/cli/index.ts")!;
    expect(cliIndex.content).toContain("#!/usr/bin/env node");
    expect(cliIndex.content).toContain("import { Command } from 'commander';");
    expect(cliIndex.content).toContain(".name('test-service')");
    expect(cliIndex.content).toContain(".version('2.3.4')");
    expect(cliIndex.content).toContain(".command('getUser <id>')");
    expect(cliIndex.content).toContain(".option('--fields <value>', 'Fields to return')");
    expect(cliIndex.content).toContain(".command('updateUser <id>')");
    expect(cliIndex.content).toContain(".option('--body <json>', 'JSON request body string')");

    const packageJson = result.files.find((f) => f.path === "out/cli/package.json")!;
    const pkg = JSON.parse(packageJson.content);
    expect(pkg.name).toBe("test-service-cli");
    expect(pkg.version).toBe("1.0.0");
    expect(pkg.bin["test-service"]).toBe("./index.js");
  });

  it("should handle empty operations", async () => {
    const emptySpec: ParsedSpec = {
      info: { title: "Simple Service", version: "1.0" },
      servers: [],
      operations: [],
      schemas: {},
      security: [],
    };

    const generator = new CLIGenerator();
    const result = await generator.generate(emptySpec, config);

    expect(result.error).toBeUndefined();
    expect(result.files).toHaveLength(3);
    const cliIndex = result.files.find((f) => f.path === "out/cli/index.ts")!;
    expect(cliIndex.content).toContain(".name('simple-service')");
  });
});
