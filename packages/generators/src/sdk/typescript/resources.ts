/**
 * Generates resource files grouped by tag from OpenAPI operations.
 */

import type { Operation, GeneratorConfig, OutputFile } from "../../types";

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
 * Convert a tag name to a kebab-case filename.
 */
function toFileName(tag: string): string {
  return tag
    .split(/[\s_]+/)
    .join("-")
    .toLowerCase();
}

/**
 * Convert an operation ID to a camelCase method name.
 */
function toMethodName(operationId: string): string {
  // Handle camelCase already present
  if (/^[a-z]/.test(operationId) && !operationId.includes("_") && !operationId.includes("-")) {
    return operationId;
  }
  const parts = operationId.split(/[\s_-]+/);
  return parts
    .map((part, index) =>
      index === 0
        ? part.toLowerCase()
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )
    .join("");
}

/**
 * Extract path parameters from an operation's path string.
 */
function extractPathParams(path: string): string[] {
  const matches = path.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1));
}

/**
 * Generate the TypeScript code for path parameter interpolation.
 */
function buildPathExpression(path: string): string {
  // Convert {param} to ${param} for template literal
  return path.replace(/\{([^}]+)\}/g, "${$1}");
}

/**
 * Determine if an operation has query parameters.
 */
function getQueryParams(operation: Operation): any[] {
  return (operation.parameters || []).filter((p: any) => p.in === "query");
}

/**
 * Generate a single resource method.
 */
function generateMethod(operation: Operation): string {
  const methodName = toMethodName(operation.operationId);
  const httpMethod = operation.method.toLowerCase();
  const pathParams = extractPathParams(operation.path);
  const queryParams = getQueryParams(operation);
  const hasBody = !!operation.requestBody;
  const pathExpr = buildPathExpression(operation.path);

  // Build method parameters
  const params: string[] = [];
  for (const p of pathParams) {
    params.push(`${p}: string`);
  }
  if (hasBody) {
    params.push("body: Record<string, unknown>");
  }
  if (queryParams.length > 0) {
    params.push("params?: Record<string, string>");
  }

  const paramString = params.join(", ");

  // Build JSDoc
  const lines: string[] = [];
  if (operation.summary || operation.description) {
    lines.push("  /**");
    if (operation.summary) lines.push(`   * ${operation.summary}`);
    if (operation.description && operation.description !== operation.summary) {
      lines.push(`   * ${operation.description}`);
    }
    lines.push("   */");
  }

  // Build method body
  const callArgs: string[] = [`\`${pathExpr}\``];

  if (httpMethod === "get" || httpMethod === "delete") {
    if (queryParams.length > 0) {
      callArgs.push("params");
    }
    lines.push(`  async ${methodName}(${paramString}): Promise<unknown> {`);
    lines.push(`    return this.client.${httpMethod}(${callArgs.join(", ")});`);
  } else {
    if (hasBody) {
      callArgs.push("body");
    } else {
      callArgs.push("undefined");
    }
    lines.push(`  async ${methodName}(${paramString}): Promise<unknown> {`);
    lines.push(`    return this.client.${httpMethod}(${callArgs.join(", ")});`);
  }

  lines.push("  }");
  return lines.join("\n");
}

/**
 * Generate a complete resource file for a given tag and its operations.
 */
function generateResourceFile(tag: string, operations: Operation[]): string {
  const className = `${toClassName(tag)}Resource`;

  const lines: string[] = [
    `// Auto-generated resource for ${tag}`,
    "// Do not edit manually",
    "",
    'import { Client } from "../client";',
    "",
    `export class ${className} {`,
    "  private client: Client;",
    "",
    "  constructor(client: Client) {",
    "    this.client = client;",
    "  }",
    "",
  ];

  for (let i = 0; i < operations.length; i++) {
    lines.push(generateMethod(operations[i]));
    if (i < operations.length - 1) {
      lines.push("");
    }
  }

  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

/**
 * Group operations by their first tag.
 */
function groupByTag(operations: Operation[]): Map<string, Operation[]> {
  const groups = new Map<string, Operation[]>();
  for (const op of operations) {
    const tag = (op.tags && op.tags.length > 0) ? op.tags[0] : "default";
    const existing = groups.get(tag) || [];
    existing.push(op);
    groups.set(tag, existing);
  }
  return groups;
}

/**
 * Generate resource files (one per tag) from the operations list.
 *
 * @param operations - List of parsed operations
 * @param config - Generator configuration
 * @returns Array of OutputFile objects for each resource
 */
export function generateResources(
  operations: Operation[],
  config: GeneratorConfig
): OutputFile[] {
  const groups = groupByTag(operations);
  const files: OutputFile[] = [];

  for (const [tag, ops] of groups) {
    const fileName = toFileName(tag);
    files.push({
      path: `${config.outputDir}/sdk/typescript/resources/${fileName}.ts`,
      content: generateResourceFile(tag, ops),
    });
  }

  return files;
}
