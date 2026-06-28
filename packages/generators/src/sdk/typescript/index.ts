/**
 * TypeScript SDK Generator
 *
 * Takes a ParsedSpec and generates a complete TypeScript SDK including:
 * - Type definitions from schemas
 * - HTTP client class
 * - Error classes
 * - Resource classes grouped by tag
 * - Custom stubs for user extension
 * - Package configuration files
 */

import type {
  Generator,
  ParsedSpec,
  GeneratorConfig,
  GeneratorResult,
  OutputFile,
  Operation,
} from "../../types";
import { generateTypes } from "./types";
import { generateClient } from "./client";
import { generateResources } from "./resources";

/**
 * Generate error class source code with EmitError and EmitHttpError.
 */
export function generateErrorClasses(): string {
  return `// Auto-generated error classes
// Do not edit manually

export class EmitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmitError";
  }
}

export class EmitHttpError extends EmitError {
  public readonly statusCode: number;
  public readonly body: unknown;

  constructor(message: string, statusCode: number, body?: unknown) {
    super(message);
    this.name = "EmitHttpError";
    this.statusCode = statusCode;
    this.body = body;
  }
}
`;
}

/**
 * Generate a package.json for the SDK.
 */
export function generatePackageJson(
  spec: ParsedSpec,
  config: GeneratorConfig
): string {
  const rawName = spec.info.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const name = config.npmScope
    ? `@${config.npmScope}/${rawName}`
    : rawName;

  const pkg = {
    name,
    version: config.version,
    description: spec.info.description || `SDK for ${spec.info.title}`,
    type: "module",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        import: "./dist/index.js",
        types: "./dist/index.d.ts",
      },
    },
    scripts: {
      build: "tsc",
    },
    dependencies: {},
    devDependencies: {
      typescript: "^5.0.0",
    },
  };

  return JSON.stringify(pkg, null, 2);
}

/**
 * Convert a tag name to a kebab-case filename.
 */
function toFileName(tag: string): string {
  return tag
    .split(/[\s_]+/)
    .join("-")
    .toLowerCase();
}

/**
 * Convert a tag name to a PascalCase class name.
 */
function toClassName(tag: string): string {
  return tag
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

/**
 * Generate custom stub files for user extension (one per tag).
 * These files are marked skipIfExists so they won't overwrite user changes.
 */
export function generateCustomStubs(operations: Operation[]): OutputFile[] {
  const tags = new Set<string>();
  for (const op of operations) {
    const tag = op.tags.length > 0 ? op.tags[0] : "default";
    tags.add(tag);
  }

  const files: OutputFile[] = [];
  for (const tag of tags) {
    const fileName = toFileName(tag);
    const className = `${toClassName(tag)}ResourceCustom`;
    const baseClassName = `${toClassName(tag)}Resource`;

    files.push({
      path: `sdk/typescript/custom/${fileName}.ts`,
      content: `// Custom extensions for ${tag} resource
// This file will NOT be overwritten by the generator.
// Add your custom methods and overrides here.

import { ${baseClassName} } from "../resources/${fileName}";

export class ${className} extends ${baseClassName} {
  // Add custom methods here
}
`,
    });
  }

  return files;
}

export class TypeScriptSDKGenerator implements Generator {
  async generate(
    spec: ParsedSpec,
    config: GeneratorConfig
  ): Promise<GeneratorResult> {
    try {
      const files: OutputFile[] = [];

      // Generate types.ts from schemas
      files.push({
        path: `${config.outputDir}/sdk/typescript/types.ts`,
        content: generateTypes(spec.schemas),
      });

      // Generate client.ts
      files.push({
        path: `${config.outputDir}/sdk/typescript/client.ts`,
        content: generateClient(spec),
      });

      // Generate errors.ts
      files.push({
        path: `${config.outputDir}/sdk/typescript/errors.ts`,
        content: generateErrorClasses(),
      });

      // Generate resources (one file per tag)
      const resourceFiles = generateResources(spec.operations, config);
      files.push(...resourceFiles);

      // Generate custom stubs (skipIfExists)
      const customStubs = generateCustomStubs(spec.operations);
      files.push(...customStubs.map((f) => ({ ...f, skipIfExists: true as const })));

      // Generate package.json
      files.push({
        path: `${config.outputDir}/sdk/typescript/package.json`,
        content: generatePackageJson(spec, config),
      });

      // Generate tsconfig.json
      files.push({
        path: `${config.outputDir}/sdk/typescript/tsconfig.json`,
        content: JSON.stringify(
          {
            compilerOptions: {
              target: "ES2020",
              module: "ESNext",
              moduleResolution: "bundler",
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
