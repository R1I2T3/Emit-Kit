import { describe, it, expect } from "vitest";
import { PythonSDKGenerator, generatePythonInit, generatePythonErrors, generatePyProjectToml } from "./index";
import type { ParsedSpec, GeneratorConfig } from "../../types";

describe("Python SDK Generator", () => {
  const minimalSpec: ParsedSpec = {
    info: { title: "Test API", version: "1.0.0", description: "Test Description" },
    servers: ["https://api.example.com"],
    operations: [
      {
        operationId: "getUser",
        method: "GET",
        path: "/users/{id}",
        tags: ["users"],
        parameters: [{ name: "id", in: "path", required: true }],
        responses: { "200": { description: "Success" } },
      },
      {
        operationId: "createUser",
        method: "POST",
        path: "/users",
        tags: ["users"],
        parameters: [],
        requestBody: { content: { "application/json": {} } },
        responses: { "201": { description: "Created" } },
      },
      {
        operationId: "getPet",
        method: "GET",
        path: "/pets/{id}",
        tags: ["pets"],
        parameters: [{ name: "id", in: "path", required: true }],
        responses: { "200": { description: "Success" } },
      }
    ],
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id"],
      },
    },
    security: [],
  };

  const config: GeneratorConfig = {
    outputDir: "output",
    version: "2.1.0",
    pypiName: "custom-sdk-pypi",
  };

  it("should generate all expected files", async () => {
    const generator = new PythonSDKGenerator();
    const result = await generator.generate(minimalSpec, config);

    expect(result.error).toBeUndefined();
    expect(result.files).toHaveLength(9); // init, client, types, errors, pyproject, readme, resources init, and 2 resources (users, pets)

    const paths = result.files.map((f) => f.path);
    expect(paths).toContain("output/sdk/python/__init__.py");
    expect(paths).toContain("output/sdk/python/client.py");
    expect(paths).toContain("output/sdk/python/types.py");
    expect(paths).toContain("output/sdk/python/errors.py");
    expect(paths).toContain("output/sdk/python/README.md");
    expect(paths).toContain("output/sdk/python/pyproject.toml");
    expect(paths).toContain("output/sdk/python/resources/users.py");
    expect(paths).toContain("output/sdk/python/resources/pets.py");
    expect(paths).toContain("output/sdk/python/resources/__init__.py");
  });

  it("should generate correct __init__.py", () => {
    const content = generatePythonInit(minimalSpec);
    expect(content).toContain("from .client import Client");
    expect(content).toContain("from .errors import EmitError, EmitHttpError");
    expect(content).toContain('__all__ = ["Client", "EmitError", "EmitHttpError"]');
  });

  it("should generate correct errors.py", () => {
    const content = generatePythonErrors();
    expect(content).toContain("class EmitError(Exception):");
    expect(content).toContain("class EmitHttpError(EmitError):");
    expect(content).toContain("self.status_code = status_code");
  });

  it("should generate correct pyproject.toml", () => {
    const content = generatePyProjectToml(minimalSpec, config);
    expect(content).toContain('name = "custom-sdk-pypi"');
    expect(content).toContain('version = "2.1.0"');
    expect(content).toContain("httpx>=0.20.0");
    expect(content).toContain("pydantic>=2.0.0");
  });

  it("should handle empty operations", async () => {
    const emptySpec: ParsedSpec = {
      info: { title: "Empty API", version: "0.0.1" },
      servers: [],
      operations: [],
      schemas: {},
      security: [],
    };

    const generator = new PythonSDKGenerator();
    const result = await generator.generate(emptySpec, config);

    expect(result.error).toBeUndefined();
    // should generate init, client, types, errors, resources __init__.py, pyproject, readme
    expect(result.files).toHaveLength(7);
  });
});
