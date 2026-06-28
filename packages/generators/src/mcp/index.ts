import type {
  Generator,
  ParsedSpec,
  GeneratorConfig,
  GeneratorResult,
  OutputFile,
  Operation,
} from "../types";

export class MCPGenerator implements Generator {
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
        path: `${config.outputDir}/mcp/index.ts`,
        content: generateMCPServer(spec),
      });

      files.push({
        path: `${config.outputDir}/mcp/package.json`,
        content: JSON.stringify(
          {
            name: `${titleLower}-mcp`,
            version: config.version,
            description: spec.info.description || `MCP Server for ${spec.info.title}`,
            type: "module",
            main: "./dist/index.js",
            exports: {
              ".": {
                import: "./dist/index.js",
                types: "./dist/index.d.ts",
              },
            },
            scripts: {
              build: "tsc",
              start: "node ./dist/index.js",
            },
            dependencies: {
              "@modelcontextprotocol/sdk": "^1.0.1",
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
        path: `${config.outputDir}/mcp/tsconfig.json`,
        content: JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "NodeNext",
              moduleResolution: "NodeNext",
              outDir: "./dist",
              rootDir: "./",
              strict: true,
              esModuleInterop: true,
              skipLibCheck: true,
            },
            include: ["index.ts"],
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

function openApiTypeToMcp(type: string): string {
  switch (type) {
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return "array";
    case "object":
      return "object";
    default:
      return "string";
  }
}

function buildToolInputSchema(op: Operation): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const p of op.parameters) {
    const type = p.schema?.type ? openApiTypeToMcp(p.schema.type) : "string";
    properties[p.name] = {
      type,
      description: p.description || `Parameter ${p.name}`,
    };
    if (p.required) {
      required.push(p.name);
    }
  }

  if (op.requestBody) {
    properties["body"] = {
      type: "object",
      description: "Request body content",
    };
    // Since request body schemas can be complex, represent it as an object
    // We can check if requestBody is required
    if (op.requestBody.required) {
      required.push("body");
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function generateMCPServer(spec: ParsedSpec): string {
  const title = spec.info.title || "API";
  const version = spec.info.version || "1.0.0";

  const tools = spec.operations.map((op) => {
    return {
      name: op.operationId,
      description: op.summary || op.description || `Call operation ${op.operationId}`,
      inputSchema: buildToolInputSchema(op),
    };
  });

  const toolMatchCases = spec.operations
    .map((op) => {
      return `    case "${op.operationId}": {
      // Mock / dynamic implementation of ${op.operationId}
      console.error("Calling tool ${op.operationId} with args:", args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message: "Mock response from tool ${op.operationId}",
              received_arguments: args,
            }, null, 2),
          },
        ],
      };
    }`;
    })
    .join("\n\n");

  return `// Auto-generated MCP Server
// Do not edit manually

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "${title.replace(/"/g, '\\"')}",
    version: "${version.replace(/"/g, '\\"')}",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register list of tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: ${JSON.stringify(tools, null, 6)},
  };
});

// Register tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
${toolMatchCases}
    default:
      throw new Error(\`Unknown tool: \${name}\`);
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server running on stdio");
}

run().catch((error) => {
  console.error("Fatal error running MCP Server:", error);
  process.exit(1);
});
`;
}
