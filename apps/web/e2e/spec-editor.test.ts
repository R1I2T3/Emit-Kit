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

test.describe("Spec Editor and Versions E2E Flow", () => {
  let saveCount = 0;
  let triggerCount = 0;

  test.beforeEach(async ({ page }) => {
    saveCount = 0;
    triggerCount = 0;

    // Log all page errors and console logs for troubleshooting
    page.on("pageerror", (err) => console.log(`[PAGE ERROR]: ${err.message}`));
    page.on("console", (msg) => console.log(`[CONSOLE]: ${msg.type()} ${msg.text()}`));

    // Intercept all backend requests (port 3000)
    await page.route(
      (url) => url.toString().includes(":3000/"),
      async (route) => {
        const req = route.request();
        const urlObj = new URL(req.url());

        if (req.method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: corsHeaders });
          return;
        }

        if (urlObj.pathname.includes("/api/auth/get-session")) {
          await fulfillJson(route, {
            user: { id: "user-1", name: "Test User", email: "test@example.com" },
            session: { id: "session-1", userId: "user-1", expiresAt: new Date(Date.now() + 3600000).toISOString() },
          });
          return;
        }

        if (urlObj.pathname.includes("/rpc/orgs/list")) {
          await fulfillJson(route, { json: [{ id: "org-1", name: "Test Org", slug: "test-org" }] });
          return;
        }

        if (urlObj.pathname.includes("/rpc/projects/get")) {
          await fulfillJson(route, {
            json: {
              id: "proj-1",
              orgId: "org-1",
              repoFullName: "owner/repo-1",
              specPath: "openapi.yaml",
              defaultBranch: "main",
              webhookId: 12345,
              createdAt: "2026-06-18T15:16:15.000Z",
              updatedAt: "2026-06-18T15:16:15.000Z",
            },
          });
          return;
        }

        if (urlObj.pathname.includes("/rpc/versions/list")) {
          await fulfillJson(route, {
            json: [
              {
                id: "v-1",
                projectId: "proj-1",
                version: "1.0.0",
                changeType: "major",
                changelog: "First release changelog details",
                createdAt: "2026-06-28T12:00:00.000Z",
                runId: "run-12345",
              },
            ],
          });
          return;
        }

        if (urlObj.pathname.includes("/rpc/projects/spec/get")) {
          await fulfillJson(route, {
            json: {
              content: "openapi: 3.1.0\ninfo:\n  title: Test API\n  version: 1.0.0\npaths: {}\n",
              sha: "sha-abc",
              format: "yaml",
            },
          });
          return;
        }

        if (urlObj.pathname.includes("/rpc/projects/spec/save")) {
          saveCount++;
          await fulfillJson(route, {
            json: { commitSha: "commit-xyz" },
          });
          return;
        }

        if (urlObj.pathname.includes("/rpc/projects/runs/trigger")) {
          triggerCount++;
          await fulfillJson(route, {
            json: { id: "run-new", status: "queued" },
          });
          return;
        }

        await route.continue();
      }
    );
  });

  test("Versions tab lists versions and supports expanding changelog", async ({ page }) => {
    // Navigate to project detail page
    await page.goto("/projects/proj-1");

    // Click on Versions tab
    await page.click('button:has-text("Versions")');

    // Verify version 1.0.0 is shown
    await expect(page.locator("text=1.0.0")).toBeVisible();
    await expect(page.locator("text=major")).toBeVisible();

    // Expand changelog
    await page.click("tr:has-text('1.0.0')");
    await expect(page.locator("text=First release changelog details")).toBeVisible();
  });

  test("Editor tab supports editing, validating, saving and generating spec", async ({ page }) => {
    await page.goto("/projects/proj-1");

    // Click on Editor tab
    await page.click('button:has-text("Editor")');

    // Wait for CodeMirror to load
    await expect(page.locator(".cm-editor")).toBeVisible();

    // Verify initial validation status is valid
    await expect(page.locator("text=Valid OpenAPI spec")).toBeVisible();

    const saveBtn = page.locator('button:has-text("Save Spec")');
    const saveGenBtn = page.locator('button:has-text("Save & Generate")');

    // Modifying content enables the "Save Spec" and "Save & Generate" buttons.
    // Initially disabled
    await expect(saveBtn).toBeDisabled();
    await expect(saveGenBtn).toBeDisabled();

    // Typing invalid content shows the "Invalid OpenAPI spec" status
    const editor = page.locator(".cm-content");
    await editor.fill("invalid-yaml: :");

    // Wait for the debounced validation to run and status to update
    await expect(page.locator("text=Invalid OpenAPI spec")).toBeVisible();

    // Buttons should remain disabled because the spec is invalid
    await expect(saveBtn).toBeDisabled();
    await expect(saveGenBtn).toBeDisabled();

    // Typing valid YAML content shows the "Valid OpenAPI spec" status
    const validContent = `openapi: 3.1.0
info:
  title: Test API
  version: 2.0.0
paths: {}
`;
    await editor.fill(validContent);

    // Wait for validation to become valid
    await expect(page.locator("text=Valid OpenAPI spec")).toBeVisible();

    // Buttons should now be enabled since content is dirty and valid
    await expect(saveBtn).toBeEnabled();
    await expect(saveGenBtn).toBeEnabled();

    // Clicking "Save Spec" calls /rpc/projects/spec/save and shows a success toast
    await saveBtn.click();
    await expect(page.locator("text=Spec saved successfully")).toBeVisible();
    expect(saveCount).toBe(1);

    // After saving successfully, the content is no longer dirty, so buttons should be disabled again
    await expect(saveBtn).toBeDisabled();
    await expect(saveGenBtn).toBeDisabled();

    // Modify content again to enable the buttons
    const validContent2 = `openapi: 3.1.0
info:
  title: Test API
  version: 3.0.0
paths: {}
`;
    await editor.fill(validContent2);
    await expect(page.locator("text=Valid OpenAPI spec")).toBeVisible();
    await expect(saveBtn).toBeEnabled();
    await expect(saveGenBtn).toBeEnabled();

    // Clicking "Save & Generate" calls save followed by /rpc/projects/runs/trigger
    await saveGenBtn.click();

    // Show success toast for save and trigger run (which will be "Spec saved successfully" and "Generation run triggered")
    await expect(page.locator("text=Spec saved successfully")).toBeVisible();
    await expect(page.locator("text=Generation run triggered")).toBeVisible();

    expect(saveCount).toBe(2);
    expect(triggerCount).toBe(1);
  });
});
