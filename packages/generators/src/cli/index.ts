import type {
  Generator,
  ParsedSpec,
  GeneratorConfig,
  GeneratorResult,
  OutputFile,
  Operation,
} from "../types";

export class CLIGenerator implements Generator {
  async generate(
    spec: ParsedSpec,
    config: GeneratorConfig
  ): Promise<GeneratorResult> {
    try {
      const files: OutputFile[] = [];
      const titleLower = (spec.info.title || "api")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      files.push({
        path: `${config.outputDir}/cli/index.ts`,
        content: generateCLI(spec),
      });

      files.push({
        path: `${config.outputDir}/cli/package.json`,
        content: JSON.stringify(
          {
            name: `${titleLower}-cli`,
            version: config.version,
            description: spec.info.description || `CLI for ${spec.info.title}`,
            type: "module",
            bin: {
              [titleLower]: "./index.js",
            },
            dependencies: {
              commander: "^11.0.0",
            },
            devDependencies: {
              typescript: "^5.0.0",
              "@types/node": "^20.0.0",
            },
          },
          null,
          2
        ),
      });

      files.push({
        path: `${config.outputDir}/cli/tsconfig.json`,
        content: JSON.stringify(
          {
            compilerOptions: {
              target: "ES2020",
              module: "NodeNext",
              moduleResolution: "NodeNext",
              strict: true,
              esModuleInterop: true,
            },
          },
          null,
          2
        ),
      });

      return { files };
    } catch (error: any) {
      return { files: [], error: error.message };
    }
  }
}

function generateCLI(spec: ParsedSpec): string {
  const titleLower = (spec.info.title || "api")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const lines: string[] = [
    "#!/usr/bin/env node",
    "// Auto-generated CLI",
    "// Do not edit manually",
    "",
    "import { Command } from 'commander';",
    "",
    "const program = new Command();",
    "",
    `program`,
    `  .name('${titleLower}')`,
    `  .description('${spec.info.description || `CLI for ${spec.info.title}`}')`,
    `  .version('${spec.info.version || "1.0.0"}');`,
    "",
  ];

  for (const op of spec.operations) {
    const pathParams = op.parameters.filter((p: any) => p.in === "path");
    const queryParams = op.parameters.filter((p: any) => p.in === "query");
    const hasBody = !!op.requestBody;

    // Define command arguments from path parameters
    const cmdArgs = pathParams.map((p: any) => `<${p.name}>`).join(" ");
    const cmdStr = cmdArgs ? `${op.operationId} ${cmdArgs}` : op.operationId;

    const opLines: string[] = [];
    opLines.push(`program`);
    opLines.push(`  .command('${cmdStr}')`);
    opLines.push(`  .description('${op.summary || op.description || `Execute ${op.operationId}`}')`);

    // Add query parameter options
    for (const q of queryParams) {
      const desc = q.description ? `, '${q.description}'` : "";
      opLines.push(`  .option('--${q.name} <value>'${desc})`);
    }

    // Add body option if needed
    if (hasBody) {
      opLines.push(`  .option('--body <json>', 'JSON request body string')`);
    }

    // Add action handler
    const actionArgs = pathParams.map((p: any) => p.name);
    actionArgs.push("options");
    const actionArgsStr = actionArgs.join(", ");

    opLines.push(`  .action(async (${actionArgsStr}) => {`);
    opLines.push(`    console.log('Executing ${op.operationId}');`);
    
    if (pathParams.length > 0) {
      opLines.push(`    console.log('Path parameters:', { ${pathParams.map((p: any) => p.name).join(", ")} });`);
    }
    opLines.push(`    console.log('Options:', options);`);
    opLines.push(`  });`);
    opLines.push("");

    lines.push(opLines.join("\n"));
  }

  lines.push("program.parse();");
  lines.push("");

  return lines.join("\n");
}
