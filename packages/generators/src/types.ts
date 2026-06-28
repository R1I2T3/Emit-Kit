export interface Generator {
  generate(spec: ParsedSpec, config: GeneratorConfig): Promise<GeneratorResult>;
}

export interface GeneratorResult {
  files: OutputFile[];
  error?: string;
}

export interface OutputFile {
  path: string;
  content: string;
  skipIfExists?: boolean;
}

export interface ParsedSpec {
  info: { title: string; version: string; description?: string };
  servers: string[];
  operations: Operation[];
  schemas: Record<string, any>;
  security: any[];
}

export interface Operation {
  operationId: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: any[];
  requestBody?: any;
  responses: Record<string, any>;
  security?: any[];
}

export interface GeneratorConfig {
  outputDir: string;
  version: string;
  npmScope?: string;
  pypiName?: string;
  geminiApiKey?: string;
}
