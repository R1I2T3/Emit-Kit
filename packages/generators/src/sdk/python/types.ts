/**
 * Generates Python Pydantic v2 model classes from OpenAPI schemas.
 */

/**
 * Extract the model name from a $ref string like "#/components/schemas/User"
 */
function extractRefName(ref: string): string {
  const parts = ref.split("/");
  return parts[parts.length - 1];
}

/**
 * Convert an OpenAPI type to a Python type string.
 */
function openApiTypeToPython(schema: any): string {
  if (!schema) return "Any";

  // Handle $ref
  if (schema.$ref) {
    return `"${extractRefName(schema.$ref)}"`;
  }

  // Handle enum
  if (schema.enum) {
    return schema.enum
      .map((v: any) => (typeof v === "string" ? `"${v}"` : String(v)))
      .join(" | ");
  }

  // Handle allOf (first ref or Any)
  if (schema.allOf) {
    const parts = schema.allOf.map((s: any) => openApiTypeToPython(s));
    return parts.join(" | ");
  }

  // Handle oneOf / anyOf (union)
  if (schema.oneOf || schema.anyOf) {
    const items = schema.oneOf || schema.anyOf;
    const parts = items.map((s: any) => openApiTypeToPython(s));
    return parts.join(" | ");
  }

  // Handle array
  if (schema.type === "array") {
    const itemType = openApiTypeToPython(schema.items);
    return `list[${itemType}]`;
  }

  // Handle object with properties (inline)
  if (schema.type === "object" && schema.properties) {
    return "dict[str, Any]";
  }

  // Handle primitive types
  switch (schema.type) {
    case "string":
      return "str";
    case "integer":
      return "int";
    case "number":
      return "float";
    case "boolean":
      return "bool";
    case "object":
      return "dict[str, Any]";
    default:
      return "Any";
  }
}

const PYTHON_KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break",
  "class", "continue", "def", "del", "elif", "else", "except", "finally", "for",
  "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not",
  "or", "pass", "raise", "return", "try", "while", "with", "yield"
]);

/**
 * Convert a property name to a valid Python identifier (snake_case).
 */
function toPythonFieldName(name: string): string {
  let cleaned = name.replace(/[-\s]+/g, "_");
  if (/^[0-9]/.test(cleaned)) {
    cleaned = "_" + cleaned;
  }
  if (PYTHON_KEYWORDS.has(cleaned)) {
    cleaned = cleaned + "_";
  }
  return cleaned;
}

/**
 * Generate a single Pydantic model class from an OpenAPI schema.
 */
