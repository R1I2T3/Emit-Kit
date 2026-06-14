// apps/web/e2e/auth.setup.ts
import { test as setup } from "@playwright/test";
import path from "node:path";

const authFile = path.join(__dirname, "../.playwright/.auth/user.json");

setup("authenticate", async ({ page }) => {
  // TODO: Implement login flow when auth UI is available
  // Example:
  // await page.goto("/login");
  // await page.click('[data-testid="github-login"]');
  // ... handle OAuth redirect ...
  // await page.context().storageState({ path: authFile });
  
  // For now, just save empty auth state
  await page.context().storageState({ path: authFile });
});

export { authFile };
