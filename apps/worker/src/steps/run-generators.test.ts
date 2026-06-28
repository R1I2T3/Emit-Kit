import { describe, it, expect, vi } from "vitest";
import { runGenerators } from "./run-generators";
import { TypeScriptSDKGenerator } from "@Emitkit/generators/sdk/typescript";
import { PythonSDKGenerator } from "@Emitkit/generators/sdk/python";
import { CLIGenerator } from "@Emitkit/generators/cli";
import { MCPGenerator } from "@Emitkit/generators/mcp";
import { DocsGenerator } from "@Emitkit/generators/docs";

vi.mock("@Emitkit/generators/sdk/typescript", () => {
  return {
    TypeScriptSDKGenerator: vi.fn().mockImplementation(() => ({
      generate: vi.fn().mockResolvedValue({ files: [{ path: "ts.ts", content: "ts" }] }),
    })),
  };
});

vi.mock("@Emitkit/generators/sdk/python", () => {
  return {
    PythonSDKGenerator: vi.fn().mockImplementation(() => ({
      generate: vi.fn().mockResolvedValue({ files: [{ path: "py.py", content: "py" }] }),
    })),
  };
});

vi.mock("@Emitkit/generators/cli", () => {
  return {
    CLIGenerator: vi.fn().mockImplementation(() => ({
      generate: vi.fn().mockResolvedValue({ files: [{ path: "cli.ts", content: "cli" }] }),
    })),
  };
});

vi.mock("@Emitkit/generators/mcp", () => {
  return {
    MCPGenerator: vi.fn().mockImplementation(() => ({
      generate: vi.fn().mockResolvedValue({ files: [{ path: "mcp.ts", content: "mcp" }] }),
    })),
  };
});

vi.mock("@Emitkit/generators/docs", () => {
  return {
    DocsGenerator: vi.fn().mockImplementation(() => ({
      generate: vi.fn().mockResolvedValue({ files: [{ path: "readme.md", content: "readme" }] }),
    })),
  };
});

describe("Run Generators Step", () => {
  const spec = { info: { title: "Test", version: "1" }, operations: [], schemas: {}, security: [], servers: [] };

  it("should run TS and Python SDK generators when SDK is selected and languages are specified", async () => {
    const config = {
      outputs: ["SDK"],
      sdkLanguages: ["typescript", "python"],
      outputDir: ".out/",
    };

    const files = await runGenerators(spec, config, "1.0.0");
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.path)).toContain("ts.ts");
    expect(files.map((f) => f.path)).toContain("py.py");
  });

  it("should run CLI, MCP, and Docs generators when selected", async () => {
    const config = {
      outputs: ["CLI", "MCP", "DOCS"],
      sdkLanguages: [],
      outputDir: ".out/",
    };

    const files = await runGenerators(spec, config, "1.0.0");
    expect(files).toHaveLength(3);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("cli.ts");
    expect(paths).toContain("mcp.ts");
    expect(paths).toContain("readme.md");
  });

  it("should handle config values in JSON string format", async () => {
    const config = {
      outputs: '["SDK", "CLI"]',
      sdkLanguages: '["typescript"]',
      outputDir: ".out/",
    };

    const files = await runGenerators(spec, config, "1.0.0");
    expect(files).toHaveLength(2);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("ts.ts");
    expect(paths).toContain("cli.ts");
  });
});
