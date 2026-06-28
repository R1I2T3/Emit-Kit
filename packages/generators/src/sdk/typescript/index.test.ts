import { describe, it, expect } from "vitest";
import { TypeScriptSDKGenerator, generateErrorClasses, generatePackageJson, generateCustomStubs } from "./index";
import { generateTypes } from "./types";
import { generateClient } from "./client";
import { generateResources } from "./resources";
import type { ParsedSpec, GeneratorConfig, Operation } from "../../types";

// ─── Test fixtures ──────────────────────────────────────────────────────────

function createMinimalSpec(overrides: Partial<ParsedSpec> = {}): ParsedSpec {
  return {
    info: { title: "Test API", version: "1.0.0", description: "A test API" },
    servers: ["https://api.example.com"],
    operations: [
      {
        operationId: "listUsers",
        method: "GET",
        path: "/users",
        summary: "List all users",
        tags: ["users"],
        parameters: [],
        responses: { "200": { description: "OK" } },
      },
      {
        operationId: "createUser",
        method: "POST",
        path: "/users",
        summary: "Create a user",
        tags: ["users"],
        parameters: [],
        requestBody: { content: { "application/json": {} } },
        responses: { "201": { description: "Created" } },
      },
      {
        operationId: "getUser",
        method: "GET",
        path: "/users/{id}",
        summary: "Get a user by ID",
        tags: ["users"],
        parameters: [{ name: "id", in: "path", required: true }],
        responses: { "200": { description: "OK" } },
      },
      {
        operationId: "listPosts",
        method: "GET",
        path: "/posts",
        summary: "List all posts",
        tags: ["posts"],
        parameters: [{ name: "page", in: "query" }],
        responses: { "200": { description: "OK" } },
      },
    ],
    schemas: {
      User: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "integer", description: "User ID" },
          name: { type: "string", description: "User name" },
          email: { type: "string" },
        },
      },
      Post: {
        type: "object",
        required: ["id", "title"],
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          author: { $ref: "#/components/schemas/User" },
        },
      },
    },
    security: [],
    ...overrides,
  };
}

function createConfig(overrides: Partial<GeneratorConfig> = {}): GeneratorConfig {
  return {
    outputDir: "/out",
    version: "1.2.3",
    npmScope: "myorg",
    ...overrides,
  };
}

// ─── TypeScriptSDKGenerator (integration) ───────────────────────────────────

describe("TypeScriptSDKGenerator", () => {
  const generator = new TypeScriptSDKGenerator();

  it("generates files for a minimal spec", async () => {
    const spec = createMinimalSpec();
    const config = createConfig();
    const result = await generator.generate(spec, config);

    expect(result.error).toBeUndefined();
    expect(result.files.length).toBeGreaterThan(0);

    const paths = result.files.map((f) => f.path);
    expect(paths).toContain("/out/sdk/typescript/types.ts");
    expect(paths).toContain("/out/sdk/typescript/client.ts");
    expect(paths).toContain("/out/sdk/typescript/errors.ts");
    expect(paths).toContain("/out/sdk/typescript/package.json");
    expect(paths).toContain("/out/sdk/typescript/tsconfig.json");

    // All files should have non-empty content
    for (const file of result.files) {
      expect(file.content.length).toBeGreaterThan(0);
    }
  });

  it("generates resource files grouped by tag", async () => {
    const spec = createMinimalSpec();
    const config = createConfig();
    const result = await generator.generate(spec, config);

    const resourcePaths = result.files
      .filter((f) => f.path.includes("/resources/"))
      .map((f) => f.path);

    expect(resourcePaths).toContain("/out/sdk/typescript/resources/users.ts");
    expect(resourcePaths).toContain("/out/sdk/typescript/resources/posts.ts");
    expect(resourcePaths).toHaveLength(2);
  });

  it("marks custom stubs with skipIfExists=true", async () => {
    const spec = createMinimalSpec();
    const config = createConfig();
    const result = await generator.generate(spec, config);

    const stubs = result.files.filter((f) => f.path.includes("/custom/"));
    expect(stubs.length).toBeGreaterThan(0);
    for (const stub of stubs) {
      expect(stub.skipIfExists).toBe(true);
    }
  });

  it("handles empty operations array gracefully", async () => {
    const spec = createMinimalSpec({ operations: [] });
    const config = createConfig();
    const result = await generator.generate(spec, config);

    expect(result.error).toBeUndefined();

    const paths = result.files.map((f) => f.path);
    expect(paths).toContain("/out/sdk/typescript/types.ts");
    expect(paths).toContain("/out/sdk/typescript/client.ts");
    expect(paths).toContain("/out/sdk/typescript/errors.ts");
    expect(paths).toContain("/out/sdk/typescript/package.json");
    expect(paths).toContain("/out/sdk/typescript/tsconfig.json");

    // No resource files or stubs when there are no operations
    const resourceFiles = result.files.filter((f) => f.path.includes("/resources/"));
    expect(resourceFiles).toHaveLength(0);
  });

  it("returns error in result on generation failure", async () => {
    // Create a spec that will cause an error by making schemas a getter that throws
    const badSpec = createMinimalSpec();
    Object.defineProperty(badSpec, "schemas", {
      get() {
        throw new Error("Schema explosion");
      },
    });

    const config = createConfig();
    const result = await generator.generate(badSpec, config);

    expect(result.error).toBe("Schema explosion");
    expect(result.files).toEqual([]);
  });
});

