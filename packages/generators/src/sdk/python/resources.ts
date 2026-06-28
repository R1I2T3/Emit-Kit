/**
 * Generates Python resource files grouped by tag from OpenAPI operations.
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
 * Convert a tag name to a snake_case filename.
 */
function toFileName(tag: string): string {
  return tag
    .split(/[\s-]+/)
    .join("_")
    .toLowerCase();
}

/**
 * Convert an operation ID to a snake_case method name.
 */
function toMethodName(operationId: string): string {
  // Convert camelCase to snake_case
  return operationId
    .replace(/([A-Z])/g, "_$1")
    .replace(/^_/, "")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
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
 * Convert an OpenAPI path to a Python f-string path.
 * E.g., /users/{id} => /users/{id} (already valid Python f-string syntax)
 */
function buildPathExpression(path: string): string {
  return path;
}

/**
 * Determine if an operation has query parameters.
 */
function getQueryParams(operation: Operation): any[] {
  return operation.parameters.filter((p: any) => p.in === "query");
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
  const params: string[] = ["self"];
  for (const p of pathParams) {
    params.push(`${p}: str`);
  }
  if (hasBody) {
    params.push("body: dict[str, Any]");
  }
  if (queryParams.length > 0) {
    params.push("params: Optional[dict[str, str]] = None");
  }

  const paramString = params.join(", ");

  // Build docstring
  const lines: string[] = [];
  lines.push(`    def ${methodName}(${paramString}) -> Any:`);

  if (operation.summary || operation.description) {
    lines.push(`        """${operation.summary || operation.description}"""`);
  }

  // Build method body
  if (httpMethod === "get" || httpMethod === "delete") {
    if (queryParams.length > 0) {
      lines.push(
        `        return self._client.${httpMethod}(f"${pathExpr}", params=params)`
      );
    } else {
      lines.push(
        `        return self._client.${httpMethod}(f"${pathExpr}")`
      );
    }
  } else {
    if (hasBody) {
      lines.push(
        `        return self._client.${httpMethod}(f"${pathExpr}", body=body)`
      );
    } else {
      lines.push(
        `        return self._client.${httpMethod}(f"${pathExpr}")`
      );
    }
  }

  return lines.join("\n");
}

/**
 * Generate a complete resource file for a given tag and its operations.
 */
function generateResourceFile(tag: string, operations: Operation[]): string {
  const className = `${toClassName(tag)}Resource`;

  const lines: string[] = [
    `# Auto-generated resource for ${tag}`,
    "# Do not edit manually",
    "",
    "from typing import Any, Optional",
    "",
    "from .client import Client",
    "",
    "",
    `class ${className}:`,
    `    """Resource for ${tag} operations."""`,
    "",
    "    def __init__(self, client: Client) -> None:",
    "        self._client = client",
    "",
  ];

  for (let i = 0; i < operations.length; i++) {
    lines.push(generateMethod(operations[i]));
    if (i < operations.length - 1) {
      lines.push("");
    }
  }

  lines.push("");

  return lines.join("\n");
}

/**
 * Group operations by their first tag.
 */
function groupByTag(operations: Operation[]): Map<string, Operation[]> {
  const groups = new Map<string, Operation[]>();
  for (const op of operations) {
    const tag = op.tags.length > 0 ? op.tags[0] : "default";
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
export function generatePythonResources(
  operations: Operation[],
  config: GeneratorConfig
): OutputFile[] {
  const groups = groupByTag(operations);
  const files: OutputFile[] = [];

  for (const [tag, ops] of groups) {
    const fileName = toFileName(tag);
    files.push({
      path: `${config.outputDir}/sdk/python/resources/${fileName}.py`,
      content: generateResourceFile(tag, ops),
    });
  }

  return files;
}