function generateModel(name: string, schema: any): string {
  const lines: string[] = [];

  // Handle enum at top level — export as Literal type alias
  if (schema.enum) {
    const enumValues = schema.enum
      .map((v: any) => (typeof v === "string" ? `"${v}"` : String(v)))
      .join(", ");
    if (schema.description) {
      lines.push(`# ${schema.description}`);
    }
    lines.push(`${name} = Literal[${enumValues}]`);
    return lines.join("\n");
  }

  // Handle allOf — inheritance
  if (schema.allOf) {
    const baseClasses: string[] = [];
    let mergedProperties: Record<string, any> = {};
    let mergedRequired: string[] = [];

    for (const part of schema.allOf) {
      if (part.$ref) {
        baseClasses.push(extractRefName(part.$ref));
      } else if (part.properties) {
        mergedProperties = { ...mergedProperties, ...part.properties };
        if (part.required) {
          mergedRequired = [...mergedRequired, ...part.required];
        }
      }
    }

    const bases = baseClasses.length > 0 ? baseClasses.join(", ") : "BaseModel";

    if (schema.description) {
      lines.push(`# ${schema.description}`);
    }
    lines.push(`class ${name}(${bases}):`);

    if (schema.description) {
      lines.push(`    """${schema.description}"""`);
      lines.push("");
    }

    const requiredSet = new Set(mergedRequired);
    const propEntries = Object.entries<any>(mergedProperties);

    if (propEntries.length === 0 && !schema.description) {
      lines.push("    pass");
    } else if (propEntries.length === 0) {
      lines.push("    pass");
    }

    for (const [propName, propSchema] of propEntries) {
      const fieldName = toPythonFieldName(propName);
      const pyType = openApiTypeToPython(propSchema);
      const hasAlias = fieldName !== propName;

      if ((propSchema as any).description) {
        lines.push(`    # ${(propSchema as any).description}`);
      }

      if (requiredSet.has(propName)) {
        if (hasAlias) {
          lines.push(`    ${fieldName}: ${pyType} = Field(alias="${propName}")`);
        } else {
          lines.push(`    ${fieldName}: ${pyType}`);
        }
      } else {
        if (hasAlias) {
          lines.push(`    ${fieldName}: Optional[${pyType}] = Field(default=None, alias="${propName}")`);
        } else {
          lines.push(`    ${fieldName}: Optional[${pyType}] = None`);
        }
      }
    }

    return lines.join("\n");
  }

  // Standard object model
  const bases = "BaseModel";

  if (schema.description) {
    lines.push(`# ${schema.description}`);
  }
  lines.push(`class ${name}(${bases}):`);

  if (schema.description) {
    lines.push(`    """${schema.description}"""`);
    lines.push("");
  }

  const required = new Set<string>(schema.required || []);
  const properties = schema.properties || {};
  const propEntries = Object.entries<any>(properties);

  if (propEntries.length === 0) {
    lines.push("    pass");
    return lines.join("\n");
  }

  for (const [propName, propSchema] of propEntries) {
    const fieldName = toPythonFieldName(propName);
    const pyType = openApiTypeToPython(propSchema);
    const hasAlias = fieldName !== propName;

    if ((propSchema as any).description) {
      lines.push(`    # ${(propSchema as any).description}`);
    }

    if (required.has(propName)) {
      if (hasAlias) {
        lines.push(`    ${fieldName}: ${pyType} = Field(alias="${propName}")`);
      } else {
        lines.push(`    ${fieldName}: ${pyType}`);
      }
    } else {
      if (hasAlias) {
        lines.push(`    ${fieldName}: Optional[${pyType}] = Field(default=None, alias="${propName}")`);
      } else {
        lines.push(`    ${fieldName}: Optional[${pyType}] = None`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Determine which imports are needed based on the schemas.
 */
function collectImports(schemas: Record<string, any>): {
  needsOptional: boolean;
  needsAny: boolean;
  needsLiteral: boolean;
} {
  let needsOptional = false;
  let needsAny = false;
  let needsLiteral = false;

  function scanSchema(schema: any): void {
    if (!schema) {
      needsAny = true;
      return;
    }

    if (schema.enum) {
      needsLiteral = true;
      return;
    }

    if (schema.allOf) {
      for (const part of schema.allOf) {
        scanSchema(part);
      }
      return;
    }

    if (schema.oneOf || schema.anyOf) {
      const items = schema.oneOf || schema.anyOf;
      for (const item of items) {
        scanSchema(item);
      }
      return;
    }

    if (schema.type === "array") {
      scanSchema(schema.items);
      return;
    }

    if (schema.type === "object") {
      if (schema.properties) {
        needsAny = true;
        const required = new Set<string>(schema.required || []);
        for (const [propName, propSchema] of Object.entries<any>(
          schema.properties
        )) {
          if (!required.has(propName)) {
            needsOptional = true;
          }
          scanSchema(propSchema);
        }
      } else {
        needsAny = true;
      }
      return;
    }

    if (!schema.type) {
      needsAny = true;
    }
  }

  for (const schema of Object.values(schemas)) {
    scanSchema(schema);
  }

  return { needsOptional, needsAny, needsLiteral };
}

/**
 * Generate Python Pydantic model definitions for all schemas.
 *
 * @param schemas - Record of schema name to OpenAPI schema object
 * @returns Python source code string containing all Pydantic model classes
 */
export function generatePythonTypes(schemas: Record<string, any>): string {
  const lines: string[] = [
    "from __future__ import annotations",
    "# Auto-generated Pydantic models from OpenAPI schemas",
    "# Do not edit manually",
    "",
  ];

  // Collect imports
  const { needsOptional, needsAny, needsLiteral } = collectImports(schemas);

  const typingImports: string[] = [];
  if (needsOptional) typingImports.push("Optional");
  if (needsAny) typingImports.push("Any");
  if (needsLiteral) typingImports.push("Literal");

  if (typingImports.length > 0) {
    lines.push(`from typing import ${typingImports.join(", ")}`);
    lines.push("");
  }

  lines.push("from pydantic import BaseModel, Field");
  lines.push("");
  lines.push("");

  for (const [name, schema] of Object.entries(schemas)) {
    lines.push(generateModel(name, schema));
    lines.push("");
    lines.push("");
  }

  return lines.join("\n");
}
