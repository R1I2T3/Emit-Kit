import { describe, it, expect } from "vitest";
import type {
  Generator,
  GeneratorResult,
  OutputFile,
  ParsedSpec,
  Operation,
  GeneratorConfig,
} from "./types";

describe("Generator Types", () => {
  it("should construct a valid ParsedSpec object", () => {
    const spec: ParsedSpec = {
      info: { title: "Test API", version: "1.0.0", description: "A test API" },
      servers: ["https://api.example.com"],
      operations: [],
      schemas: {},
      security: [],
    };

    expect(spec.info.title).toBe("Test API");
    expect(spec.info.version).toBe("1.0.0");
    expect(spec.info.description).toBe("A test API");
    expect(spec.servers).toHaveLength(1);
    expect(spec.operations).toHaveLength(0);
    expect(spec.schemas).toEqual({});
    expect(spec.security).toHaveLength(0);
  });

  it("should construct a valid GeneratorConfig object", () => {
    const config: GeneratorConfig = {
      outputDir: "./output",
      version: "1.0.0",
      npmScope: "@my-scope",
      pypiName: "my-package",
      geminiApiKey: "test-key",
    };

    expect(config.outputDir).toBe("./output");
    expect(config.version).toBe("1.0.0");
    expect(config.npmScope).toBe("@my-scope");
    expect(config.pypiName).toBe("my-package");
    expect(config.geminiApiKey).toBe("test-key");
  });

  it("should construct a valid GeneratorConfig with only required properties", () => {
    const config: GeneratorConfig = {
      outputDir: "./output",
      version: "2.0.0",
    };

    expect(config.outputDir).toBe("./output");
    expect(config.version).toBe("2.0.0");
    expect(config.npmScope).toBeUndefined();
    expect(config.pypiName).toBeUndefined();
    expect(config.geminiApiKey).toBeUndefined();
  });

  it("should construct a valid GeneratorResult with OutputFile[]", () => {
    const files: OutputFile[] = [
      { path: "src/client.ts", content: "export class Client {}" },
      {
        path: "src/types.ts",
        content: "export interface User {}",
        skipIfExists: true,
      },
    ];

    const result: GeneratorResult = {
      files,
    };

    expect(result.files).toHaveLength(2);
    expect(result.files[0].path).toBe("src/client.ts");
    expect(result.files[0].content).toBe("export class Client {}");
    expect(result.files[0].skipIfExists).toBeUndefined();
    expect(result.files[1].skipIfExists).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should construct a GeneratorResult with an error", () => {
    const result: GeneratorResult = {
      files: [],
      error: "Generation failed",
    };

    expect(result.files).toHaveLength(0);
    expect(result.error).toBe("Generation failed");
  });

  it("should construct a valid Operation object", () => {
    const operation: Operation = {
      operationId: "getUser",
      method: "GET",
      path: "/users/{id}",
      summary: "Get a user by ID",
      description: "Retrieves a single user by their unique identifier",
      tags: ["users"],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": { description: "Successful response" },
        "404": { description: "User not found" },
      },
      security: [{ bearerAuth: [] }],
    };

    expect(operation.operationId).toBe("getUser");
    expect(operation.method).toBe("GET");
    expect(operation.path).toBe("/users/{id}");
    expect(operation.summary).toBe("Get a user by ID");
    expect(operation.description).toBe(
      "Retrieves a single user by their unique identifier"
    );
    expect(operation.tags).toEqual(["users"]);
    expect(operation.parameters).toHaveLength(1);
    expect(operation.responses).toHaveProperty("200");
    expect(operation.responses).toHaveProperty("404");
    expect(operation.security).toHaveLength(1);
  });

  it("should construct an Operation with only required properties", () => {
    const operation: Operation = {
      operationId: "listUsers",
      method: "GET",
      path: "/users",
      tags: [],
      parameters: [],
      responses: { "200": { description: "OK" } },
    };

    expect(operation.operationId).toBe("listUsers");
    expect(operation.method).toBe("GET");
    expect(operation.path).toBe("/users");
    expect(operation.summary).toBeUndefined();
    expect(operation.description).toBeUndefined();
    expect(operation.tags).toHaveLength(0);
    expect(operation.requestBody).toBeUndefined();
    expect(operation.security).toBeUndefined();
  });

  it("should construct a ParsedSpec with operations and schemas", () => {
    const spec: ParsedSpec = {
      info: { title: "Pet Store", version: "2.0.0" },
      servers: ["https://api.petstore.io/v2"],
      operations: [
        {
          operationId: "createPet",
          method: "POST",
          path: "/pets",
          tags: ["pets"],
          parameters: [],
          requestBody: {
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Pet" } },
            },
          },
          responses: { "201": { description: "Pet created" } },
        },
      ],
      schemas: {
        Pet: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
          },
          required: ["id", "name"],
        },
      },
      security: [{ apiKey: [] }],
    };

    expect(spec.info.title).toBe("Pet Store");
    expect(spec.info.description).toBeUndefined();
    expect(spec.operations).toHaveLength(1);
    expect(spec.operations[0].operationId).toBe("createPet");
    expect(spec.operations[0].method).toBe("POST");
    expect(spec.schemas).toHaveProperty("Pet");
    expect(spec.schemas.Pet.properties).toHaveProperty("name");
    expect(spec.security).toHaveLength(1);
  });
});
