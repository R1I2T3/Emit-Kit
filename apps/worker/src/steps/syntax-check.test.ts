import { describe, it, expect, vi, beforeEach } from "vitest";
import { syntaxCheckAndFormat } from "./syntax-check";
import type { OutputFile } from "@Emitkit/generators";
import { exec } from "child_process";

// Mock exec to simulate command line tool execution
vi.mock("child_process", () => {
  const mockExec = vi.fn((cmd: string, options: any, callback: any) => {
    const cb = typeof options === "function" ? options : callback;
    if (cb) {
      cb(null, { stdout: "success", stderr: "" });
    }
  });
  return { exec: mockExec };
});

describe("Syntax Check & Format Step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should process TypeScript files, invoke tsc and prettier, and return formatted files", async () => {
    const files: OutputFile[] = [
      {
        path: ".emitkit/sdk/typescript/types.ts",
        content: "export interface User { id: string }",
      },
      {
        path: ".emitkit/sdk/typescript/client.ts",
        content: "export class Client {}",
      },
      {
        path: ".emitkit/cli/index.ts",
        content: "console.log('CLI')",
      }
    ];

    const result = await syntaxCheckAndFormat(files, "run-ts-123");

    // All files should be returned
    expect(result).toHaveLength(3);

    // TypeScript tools should be executed
    expect(exec).toHaveBeenCalled();
    const calls = vi.mocked(exec).mock.calls;
    const commands = calls.map((c) => c[0]);
    expect(commands.some((cmd) => cmd.includes("tsc"))).toBe(true);
    expect(commands.some((cmd) => cmd.includes("prettier"))).toBe(true);
  });

  it("should process Python files, invoke ruff check and format, and return files", async () => {
    const files: OutputFile[] = [
      {
        path: ".emitkit/sdk/python/client.py",
        content: "class Client: pass",
      },
      {
        path: ".emitkit/docs/v1.0.0/README.md",
        content: "# Docs",
      }
    ];

    const result = await syntaxCheckAndFormat(files, "run-py-123");

    expect(result).toHaveLength(2);

    expect(exec).toHaveBeenCalled();
    const calls = vi.mocked(exec).mock.calls;
    const commands = calls.map((c) => c[0]);
    expect(commands.some((cmd) => cmd.includes("ruff check"))).toBe(true);
    expect(commands.some((cmd) => cmd.includes("ruff format"))).toBe(true);
  });

  it("should exclude TS files if tsc fails, but keep others", async () => {
    // Force exec to fail for tsc
    vi.mocked(exec).mockImplementation(((cmd: string, options: any, callback: any) => {
      const cb = typeof options === "function" ? options : callback;
      if (cmd.includes("tsc")) {
        cb(new Error("TS compilation failed"), { stdout: "", stderr: "Error details" });
      } else {
        cb(null, { stdout: "", stderr: "" });
      }
    }) as any);

    const files: OutputFile[] = [
      {
        path: ".emitkit/sdk/typescript/types.ts",
        content: "export interface User { id: string }",
      },
      {
        path: ".emitkit/docs/v1.0.0/README.md",
        content: "# Docs",
      }
    ];

    const result = await syntaxCheckAndFormat(files, "run-ts-fail-123");

    // TypeScript files should be excluded due to compilation failure
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe(".emitkit/docs/v1.0.0/README.md");
  });

  it("should still include Python files if ruff fails (non-fatal warning)", async () => {
    vi.mocked(exec).mockImplementation(((cmd: string, options: any, callback: any) => {
      const cb = typeof options === "function" ? options : callback;
      if (cmd.includes("ruff")) {
        cb(new Error("Ruff failed"), { stdout: "", stderr: "Syntax error" });
      } else {
        cb(null, { stdout: "", stderr: "" });
      }
    }) as any);

    const files: OutputFile[] = [
      {
        path: ".emitkit/sdk/python/client.py",
        content: "class Client: pass",
      },
    ];

    const result = await syntaxCheckAndFormat(files, "run-py-fail-123");

    // Python files are included even on failure
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe(".emitkit/sdk/python/client.py");
  });
});