// ─── generateTypes (unit) ───────────────────────────────────────────────────

describe("generateTypes", () => {
  it("generates interfaces with correct names from schemas", () => {
    const schemas = {
      User: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
        },
      },
      Post: {
        type: "object",
        properties: {
          title: { type: "string" },
        },
      },
    };

    const output = generateTypes(schemas);
    expect(output).toContain("export interface User");
    expect(output).toContain("export interface Post");
  });

  it("marks required properties without ?", () => {
    const schemas = {
      User: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
        },
      },
    };

    const output = generateTypes(schemas);
    expect(output).toContain("id: number;");
    expect(output).toContain("name?: string;");
  });

  it("handles $ref references", () => {
    const schemas = {
      Post: {
        type: "object",
        properties: {
          author: { $ref: "#/components/schemas/User" },
        },
      },
    };

    const output = generateTypes(schemas);
    expect(output).toContain("author?: User;");
  });

  it("handles array types", () => {
    const schemas = {
      UserList: {
        type: "object",
        properties: {
          items: { type: "array", items: { $ref: "#/components/schemas/User" } },
        },
      },
    };

    const output = generateTypes(schemas);
    expect(output).toContain("items?: User[];");
  });

  it("handles enum types", () => {
    const schemas = {
      Status: {
        enum: ["active", "inactive", "pending"],
      },
    };

    const output = generateTypes(schemas);
    expect(output).toContain('export type Status = "active" | "inactive" | "pending"');
  });

  it("handles allOf for inheritance", () => {
    const schemas = {
      Admin: {
        allOf: [
          { $ref: "#/components/schemas/User" },
          {
            type: "object",
            properties: {
              role: { type: "string" },
            },
          },
        ],
      },
    };

    const output = generateTypes(schemas);
    expect(output).toContain("export interface Admin extends User");
    expect(output).toContain("role?: string;");
  });

  it("handles empty schemas object", () => {
    const output = generateTypes({});
    expect(output).toContain("Auto-generated");
    // Should not have any interface declarations
    expect(output).not.toContain("export interface");
  });

  it("includes property descriptions as JSDoc", () => {
    const schemas = {
      User: {
        type: "object",
        properties: {
          id: { type: "integer", description: "The user identifier" },
        },
      },
    };

    const output = generateTypes(schemas);
    expect(output).toContain("/** The user identifier */");
  });
});

// ─── generateClient (unit) ──────────────────────────────────────────────────

