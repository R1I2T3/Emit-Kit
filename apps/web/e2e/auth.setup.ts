// apps/web/e2e/auth.setup.ts
import { test as setup } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, "../.playwright/.auth/user.json");

setup("authenticate", async ({ page }) => {
  // TODO: Implement login flow when auth UI is available
  // Example:
  // await page.goto("/login");
  // await page.click('[data-testid="github-login"]');
  // ... handle OAuth redirect ...
  // await page.context().storageState({ path: authFile });
  
  // For now, just save empty auth state
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});

export { authFile };
