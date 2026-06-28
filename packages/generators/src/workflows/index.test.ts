import { describe, it, expect } from "vitest";
import { generateNpmWorkflow, generatePyPIWorkflow } from "./index";

describe("Workflow Generators", () => {
  describe("generateNpmWorkflow", () => {
    it("should generate a valid npm workflow string with the correct output directory", () => {
      const outputDir = "dist-output";
      const workflow = generateNpmWorkflow(outputDir);

      expect(workflow).toContain("name: Publish to npm");
      expect(workflow).toContain("on:");
      expect(workflow).toContain("pull_request:");
      expect(workflow).toContain("branches: [main]");
      expect(workflow).toContain(`cd ${outputDir}/sdk/typescript && npm install && npm run build --if-present && npm publish`);
      expect(workflow).toContain("NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}");
    });
  });

  describe("generatePyPIWorkflow", () => {
    it("should generate a valid PyPI workflow string with the correct output directory", () => {
      const outputDir = "dist-output";
      const workflow = generatePyPIWorkflow(outputDir);

      expect(workflow).toContain("name: Publish to PyPI");
      expect(workflow).toContain("on:");
      expect(workflow).toContain("pull_request:");
      expect(workflow).toContain("branches: [main]");
      expect(workflow).toContain(`cd ${outputDir}/sdk/python && pip install build && python -m build`);
      expect(workflow).toContain("uses: pypa/gh-action-pypi-publish@release/v1");
      expect(workflow).toContain(`packages-dir: ${outputDir}/sdk/python/dist/`);
    });
  });
});