describe("generateClient", () => {
  it("generates a client class", () => {
    const spec = createMinimalSpec();
    const output = generateClient(spec);

    expect(output).toContain("export class Client");
  });

  it("includes HTTP methods", () => {
    const spec = createMinimalSpec();
    const output = generateClient(spec);

    expect(output).toContain("async get<T>");
    expect(output).toContain("async post<T>");
    expect(output).toContain("async put<T>");
    expect(output).toContain("async patch<T>");
    expect(output).toContain("async delete<T>");
  });

  it("includes the base URL from servers", () => {
    const spec = createMinimalSpec({ servers: ["https://custom.api.com/v2"] });
    const output = generateClient(spec);

    expect(output).toContain("https://custom.api.com/v2");
  });

  it("imports error classes", () => {
    const spec = createMinimalSpec();
    const output = generateClient(spec);

    expect(output).toContain("import { EmitError, EmitHttpError }");
  });

  it("uses EmitHttpError for non-ok responses", () => {
    const spec = createMinimalSpec();
    const output = generateClient(spec);

    expect(output).toContain("EmitHttpError");
  });

  it("uses EmitError for network errors", () => {
    const spec = createMinimalSpec();
    const output = generateClient(spec);

    expect(output).toContain("EmitError");
  });

  it("defaults to localhost when no servers provided", () => {
    const spec = createMinimalSpec({ servers: [] });
    const output = generateClient(spec);

    expect(output).toContain("http://localhost:3000");
  });
});

// ─── generateErrorClasses (unit) ────────────────────────────────────────────

describe("generateErrorClasses", () => {
  it("contains EmitError class", () => {
    const output = generateErrorClasses();
    expect(output).toContain("export class EmitError extends Error");
  });

  it("contains EmitHttpError class", () => {
    const output = generateErrorClasses();
    expect(output).toContain("export class EmitHttpError extends EmitError");
  });

  it("EmitHttpError has statusCode and body properties", () => {
    const output = generateErrorClasses();
    expect(output).toContain("statusCode: number");
    expect(output).toContain("body: unknown");
  });
});

// ─── generateResources (unit) ───────────────────────────────────────────────

describe("generateResources", () => {
  const config = createConfig();

  it("creates one file per tag", () => {
    const operations: Operation[] = [
      {
        operationId: "listUsers",
        method: "GET",
        path: "/users",
        tags: ["users"],
        parameters: [],
        responses: {},
      },
      {
        operationId: "listPosts",
        method: "GET",
        path: "/posts",
        tags: ["posts"],
        parameters: [],
        responses: {},
      },
    ];

    const files = generateResources(operations, config);
    expect(files).toHaveLength(2);

    const paths = files.map((f) => f.path);
    expect(paths).toContain("/out/sdk/typescript/resources/users.ts");
    expect(paths).toContain("/out/sdk/typescript/resources/posts.ts");
  });

  it("groups multiple operations under the same tag", () => {
    const operations: Operation[] = [
      {
        operationId: "listUsers",
        method: "GET",
        path: "/users",
        tags: ["users"],
        parameters: [],
        responses: {},
      },
      {
        operationId: "createUser",
        method: "POST",
        path: "/users",
        tags: ["users"],
        parameters: [],
        requestBody: {},
        responses: {},
      },
    ];

    const files = generateResources(operations, config);
    expect(files).toHaveLength(1);

    const content = files[0].content;
    expect(content).toContain("listUsers");
    expect(content).toContain("createUser");
  });

  it("generates resource class with correct name", () => {
    const operations: Operation[] = [
      {
        operationId: "listUsers",
        method: "GET",
        path: "/users",
        tags: ["users"],
        parameters: [],
        responses: {},
      },
    ];

    const files = generateResources(operations, config);
    expect(files[0].content).toContain("export class UsersResource");
  });

  it("handles path parameters in methods", () => {
    const operations: Operation[] = [
      {
        operationId: "getUser",
        method: "GET",
        path: "/users/{id}",
        tags: ["users"],
        parameters: [{ name: "id", in: "path", required: true }],
        responses: {},
      },
    ];

    const files = generateResources(operations, config);
    expect(files[0].content).toContain("id: string");
    expect(files[0].content).toContain("${id}");
  });

  it("handles query parameters in methods", () => {
    const operations: Operation[] = [
      {
        operationId: "listUsers",
        method: "GET",
        path: "/users",
        tags: ["users"],
        parameters: [{ name: "page", in: "query" }],
        responses: {},
      },
    ];

    const files = generateResources(operations, config);
    expect(files[0].content).toContain("params?: Record<string, string>");
  });

  it("handles request body in POST methods", () => {
    const operations: Operation[] = [
      {
        operationId: "createUser",
        method: "POST",
        path: "/users",
        tags: ["users"],
        parameters: [],
        requestBody: { content: {} },
        responses: {},
      },
    ];

    const files = generateResources(operations, config);
    expect(files[0].content).toContain("body: Record<string, unknown>");
  });

  it("returns empty array for no operations", () => {
    const files = generateResources([], config);
    expect(files).toHaveLength(0);
  });

  it("uses 'default' tag for operations without tags", () => {
    const operations: Operation[] = [
      {
        operationId: "healthCheck",
        method: "GET",
        path: "/health",
        tags: [],
        parameters: [],
        responses: {},
      },
    ];

    const files = generateResources(operations, config);
    expect(files).toHaveLength(1);
    expect(files[0].path).toContain("default.ts");
  });

  it("imports Client from the client module", () => {
    const operations: Operation[] = [
      {
        operationId: "listUsers",
        method: "GET",
        path: "/users",
        tags: ["users"],
        parameters: [],
        responses: {},
      },
    ];

    const files = generateResources(operations, config);
    expect(files[0].content).toContain('import { Client } from "../client"');
  });
});

