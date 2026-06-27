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

test.describe("Run Details and Log Streaming Flow", () => {
  test.beforeEach(async ({ page }) => {
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

        // Mock organization list
        if (urlObj.pathname.includes("/rpc/orgs/list")) {
          await fulfillJson(route, {
            json: [
              { id: "org-1", name: "Test Org", slug: "test-org", githubOrgId: "123" },
            ],
          });
          return;
        }

        // Mock project details
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

        // Mock project runs get
        if (urlObj.pathname.includes("/rpc/projects/runs/get")) {
          const postData = req.postData();
          let runId = "run-1";
          if (postData) {
            try {
              const parsed = JSON.parse(postData);
              if (parsed) {
                if (parsed.runId) runId = parsed.runId;
                else if (parsed.json && parsed.json.runId) runId = parsed.json.runId;
                else if (Array.isArray(parsed) && parsed[0]?.runId) runId = parsed[0].runId;
              }
            } catch (e) {
              console.error("Failed to parse run ID", e);
            }
          }

          if (runId === "run-1") {
            await fulfillJson(route, {
              json: {
                id: "run-1",
                projectId: "proj-1",
                status: "running",
                prUrl: null,
                triggeredBy: "manual",
                sdkVersion: "0.1.0",
                branchName: "main",
                commitSha: "abcdef1234567890",
                createdAt: new Date().toISOString(),
                finishedAt: null,
                logs: "Fetching OpenAPI spec...\n",
              },
            });
            return;
          }

          if (runId === "run-2") {
            await fulfillJson(route, {
              json: {
                id: "run-2",
                projectId: "proj-1",
                status: "success",
                prUrl: "https://github.com/owner/repo-1/pull/42",
                triggeredBy: "webhook",
                sdkVersion: "0.2.0",
                branchName: "main",
                commitSha: "1234567890abcdef",
                createdAt: new Date(Date.now() - 60000).toISOString(),
                finishedAt: new Date().toISOString(),
                logs: "Fetching OpenAPI spec...\nParsing OpenAPI spec...\nAnalyzing changes...\nCalculating version...\nVersion: 0.2.0\n[DONE]\n",
              },
            });
            return;
          }
        }

        // Continue other requests
        await route.continue();
      }
    );

    // Mock the SSE endpoint
    await page.route("**/api/runs/run-1/logs/stream", async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "http://localhost:3001",
          "Access-Control-Allow-Credentials": "true",
        },
        body: "data: Parsing OpenAPI spec...\n\ndata: Analyzing changes...\n\ndata: Calculating version...\n\ndata: Version: 0.2.0\n\ndata: [DONE]\n\n",
      });
    });
  });

  test("Log Streaming Flow for Active Run", async ({ page }) => {
    // Visit /runs/run-1
    await page.goto("/runs/run-1");

    // Verify page headers show Run ID run-1 and status is active (shows "Running")
    await expect(page.locator('h1:has-text("Run: run-1")')).toBeVisible();
    await expect(page.locator('span:has-text("Running")')).toBeVisible();

    // Verify terminal container is visible
    await expect(page.locator("text=emitkit-terminal v0.1.0")).toBeVisible();

    // Verify terminal logs contain initial logs and streamed logs
    await expect(page.locator("text=Fetching OpenAPI spec...")).toBeVisible();
    await expect(page.locator("text=Parsing OpenAPI spec...")).toBeVisible();
    await expect(page.locator("text=Analyzing changes...")).toBeVisible();
    await expect(page.locator("text=Version: 0.2.0")).toBeVisible();
    await expect(page.locator("text=[DONE]")).toBeVisible();
  });

  test("Finished Run Display and Navigation", async ({ page }) => {
    // Visit /runs/run-2
    await page.goto("/runs/run-2");

    // Verify status is "Success"
    await expect(page.locator('h1:has-text("Run: run-2")')).toBeVisible();
    await expect(page.locator('span:has-text("Success")')).toBeVisible();

    // Verify terminal contains full logs including "[DONE]"
    await expect(page.locator("text=Fetching OpenAPI spec...")).toBeVisible();
    await expect(page.locator("text=Parsing OpenAPI spec...")).toBeVisible();
    await expect(page.locator("text=Analyzing changes...")).toBeVisible();
    await expect(page.locator("text=Version: 0.2.0")).toBeVisible();
    await expect(page.locator("text=[DONE]")).toBeVisible();

    // Click on the back link to navigate to the project dashboard/page
    await page.click('a:has-text("Back to owner/repo-1")');

    // Assert URL redirects to /projects/proj-1
    await page.waitForURL("**/projects/proj-1");
    await expect(page).toHaveURL(/\/projects\/proj-1/);
  });
});
