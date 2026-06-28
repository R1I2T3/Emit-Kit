import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, rm, readFile } from "fs/promises";
import path from "path";
import type { OutputFile } from "@Emitkit/generators";

const execAsync = promisify(exec);

export async function syntaxCheckAndFormat(
  files: OutputFile[],
  runId: string
): Promise<OutputFile[]> {
  const tempDir = `/tmp/emitkit-${runId}`;

  try {
    // Create temp dir
    await mkdir(tempDir, { recursive: true });

    // Write files
    for (const file of files) {
      const fullPath = path.join(tempDir, file.path);
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, file.content);
    }

    const validatedFiles: OutputFile[] = [];

    // Check TypeScript files
    const tsFiles = files.filter((f) => f.path.includes("/typescript/"));
    if (tsFiles.length > 0) {
      try {
        // Look for typescript directory path
        // e.g. f.path starts with config.outputDir + "/sdk/typescript/..."
        const tsFirstFile = tsFiles[0].path;
        const tsSubDirIndex = tsFirstFile.indexOf("/typescript/");
        const tsDir = path.join(
          tempDir,
          tsFirstFile.substring(0, tsSubDirIndex + "/typescript".length)
        );

        // We run tsc and prettier in the typescript dir
        await execAsync(`npx tsc --noEmit --strict`, { cwd: tsDir });
        await execAsync(`npx prettier --write "**/*.ts"`, { cwd: tsDir });

        // Read back formatted files
        for (const file of tsFiles) {
          const fullPath = path.join(tempDir, file.path);
          const formatted = await readFile(fullPath, "utf-8");
          validatedFiles.push({ ...file, content: formatted });
        }
      } catch (error: any) {
        console.error("TypeScript syntax check failed:", error.message);
        // Exclude TS files from commit (do not push to validatedFiles)
      }
    }

    // Check Python files
    const pyFiles = files.filter((f) => f.path.includes("/python/"));
    if (pyFiles.length > 0) {
      try {
        const pyFirstFile = pyFiles[0].path;
        const pySubDirIndex = pyFirstFile.indexOf("/python/");
        const pyDir = path.join(
          tempDir,
          pyFirstFile.substring(0, pySubDirIndex + "/python".length)
        );

        // Check with ruff (if ruff is available on the system, otherwise it will warn)
        await execAsync(`ruff check --fix .`, { cwd: pyDir });
        await execAsync(`ruff format .`, { cwd: pyDir });

        // Read back formatted files
        for (const file of pyFiles) {
          const fullPath = path.join(tempDir, file.path);
          const formatted = await readFile(fullPath, "utf-8");
          validatedFiles.push({ ...file, content: formatted });
        }
      } catch (error: any) {
        console.warn("Python formatting warning/error:", error.message);
        // Still include Python files (ruff warnings/errors are non-fatal in this step)
        validatedFiles.push(...pyFiles);
      }
    }

    // Include other files that don't need compilation/formatting checks (e.g. CLI, MCP, DOCS)
    const otherFiles = files.filter(
      (f) => !f.path.includes("/typescript/") && !f.path.includes("/python/")
    );
    validatedFiles.push(...otherFiles);

    return validatedFiles;
  } finally {
    // Cleanup temp dir
    await rm(tempDir, { recursive: true, force: true });
  }
}