// ─── generatePackageJson (unit) ─────────────────────────────────────────────

describe("generatePackageJson", () => {
  it("uses spec title for package name", () => {
    const spec = createMinimalSpec({ info: { title: "My Cool API", version: "1.0.0" } });
    const config = createConfig({ npmScope: undefined });

    const output = generatePackageJson(spec, config);
    const pkg = JSON.parse(output);
    expect(pkg.name).toBe("my-cool-api");
  });

  it("includes npm scope when provided", () => {
    const spec = createMinimalSpec();
    const config = createConfig({ npmScope: "acme" });

    const output = generatePackageJson(spec, config);
    const pkg = JSON.parse(output);
    expect(pkg.name).toBe("@acme/test-api");
  });

  it("uses config version", () => {
    const spec = createMinimalSpec();
    const config = createConfig({ version: "2.0.0" });

    const output = generatePackageJson(spec, config);
    const pkg = JSON.parse(output);
    expect(pkg.version).toBe("2.0.0");
  });

  it("includes description from spec", () => {
    const spec = createMinimalSpec({
      info: { title: "Test API", version: "1.0.0", description: "My API description" },
    });
    const config = createConfig();

    const output = generatePackageJson(spec, config);
    const pkg = JSON.parse(output);
    expect(pkg.description).toBe("My API description");
  });
});

// ─── generateCustomStubs (unit) ─────────────────────────────────────────────

describe("generateCustomStubs", () => {
  it("creates one stub per unique tag", () => {
    const operations: Operation[] = [
      {
        operationId: "listUsers",
        method: "GET",
        path: "/users",
        tags: ["users"],
        parameters: [],
        responses: {},
      },
      {
        operationId: "createUser",
        method: "POST",
        path: "/users",
        tags: ["users"],
        parameters: [],
        responses: {},
      },
      {
        operationId: "listPosts",
        method: "GET",
        path: "/posts",
        tags: ["posts"],
        parameters: [],
        responses: {},
      },
    ];

    const stubs = generateCustomStubs(operations);
    expect(stubs).toHaveLength(2);
  });

  it("stub files extend the base resource class", () => {
    const operations: Operation[] = [
      {
        operationId: "listUsers",
        method: "GET",
        path: "/users",
        tags: ["users"],
        parameters: [],
        responses: {},
      },
    ];

    const stubs = generateCustomStubs(operations);
    expect(stubs[0].content).toContain("UsersResourceCustom extends UsersResource");
  });

  it("returns empty for no operations", () => {
    const stubs = generateCustomStubs([]);
    expect(stubs).toHaveLength(0);
  });
});
