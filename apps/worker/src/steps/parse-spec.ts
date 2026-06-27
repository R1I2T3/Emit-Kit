import SwaggerParser from "@apidevtools/swagger-parser";
import jsYaml from "js-yaml";

export interface ParsedOperation {
  operationId: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: any[];
  requestBody?: any;
  responses: Record<string, any>;
  security?: any[];
}

export interface ParsedSpec {
  info: any;
  servers: string[];
  operations: ParsedOperation[];
  schemas: Record<string, any>;
  security: any[];
}

export async function parseSpec(content: string): Promise<ParsedSpec> {
  if (!content) {
    throw new Error("Spec content is empty");
  }

  let specObj: any;
  try {
    specObj = JSON.parse(content);
  } catch {
    try {
      specObj = jsYaml.load(content);
    } catch (yamlError: any) {
      throw new Error(`Failed to parse spec content as JSON or YAML: ${yamlError.message}`);
    }
  }

  if (!specObj || typeof specObj !== "object") {
    throw new Error("Parsed spec is not a valid JSON or YAML object");
  }

  let api: any;
  try {
    // SwaggerParser.validate parses, dereferences, and validates the API spec.
    // We pass a clone to avoid mutating specObj.
    api = await SwaggerParser.validate(JSON.parse(JSON.stringify(specObj)));
  } catch (err: any) {
    throw new Error(`SwaggerParser validation failed: ${err.message}`);
  }

  const info = api.info || {};
  const servers = (api.servers || []).map((s: any) => s.url).filter((url: any) => typeof url === "string");
  const schemas = api.components?.schemas || api.definitions || {};
  const security = api.security || [];

  const operations: ParsedOperation[] = [];
  const paths = api.paths || {};

  for (const path of Object.keys(paths)) {
    const pathItem = paths[path] || {};
    const methods = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
    for (const method of methods) {
      const op = pathItem[method];
      if (op && typeof op === "object") {
        const operationId = op.operationId || `${method}_${path}`;
        operations.push({
          operationId,
          method: method.toUpperCase(),
          path,
          summary: op.summary,
          description: op.description,
          tags: op.tags || [],
          parameters: op.parameters || [],
          requestBody: op.requestBody,
          responses: op.responses || {},
          security: op.security,
        });
      }
    }
  }

  return {
    info,
    servers,
    operations,
    schemas,
    security,
  };
}
