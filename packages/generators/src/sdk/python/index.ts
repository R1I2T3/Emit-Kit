import type {
  Generator,
  ParsedSpec,
  GeneratorConfig,
  GeneratorResult,
  OutputFile,
} from "../../types";
import { generatePythonClient } from "./client";
import { generatePythonTypes } from "./types";
import { generatePythonResources } from "./resources";

export function generatePythonInit(spec: ParsedSpec): string {
  const title = spec.info.title || "API";
  return `# Auto-generated ${title} SDK
# Do not edit manually

from .client import Client
from .errors import EmitError, EmitHttpError

__all__ = ["Client", "EmitError", "EmitHttpError"]
`;
}

export function generatePythonErrors(): string {
  return `# Auto-generated error classes
# Do not edit manually

class EmitError(Exception):
    """Base error class for the SDK."""
    pass


class EmitHttpError(EmitError):
    """HTTP error class for the SDK."""

    def __init__(self, message: str, status_code: int, body: object = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body
`;
}

export function generatePyProjectToml(
  spec: ParsedSpec,
  config: GeneratorConfig
): string {
  const rawName = spec.info.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const name = config.pypiName || rawName;

  return `[project]
name = "${name}"
version = "${config.version}"
description = "${spec.info.description || `Python SDK for ${spec.info.title}`}"
readme = "README.md"
requires-python = ">=3.8"
dependencies = [
    "httpx>=0.20.0",
    "pydantic>=2.0.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
`;
}

export class PythonSDKGenerator implements Generator {
  async generate(
    spec: ParsedSpec,
    config: GeneratorConfig
  ): Promise<GeneratorResult> {
    try {
      const files: OutputFile[] = [];

      // Generate __init__.py
      files.push({
        path: `${config.outputDir}/sdk/python/__init__.py`,
        content: generatePythonInit(spec),
      });

      // Generate client.py
      files.push({
        path: `${config.outputDir}/sdk/python/client.py`,
        content: generatePythonClient(spec),
      });

      // Generate types.py
      files.push({
        path: `${config.outputDir}/sdk/python/types.py`,
        content: generatePythonTypes(spec.schemas),
      });

      // Generate errors.py
      files.push({
        path: `${config.outputDir}/sdk/python/errors.py`,
        content: generatePythonErrors(),
      });

      // Generate resources (one file per tag)
      const resourceFiles = generatePythonResources(spec.operations, config);
      files.push(...resourceFiles);

      // Generate resources package init
      files.push({
        path: `${config.outputDir}/sdk/python/resources/__init__.py`,
        content: `# Resources package
`,
      });

      // Generate README.md
      files.push({
        path: `${config.outputDir}/sdk/python/README.md`,
        content: `# ${spec.info.title} Python SDK\n\n${spec.info.description || `Python SDK for ${spec.info.title}`}\n`,
      });

      // Generate pyproject.toml
      files.push({
        path: `${config.outputDir}/sdk/python/pyproject.toml`,
        content: generatePyProjectToml(spec, config),
      });

      return { files };
    } catch (error: any) {
      return { files: [], error: error.message };
    }
  }
}
