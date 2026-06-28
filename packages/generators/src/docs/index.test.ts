import { describe, it, expect, vi, beforeEach } from "vitest";
import { DocsGenerator } from "./index";
import * as gemini from "./gemini";
import type { ParsedSpec, GeneratorConfig } from "../types";

vi.mock("./gemini", () => ({
  enrichOperationDocs: vi.fn().mockResolvedValue("## Enriched Operation\n\nGemini-powered docs snippet."),
}));

describe("Docs Generator", () => {
  const spec: ParsedSpec = {
    info: { title: "Pet Store", version: "1.0.0", description: "Manage your pet store" },
    servers: ["https://api.petstore.com/v1"],
    operations: [
      {
        operationId: "getPet",
        method: "GET",
        path: "/pets/{id}",
        tags: ["pets"],
        parameters: [
          { name: "id", in: "path", required: true, description: "Pet ID" }
        ],
        responses: {
          "200": { description: "Success response" },
        },
      },
      {
        operationId: "orderPet",
        method: "POST",
        path: "/store/order",
        tags: ["store"],
        parameters: [],
        responses: {
          "201": { description: "Order created" },
        },
      }
    ],
    schemas: {},
    security: [],
  };

  const config: GeneratorConfig = {
    outputDir: "out",
    version: "2.0.0",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate README.md and plain markdown tag files when API key is missing", async () => {
    const generator = new DocsGenerator();
    const result = await generator.generate(spec, config);

    expect(result.error).toBeUndefined();
    expect(result.files).toHaveLength(3); // README, pets.md, store.md

    const paths = result.files.map((f) => f.path);
    expect(paths).toContain("out/docs/v2.0.0/README.md");
    expect(paths).toContain("out/docs/v2.0.0/pets.md");
    expect(paths).toContain("out/docs/v2.0.0/store.md");

    const readme = result.files.find((f) => f.path === "out/docs/v2.0.0/README.md")!;
    expect(readme.content).toContain("# Pet Store SDK Documentation");
    expect(readme.content).toContain("Version: 2.0.0");
    expect(readme.content).toContain("Manage your pet store");
    expect(readme.content).toContain("- [pets](./pets.md)");
    expect(readme.content).toContain("- [store](./store.md)");

    const petsMd = result.files.find((f) => f.path === "out/docs/v2.0.0/pets.md")!;
    expect(petsMd.content).toContain("# pets");
    expect(petsMd.content).toContain("## getPet");
    expect(petsMd.content).toContain("GET /pets/{id}");
    expect(petsMd.content).toContain("- **id** (`path`): Pet ID");
    expect(petsMd.content).toContain("- **200**: Success response");

    expect(gemini.enrichOperationDocs).not.toHaveBeenCalled();
  });

  it("should attempt Gemini enrichment when API key is present", async () => {
    const generator = new DocsGenerator();
    const result = await generator.generate(spec, {
      ...config,
      geminiApiKey: "fake-key",
    });

    expect(result.error).toBeUndefined();
    expect(result.files).toHaveLength(3);
    expect(gemini.enrichOperationDocs).toHaveBeenCalledTimes(2);

    const petsMd = result.files.find((f) => f.path === "out/docs/v2.0.0/pets.md")!;
    expect(petsMd.content).toContain("## Enriched Operation");
    expect(petsMd.content).toContain("Gemini-powered docs snippet.");
  });

  it("should fallback to plain docs if Gemini fails", async () => {
    (gemini.enrichOperationDocs as any).mockRejectedValueOnce(new Error("API Error"));

    const generator = new DocsGenerator();
    const result = await generator.generate(spec, {
      ...config,
      geminiApiKey: "fake-key",
    });

    expect(result.error).toBeUndefined();
    expect(result.files).toHaveLength(3);

    const petsMd = result.files.find((f) => f.path === "out/docs/v2.0.0/pets.md")!;
    expect(petsMd.content).toContain("## getPet"); // plain doc structure
    expect(petsMd.content).toContain("GET /pets/{id}");
  });
});
