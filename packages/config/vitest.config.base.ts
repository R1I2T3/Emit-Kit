import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const firstEquals = trimmed.indexOf("=");
      if (firstEquals !== -1) {
        const key = trimmed.slice(0, firstEquals).trim();
        const val = trimmed.slice(firstEquals + 1).trim();
        process.env[key] = val;
      }
    }
  }
}

// Fallback dummy environment variables for tests (e.g. in CI where .env does not exist)
const requiredKeys = {
  DATABASE_URL: "file:./local.db",
  BETTER_AUTH_SECRET: "abcdefghijklmnopqrstuvwxyz012345",
  BETTER_AUTH_URL: "http://localhost:3000",
  CORS_ORIGIN: "http://localhost:3001",
  GITHUB_CLIENT_ID: "mock-github-client-id",
  GITHUB_CLIENT_SECRET: "mock-github-client-secret",
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

for (const [key, fallback] of Object.entries(requiredKeys)) {
  if (!process.env[key]) {
    process.env[key] = fallback;
  }
}

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    passWithNoTests: true,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
      "**/sanity.test.ts",
      "**/e2e/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/*.config.ts",
        "**/*.config.js",
        "**/*.d.ts",
        "**/sanity.test.ts",
      ],
    },
  },
});

