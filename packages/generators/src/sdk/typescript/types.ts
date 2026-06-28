/**
 * Generates TypeScript type/interface declarations from OpenAPI schemas.
 */

/**
 * Convert an OpenAPI type string to a TypeScript type string.
 */
function openApiTypeToTs(schema: any): string {
  if (!schema) return "unknown";

  // Handle $ref
  if (schema.$ref) {
    return extractRefName(schema.$ref);
  }

  // Handle enum
  if (schema.enum) {
    return schema.enum.map((v: any) => (typeof v === "string" ? `"${v}"` : String(v))).join(" | ");
  }

  // Handle allOf (intersection)
  if (schema.allOf) {
    const parts = schema.allOf.map((s: any) => openApiTypeToTs(s));
    return parts.join(" & ");
  }

  // Handle oneOf / anyOf (union)
  if (schema.oneOf || schema.anyOf) {
    const items = schema.oneOf || schema.anyOf;
    const parts = items.map((s: any) => openApiTypeToTs(s));
    return parts.join(" | ");
  }

  // Handle array
  if (schema.type === "array") {
    const itemType = openApiTypeToTs(schema.items);
    return `${itemType}[]`;
  }

  // Handle object with properties (inline)
  if (schema.type === "object" && schema.properties) {
    return generateInlineObject(schema);
  }

  // Handle primitive types
  switch (schema.type) {
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "Record<string, unknown>";
    default:
      return "unknown";
  }
}

/**
 * Extract the type name from a $ref string like "#/components/schemas/User"
 */
function extractRefName(ref: string): string {
  const parts = ref.split("/");
  return parts[parts.length - 1];
}

/**
 * Generate an inline object type string from a schema with properties.
 */
function generateInlineObject(schema: any): string {
  const required = new Set<string>(schema.required || []);
  const lines: string[] = [];
  for (const [propName, propSchema] of Object.entries<any>(schema.properties)) {
    const optional = required.has(propName) ? "" : "?";
    const tsType = openApiTypeToTs(propSchema);
    lines.push(`${propName}${optional}: ${tsType}`);
  }
  return `{ ${lines.join("; ")} }`;
}

/**
 * Generate a single TypeScript interface declaration from an OpenAPI schema.
 */
function generateInterface(name: string, schema: any): string {
  const lines: string[] = [];

  if (schema.description) {
    lines.push(`/** ${schema.description} */`);
  }

  // Handle enum at top level — export as type alias
  if (schema.enum) {
    const enumType = schema.enum
      .map((v: any) => (typeof v === "string" ? `"${v}"` : String(v)))
      .join(" | ");
    lines.push(`export type ${name} = ${enumType};`);
    return lines.join("\n");
  }

  // Handle allOf — extend base types
  if (schema.allOf) {
    const refTypes: string[] = [];
    let mergedProperties: Record<string, any> = {};
    let mergedRequired: string[] = [];

    for (const part of schema.allOf) {
      if (part.$ref) {
        refTypes.push(extractRefName(part.$ref));
      } else if (part.properties) {
        mergedProperties = { ...mergedProperties, ...part.properties };
        if (part.required) {
          mergedRequired = [...mergedRequired, ...part.required];
        }
      }
    }

    const extendsClause = refTypes.length > 0 ? ` extends ${refTypes.join(", ")}` : "";
    lines.push(`export interface ${name}${extendsClause} {`);

    const requiredSet = new Set(mergedRequired);
    for (const [propName, propSchema] of Object.entries<any>(mergedProperties)) {
      const optional = requiredSet.has(propName) ? "" : "?";
      const tsType = openApiTypeToTs(propSchema);
      if ((propSchema as any).description) {
        lines.push(`  /** ${(propSchema as any).description} */`);
      }
      lines.push(`  ${propName}${optional}: ${tsType};`);
    }

    lines.push("}");
    return lines.join("\n");
  }

  // Standard object interface
  lines.push(`export interface ${name} {`);

  const required = new Set<string>(schema.required || []);
  const properties = schema.properties || {};

  for (const [propName, propSchema] of Object.entries<any>(properties)) {
    const optional = required.has(propName) ? "" : "?";
    const tsType = openApiTypeToTs(propSchema);
    if ((propSchema as any).description) {
      lines.push(`  /** ${(propSchema as any).description} */`);
    }
    lines.push(`  ${propName}${optional}: ${tsType};`);
  }

  lines.push("}");
  return lines.join("\n");
}

/**
 * Generate TypeScript type declarations for all schemas.
 *
 * @param schemas - Record of schema name to OpenAPI schema object
 * @returns TypeScript source code string containing all interfaces/types
 */
export function generateTypes(schemas: Record<string, any>): string {
  const lines: string[] = [
    "// Auto-generated TypeScript types from OpenAPI schemas",
    "// Do not edit manually",
    "",
  ];

  for (const [name, schema] of Object.entries(schemas)) {
    lines.push(generateInterface(name, schema));
    lines.push("");
  }

  return lines.join("\n");
}
