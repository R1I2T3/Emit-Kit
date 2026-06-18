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

test.describe("Project Management Flow", () => {
  let isAuthenticated = true;

  test.beforeEach(async ({ page }) => {
    isAuthenticated = true;

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

        // Mock GitHub repositories list for the RepoPicker dropdown
        if (urlObj.pathname.includes("/rpc/projects/listGithubRepos")) {
          await fulfillJson(route, {
            json: [
              { id: 1, name: "repo-a", owner: "github-owner" },
              { id: 2, name: "repo-b", owner: "github-owner" },
            ],
          });
          return;
        }

        // Mock list of projects
        if (urlObj.pathname.includes("/rpc/projects/list")) {
          await fulfillJson(route, {
            json: [
              {
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
            ],
          });
          return;
        }

        // Mock project creation from existing repo
        if (urlObj.pathname.includes("/rpc/projects/createFromExistingRepo")) {
          await fulfillJson(route, {
            json: {
              id: "proj-1",
              orgId: "org-1",
              repoFullName: "github-owner/repo-a",
              specPath: "spec/openapi.json",
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

        // Mock project creation for a new repo
        if (urlObj.pathname.includes("/rpc/projects/createNewRepo")) {
          await fulfillJson(route, {
            json: {
              id: "proj-2",
              orgId: "org-1",
              repoFullName: "test-org/my-brand-new-api",
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

        // Mock project details endpoint
        if (urlObj.pathname.includes("/rpc/projects/get")) {
          const postData = req.postData();
          let projectId = "proj-1";
          if (postData) {
            try {
              const parsed = JSON.parse(postData);
              if (parsed) {
                if (parsed.projectId) projectId = parsed.projectId;
                else if (parsed.json && parsed.json.projectId) projectId = parsed.json.projectId;
                else if (Array.isArray(parsed) && parsed[0]?.projectId) projectId = parsed[0].projectId;
              }
            } catch (e) {}
          }

          const repoFullName = projectId === "proj-1" ? "owner/repo-1" : "test-org/my-brand-new-api";

          await fulfillJson(route, {
            json: {
              id: projectId,
              orgId: "org-1",
              repoFullName: repoFullName,
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

        // Mock delete project endpoint
        if (urlObj.pathname.includes("/rpc/projects/delete")) {
          await fulfillJson(route, {
            json: { success: true },
          });
          return;
        }

        // Continue other requests
        await route.continue();
      }
    );
  });

  test("Connect Existing Repository Flow", async ({ page }) => {
    // Start by visiting /dashboard (authenticated)
    await page.goto("/dashboard");

    // Verify projects list has the mocked project owner/repo-1
    await expect(page.locator("text=owner/repo-1")).toBeVisible();

    // Click the "Create Project" button
    await page.click('a:has-text("Create Project")');
    await page.waitForURL("**/projects/new");

    // Select "Connect existing repository" (default, but click it to be certain)
    await page.click('button:has-text("Connect existing repository")');

    // Interact with the RepoPicker to search and select github-owner/repo-a
    await page.click('button:has-text("Select a repository...")');
    await page.locator('input[placeholder="Search repositories..."]').fill("repo-a");
    await page.click('button:has-text("github-owner/repo-a")');

    // Fill spec path with spec/openapi.json
    await page.locator('input[placeholder="openapi.yaml"]').fill("spec/openapi.json");

    // Click "Create Project" form submission button
    await page.click('form button[type="submit"]');

    // Verify page URL redirects to /projects/proj-1 or /projects/...
    await page.waitForURL("**/projects/proj-1");
    await expect(page).toHaveURL(/\/projects\/proj-1/);
  });

  test("Create New Repository Flow", async ({ page }) => {
    // Go to /projects/new
    await page.goto("/projects/new");

    // Switch to "Create new repository" tab/source
    await page.click('button:has-text("Create new repository")');

    // Enter repository name my-brand-new-api
    await page.fill('input[placeholder="my-new-api"]', "my-brand-new-api");

    // Select visibility private
    await page.click('button:has-text("Private")');
    await page.click('[data-slot="select-item"]:has-text("Private")');

    // Click "Create Project"
    await page.click('form button[type="submit"]');

    // Verify page URL redirects to the project detail view
    await page.waitForURL("**/projects/proj-2");
    await expect(page).toHaveURL(/\/projects\/proj-2/);
  });

  test("Delete Project Flow", async ({ page }) => {
    // Navigate to /projects/proj-1
    await page.goto("/projects/proj-1");

    // Toggle settings/overview tabs to go to Settings
    await page.click('button:has-text("Settings")');

    // Click the "Delete Project" button
    await page.click('button:has-text("Delete Project")');

    // Click "Confirm Deletion" (Yes, Delete Project) in the alert panel
    await page.click('button:has-text("Yes, Delete Project")');

    // Verify page URL redirects back to /dashboard
    await page.waitForURL("**/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
