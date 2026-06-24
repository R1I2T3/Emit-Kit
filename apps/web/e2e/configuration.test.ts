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

test.describe("Project Configuration & Run Generation Flow", () => {
  let savedConfig: any = null;
  let activeRuns: any[] = [];

  test.beforeEach(async ({ page }) => {
    savedConfig = null;
    activeRuns = [];

    // Log all page errors and console logs for troubleshooting
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
          await fulfillJson(route, {
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
          });
          return;
        }

        // Mock organization list for dashboard sidebar
        if (urlObj.pathname.includes("/rpc/orgs/list")) {
          await fulfillJson(route, {
            json: [
              { id: "org-1", name: "Test Org", slug: "test-org", githubOrgId: "123" },
            ],
          });
          return;
        }

        // Mock organization details endpoint
        if (urlObj.pathname.includes("/rpc/orgs/get")) {
          await fulfillJson(route, {
            json: { id: "org-1", name: "Test Org", slug: "test-org", memberCount: 5, isPersonal: false },
          });
          return;
        }

        // Mock project details endpoint
        if (urlObj.pathname.includes("/rpc/projects/get")) {
          await fulfillJson(route, {
            json: {
              id: "proj-1",
              orgId: "org-1",
              repoFullName: "owner/repo-1",
              specPath: "openapi.yaml",
              defaultBranch: "main",
              outputMode: "separate",
              outputRepoFullName: null,
              webhookId: 12345,
              webhookSecret: "sec-123",
              createdAt: "2026-06-18T15:16:15.000Z",
              updatedAt: "2026-06-18T15:16:15.000Z",
            },
          });
          return;
        }

        // Mock configuration get endpoint
        if (urlObj.pathname.includes("/rpc/projects/config/get")) {
          await fulfillJson(route, {
            json: savedConfig,
          });
          return;
        }

        // Mock configuration save endpoint
        if (urlObj.pathname.includes("/rpc/projects/config/save")) {
          const postData = req.postData();
          if (postData) {
            try {
              const parsed = JSON.parse(postData);
              const data = parsed.json || parsed;
              savedConfig = {
                id: "config-1",
                projectId: data.projectId,
                outputs: data.outputs || [],
                sdkLanguages: data.sdkLanguages || [],
                outputDir: data.outputDir || ".emitkit/",
                sdkNpmScope: data.sdkNpmScope || null,
                sdkPypiName: data.sdkPypiName || null,
                sdkVersionStrategy: data.sdkVersionStrategy || "emitkit-managed",
                geminiApiKey: data.geminiApiKey ? "********" : null,
                createdAt: new Date().toISOString(),
              };
            } catch (e) {
              console.error("Failed to parse config save body", e);
            }
          }
          await fulfillJson(route, {
            json: savedConfig,
          });
          return;
        }

        // Mock runs list endpoint
        if (urlObj.pathname.includes("/rpc/projects/runs/list")) {
          await fulfillJson(route, {
            json: activeRuns,
          });
          return;
        }

        // Mock runs trigger endpoint
        if (urlObj.pathname.includes("/rpc/projects/runs/trigger")) {
          const newRun = {
            id: `run-${Date.now()}`,
            projectId: "proj-1",
            configId: "config-1",
            triggeredBy: "manual",
            status: "queued",
            commitSha: null,
            specSnapshot: null,
            sdkVersion: null,
            branchName: null,
            prUrl: null,
            logs: "",
            createdAt: new Date().toISOString(),
            finishedAt: null,
          };
          activeRuns.unshift(newRun);
          await fulfillJson(route, {
            json: newRun,
          });
          return;
        }

        // Continue other requests
        await route.continue();
      }
    );
  });

  test("Project Configuration & Run Generation Flow", async ({ page }) => {
    // Go to project detail page
    await page.goto("/projects/proj-1");

    // We should see the project header
    await expect(page.locator('h1:has-text("owner/repo-1")')).toBeVisible();

    // Click on the Config tab
    await page.click('button:has-text("Config")');

    // Verify Project Configuration form header is visible
    await expect(page.locator("text=Project Configuration")).toBeVisible();

    // Select SDK and CLI checkboxes
    await page.click('label:has-text("SDK")');
    await page.click('label:has-text("CLI")');

    // Since we selected SDK, SDK Target Languages should now be visible
    await expect(page.locator("text=SDK Target Languages")).toBeVisible();

    // Check "typescript" language option
    await page.click('label:has-text("typescript")');

    // NPM Scope field should now be visible (since we checked typescript)
    await expect(page.locator('input[placeholder="@scope"]')).toBeVisible();
    await page.fill('input[placeholder="@scope"]', "@my-scope");

    // Let's change outputDir
    await page.fill('input[placeholder=".emitkit/"]', ".custom-emit/");

    // Enter Gemini API Key
    await page.fill('input[placeholder="Enter Gemini API Key (optional)"]', "my-gemini-key");

    // Click "Save Configuration"
    await page.click('button:has-text("Save Configuration")');

    // Verify toast notification for success
    await expect(page.locator("text=Configuration saved successfully")).toBeVisible();

    // Now, trigger the run
    await page.click('button:has-text("Trigger Generation")');

    // Verify toast notification for triggered run
    await expect(page.locator("text=Generation run triggered")).toBeVisible();

    // The tab should have automatically switched to "Runs"
    // And there should be an active run in the runs table
    await expect(page.locator("text=Recent Runs")).toBeVisible();
    await expect(page.locator("text=queued")).toBeVisible();
  });
});
