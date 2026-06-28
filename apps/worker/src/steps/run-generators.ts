import { TypeScriptSDKGenerator } from "@Emitkit/generators/sdk/typescript";
import { PythonSDKGenerator } from "@Emitkit/generators/sdk/python";
import { CLIGenerator } from "@Emitkit/generators/cli";
import { MCPGenerator } from "@Emitkit/generators/mcp";
import { DocsGenerator } from "@Emitkit/generators/docs";
import type { OutputFile } from "@Emitkit/generators";

export async function runGenerators(
  parsedSpec: any,
  config: any,
  version: string
): Promise<OutputFile[]> {
  const outputs: string[] = typeof config.outputs === "string" 
    ? JSON.parse(config.outputs) 
    : (config.outputs || []);
  
  const languages: string[] = typeof config.sdkLanguages === "string" 
    ? JSON.parse(config.sdkLanguages) 
    : (config.sdkLanguages || []);

  const generatorConfig = {
    outputDir: config.outputDir || ".emitkit/",
    version,
    npmScope: config.sdkNpmScope || undefined,
    pypiName: config.sdkPypiName || undefined,
    geminiApiKey: config.geminiApiKey || undefined,
  };

  const results = await Promise.allSettled([
    outputs.includes("SDK") && languages.includes("typescript")
      ? new TypeScriptSDKGenerator().generate(parsedSpec, generatorConfig)
      : Promise.resolve({ files: [] }),

    outputs.includes("SDK") && languages.includes("python")
      ? new PythonSDKGenerator().generate(parsedSpec, generatorConfig)
      : Promise.resolve({ files: [] }),

    outputs.includes("CLI")
      ? new CLIGenerator().generate(parsedSpec, generatorConfig)
      : Promise.resolve({ files: [] }),

    outputs.includes("MCP")
      ? new MCPGenerator().generate(parsedSpec, generatorConfig)
      : Promise.resolve({ files: [] }),

    outputs.includes("DOCS")
      ? new DocsGenerator().generate(parsedSpec, generatorConfig)
      : Promise.resolve({ files: [] }),
  ]);

  const allFiles: OutputFile[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && !result.value.error) {
      allFiles.push(...result.value.files);
    } else {
      console.error("Generator failed or returned an error:", result);
    }
  }

  return allFiles;
}
