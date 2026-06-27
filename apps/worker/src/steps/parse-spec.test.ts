import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseSpec } from "./parse-spec";
import SwaggerParser from "@apidevtools/swagger-parser";

vi.mock("@apidevtools/swagger-parser", () => {
  return {
    default: {
      validate: vi.fn(),
    },
  };
});

describe("parse-spec.ts - parseSpec", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail if spec content is empty", async () => {
    await expect(parseSpec("")).rejects.toThrow("Spec content is empty");
  });

  it("should fail if spec content is not valid JSON or YAML", async () => {
    await expect(parseSpec("{invalid-json")).rejects.toThrow(
      "Failed to parse spec content as JSON or YAML"
    );
  });

  it("should fail if SwaggerParser validation fails", async () => {
    vi.mocked(SwaggerParser.validate).mockRejectedValueOnce(new Error("Invalid version"));
    await expect(parseSpec('{"openapi": "3.0.0"}')).rejects.toThrow(
      "SwaggerParser validation failed: Invalid version"
    );
  });

  it("should parse and return ParsedSpec format for valid JSON/YAML", async () => {
    const mockApi = {
      openapi: "3.0.0",
      info: { title: "Test API", version: "1.2.3" },
      servers: [{ url: "https://api.example.com" }],
      components: {
        schemas: {
          User: { type: "object" },
        },
      },
      security: [{ ApiKeyAuth: [] }],
      paths: {
        "/users": {
          get: {
            operationId: "getUsers",
            summary: "List users",
            tags: ["Users"],
            parameters: [
              { name: "limit", in: "query", required: false },
            ],
            responses: {
              "200": { description: "Success" },
            },
          },
        },
        "/users/{id}": {
          post: {
            summary: "Create/Update user",
            // missing operationId should fallback to post_/users/{id}
            parameters: [
              { name: "id", in: "path", required: true },
            ],
            requestBody: { content: { "application/json": {} } },
            responses: {},
          },
        },
      },
    };

    vi.mocked(SwaggerParser.validate).mockResolvedValueOnce(mockApi as any);

    const content = `
info:
  title: Test API
  version: 1.2.3
paths:
  /users:
    get:
      operationId: getUsers
      summary: List users
      tags: [Users]
`;
    const result = await parseSpec(content);

    expect(result.info).toEqual({ title: "Test API", version: "1.2.3" });
    expect(result.servers).toEqual(["https://api.example.com"]);
    expect(result.schemas).toEqual({ User: { type: "object" } });
    expect(result.security).toEqual([{ ApiKeyAuth: [] }]);
    expect(result.operations).toHaveLength(2);

    expect(result.operations[0]).toEqual({
      operationId: "getUsers",
      method: "GET",
      path: "/users",
      summary: "List users",
      description: undefined,
      tags: ["Users"],
      parameters: [{ name: "limit", in: "query", required: false }],
      requestBody: undefined,
      responses: { "200": { description: "Success" } },
      security: undefined,
    });

    expect(result.operations[1]).toEqual({
      operationId: "post_/users/{id}",
      method: "POST",
      path: "/users/{id}",
      summary: "Create/Update user",
      description: undefined,
      tags: [],
      parameters: [{ name: "id", in: "path", required: true }],
      requestBody: { content: { "application/json": {} } },
      responses: {},
      security: undefined,
    });
  });
});
