import type {
  Generator,
  ParsedSpec,
  GeneratorConfig,
  GeneratorResult,
  OutputFile,
  Operation,
} from "../types";
import { enrichOperationDocs } from "./gemini";

export class DocsGenerator implements Generator {
  async generate(
    spec: ParsedSpec,
    config: GeneratorConfig
  ): Promise<GeneratorResult> {
    try {
      const files: OutputFile[] = [];

      // Generate README
      files.push({
        path: `${config.outputDir}/docs/v${config.version}/README.md`,
        content: generateReadme(spec, config.version),
      });

      // Group operations by tag
      const byTag = new Map<string, Operation[]>();
      for (const op of spec.operations) {
        const tag = op.tags[0] || "default";
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag)!.push(op);
      }

      // Generate markdown per tag
      for (const [tag, operations] of byTag) {
        let content = `# ${tag}\n\n`;

        for (const op of operations) {
          // Try Gemini enrichment if API key available
          if (config.geminiApiKey) {
            try {
              const enriched = await enrichOperationDocs(op, config.geminiApiKey);
              content += enriched + "\n\n";
            } catch (error) {
              content += generatePlainDocs(op) + "\n\n";
            }
          } else {
            content += generatePlainDocs(op) + "\n\n";
          }
        }

        const tagFileName = tag
          .split(/[\s-]+/)
          .join("_")
          .toLowerCase();

        files.push({
          path: `${config.outputDir}/docs/v${config.version}/${tagFileName}.md`,
          content,
        });
      }

      return { files };
    } catch (error: any) {
      return { files: [], error: error.message };
    }
  }
}

function generateReadme(spec: ParsedSpec, version: string): string {
  const title = spec.info.title || "API";
  const desc = spec.info.description || `Documentation for ${title}`;
  const servers = spec.servers.length > 0
    ? spec.servers.map((s) => `- ${s}`).join("\n")
    : "None specified";

  // Group tags to build a table of contents
  const tags = new Set<string>();
  for (const op of spec.operations) {
    tags.add(op.tags[0] || "default");
  }

  const toc = Array.from(tags)
    .map((tag) => {
      const tagFileName = tag
        .split(/[\s-]+/)
        .join("_")
        .toLowerCase();
      return `- [${tag}](./${tagFileName}.md)`;
    })
    .join("\n");

  return `# ${title} SDK Documentation

Version: ${version}
API Version: ${spec.info.version || "1.0.0"}

## Description

${desc}

## API Servers

${servers}

## Table of Contents

${toc || "No endpoints defined."}
`;
}

function generatePlainDocs(op: Operation): string {
  const params = op.parameters && op.parameters.length > 0
    ? op.parameters
        .map((p) => `- **${p.name}** (\`${p.in}\`): ${p.description || "No description"}`)
        .join("\n")
    : "None";

  const responses = op.responses
    ? Object.entries(op.responses)
        .map(([code, r]: [string, any]) => `- **${code}**: ${r.description || "No description"}`)
        .join("\n")
    : "None";

  return `## ${op.operationId}

**${op.method} ${op.path}**

${op.summary || op.description || "No description provided."}

### Parameters

${params}

### Responses

${responses}
`;
}
