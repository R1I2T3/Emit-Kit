import { test, expect } from "@playwright/test";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:3001",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-orpc-client",
  "Access-Control-Allow-Credentials": "true",
};

async function fulfillJson(route: any, data: any, status = 200) {
  await route.fulfill({
    status,
    headers: corsHeaders,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
}

test.describe("GitHub OAuth & Dashboard", () => {
  let isAuthenticated = false;

  test.beforeEach(async ({ page }) => {
    isAuthenticated = false;

    // Log all page errors
    page.on("pageerror", (err) => console.log(`[PAGE ERROR]: ${err.message}`));
    page.on("console", (msg) => console.log(`[CONSOLE]: ${msg.type()} ${msg.text()}`));

    // Intercept all backend requests (port 3000)
    await page.route(
      (url) => url.toString().includes(":3000/"),
      async (route) => {
        const req = route.request();
        const urlObj = new URL(req.url());

        console.log(`[MOCK REQUEST]: ${req.method()} ${req.url()}`);

        // Handle OPTIONS preflight request
        if (req.method() === "OPTIONS") {
          await route.fulfill({
            status: 204,
            headers: corsHeaders,
          });
          return;
        }

        // Mock get-session
        if (urlObj.pathname.includes("/api/auth/get-session")) {
          const sessionData = isAuthenticated
            ? {
                user: {
                  id: "user-1",
                  name: "Test User",
                  email: "test@example.com",
                },
                session: {
                  id: "session-1",
                  userId: "user-1",
                  expiresAt: new Date(Date.now() + 3600000).toISOString(),
                },
              }
            : null;

          console.log(`[SESSION MOCK]: isAuthenticated=${isAuthenticated}`);
          await fulfillJson(route, sessionData);
          return;
        }

        // Mock sign-in social
        if (urlObj.pathname.includes("/api/auth/sign-in/social")) {
          isAuthenticated = true;
          console.log(`[SOCIAL SIGN IN MOCK]: Setting isAuthenticated=true`);
          // Fulfill with redirect=true as required by Better-Auth client library
          await fulfillJson(route, {
            redirect: true,
            url: "http://localhost:3001/dashboard",
          });
          return;
        }

        // Mock organization list for dashboard sidebar
        if (urlObj.pathname.includes("/rpc/orgs/list")) {
          await fulfillJson(route, {
            json: [
              { id: "org-1", name: "Test Org", slug: "test-org", githubOrgId: "123" },
              { id: "org-2", name: "Demo Corp", slug: "demo-corp", githubOrgId: "456" },
            ],
          });
          return;
        }

        // Mock organization details endpoint
        if (urlObj.pathname.includes("/rpc/orgs/get")) {
          const postData = req.postData();
          let orgId = "org-1";
          if (postData) {
            try {
              const parsed = JSON.parse(postData);
              if (parsed) {
                if (parsed.orgId) orgId = parsed.orgId;
                else if (parsed.json && parsed.json.orgId) orgId = parsed.json.orgId;
                else if (Array.isArray(parsed) && parsed[0]?.orgId) orgId = parsed[0].orgId;
              }
            } catch (e) {}
          }

          if (orgId === "org-1") {
            await fulfillJson(route, {
              json: { id: "org-1", name: "Test Org", slug: "test-org", memberCount: 5 },
            });
          } else {
            await fulfillJson(route, {
              json: { id: "org-2", name: "Demo Corp", slug: "demo-corp", memberCount: 12 },
            });
          }
          return;
        }

        // Continue other requests
        await route.continue();
      }
    );
  });

  test("should show sign in page and redirect to dashboard after sign in", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Welcome to Emitkit")).toBeVisible();

    // Click GitHub sign-in button
    await page.click('button:has-text("Sign in with GitHub")');

    // Should redirect to dashboard
    await page.waitForURL("**/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("should load organization and display member count and switcher", async ({ page }) => {
    isAuthenticated = true;

    await page.goto("/dashboard");

    // Check header and organization name
    await expect(page.locator("h1")).toContainText("Test Org");
    await expect(page.locator("text=Members")).toBeVisible();
    
    // Select the card showing member count specifically to avoid strict mode violations
    const membersCard = page.locator(".bg-card", { hasText: "Members" });
    await expect(membersCard.locator("p.text-3xl")).toContainText("5");

    // Select different organization in dropdown select
    await page.selectOption("select", "org-2");

    // Check that dashboard updates
    await expect(page.locator("h1")).toContainText("Demo Corp");
    await expect(membersCard.locator("p.text-3xl")).toContainText("12");
  });
});
