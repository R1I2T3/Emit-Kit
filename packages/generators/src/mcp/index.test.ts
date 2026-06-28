import { describe, it, expect } from "vitest";
import { MCPGenerator } from "./index";
import type { ParsedSpec, GeneratorConfig } from "../types";

describe("MCP Generator", () => {
  const spec: ParsedSpec = {
    info: { title: "Test API", version: "1.2.3", description: "Test MCP Server" },
    servers: [],
    operations: [
      {
        operationId: "getTask",
        method: "GET",
        path: "/tasks/{id}",
        tags: ["tasks"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
          { name: "verbose", in: "query", required: false, schema: { type: "boolean" } }
        ],
        responses: {},
      }
    ],
    schemas: {},
    security: [],
  };

  const config: GeneratorConfig = {
    outputDir: "out",
    version: "0.1.0",
  };

  it("should generate all expected files with correct tool definitions", async () => {
    const generator = new MCPGenerator();
    const result = await generator.generate(spec, config);

    expect(result.error).toBeUndefined();
    expect(result.files).toHaveLength(3);

    const paths = result.files.map((f) => f.path);
    expect(paths).toContain("out/mcp/index.ts");
    expect(paths).toContain("out/mcp/package.json");
    expect(paths).toContain("out/mcp/tsconfig.json");

    const mcpIndex = result.files.find((f) => f.path === "out/mcp/index.ts")!;
    expect(mcpIndex.content).toContain('import { Server } from "@modelcontextprotocol/sdk/server/index.js";');
    expect(mcpIndex.content).toContain('import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";');
    expect(mcpIndex.content).toContain("ListToolsRequestSchema");
    expect(mcpIndex.content).toContain("CallToolRequestSchema");
    expect(mcpIndex.content).toContain('name: "Test API"');
    expect(mcpIndex.content).toContain('version: "1.2.3"');

    // Tool details
    expect(mcpIndex.content).toContain('"name": "getTask"');
    expect(mcpIndex.content).toContain('"type": "number"'); // for integer parameter 'id'
    expect(mcpIndex.content).toContain('"type": "boolean"'); // for boolean parameter 'verbose'
    expect(mcpIndex.content).toContain('"required": [');
    expect(mcpIndex.content).toContain('"id"');

    const packageJson = result.files.find((f) => f.path === "out/mcp/package.json")!;
    const pkg = JSON.parse(packageJson.content);
    expect(pkg.name).toBe("test-api-mcp");
    expect(pkg.version).toBe("0.1.0");
    expect(pkg.dependencies["@modelcontextprotocol/sdk"]).toBeDefined();
  });

  it("should handle empty operations", async () => {
    const emptySpec: ParsedSpec = {
      info: { title: "Minimal API", version: "1.0" },
      servers: [],
      operations: [],
      schemas: {},
      security: [],
    };

    const generator = new MCPGenerator();
    const result = await generator.generate(emptySpec, config);

    expect(result.error).toBeUndefined();
    expect(result.files).toHaveLength(3);
    const mcpIndex = result.files.find((f) => f.path === "out/mcp/index.ts")!;
    expect(mcpIndex.content).toContain('name: "Minimal API"');
  });
});
