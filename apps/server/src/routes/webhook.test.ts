import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../index";
import { createHmac } from "crypto";
import { getLatestConfig } from "@Emitkit/api/services/config";
import { createRun, enqueueGenerationJob } from "@Emitkit/api/services/runs";
import { getGitHubClientForProject } from "@Emitkit/api/services/projects";
import { createTag } from "@Emitkit/github";

const { mockDbState, mockSelectResult } = vi.hoisted(() => {
  const state = {
    mockDbResults: [] as any[][],
    queryIndex: 0,
  };
  const selectResult = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((onfulfilled) => {
      const res = state.mockDbResults[state.queryIndex] || [];
      state.queryIndex++;
      return Promise.resolve(res).then(onfulfilled);
    }),
  };
  return { mockDbState: state, mockSelectResult: selectResult };
});

vi.mock("@Emitkit/db", () => ({
  db: {
    select: vi.fn().mockReturnValue(mockSelectResult),
  },
  createDb: () => ({}),
}));

vi.mock("@Emitkit/auth", () => ({
  createAuth: vi.fn(() => ({
    handler: vi.fn(),
    api: {
      getSession: vi.fn().mockResolvedValue({ user: null, session: null }),
    },
  })),
}));

vi.mock("@Emitkit/api/services/config", () => ({
  getLatestConfig: vi.fn(),
}));

vi.mock("@Emitkit/api/services/runs", () => ({
  createRun: vi.fn(),
  enqueueGenerationJob: vi.fn(),
}));

vi.mock("@Emitkit/api/services/projects", () => ({
  getGitHubClientForProject: vi.fn(),
}));

vi.mock("@Emitkit/github", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@Emitkit/github")>();
  return {
    ...actual,
    createTag: vi.fn(),
  };
});

vi.mock("@Emitkit/auth/crypto", () => ({
  decrypt: vi.fn((val) => val),
  encrypt: vi.fn((val) => val),
}));

function sign(payload: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
}

describe("GitHub Webhook Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbState.mockDbResults = [];
    mockDbState.queryIndex = 0;
  });

  it("should return 401 if x-hub-signature-256 header is missing", async () => {
    const res = await app.request("/webhooks/github", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Missing signature header");
  });

  it("should return 404 if project is not found", async () => {
    mockDbState.mockDbResults = [[]];
    const payload = JSON.stringify({ repository: { full_name: "owner/nonexistent" } });
    const res = await app.request("/webhooks/github", {
      method: "POST",
      headers: {
        "x-hub-signature-256": sign(payload, "secret"),
        "x-github-event": "push",
      },
      body: payload,
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Project not found");
  });

  it("should return 401 if signature verification fails for all projects", async () => {
    mockDbState.mockDbResults = [[{ repoFullName: "owner/repo", webhookSecret: "encrypted-secret" }]];
    const payload = JSON.stringify({ repository: { full_name: "owner/repo" } });
    const res = await app.request("/webhooks/github", {
      method: "POST",
      headers: {
        "x-hub-signature-256": sign(payload, "wrong-secret"),
        "x-github-event": "push",
      },
      body: payload,
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Invalid signature");
  });

  it("push event - should do nothing if project.specPath is not modified", async () => {
    mockDbState.mockDbResults = [[{ id: "project-1", repoFullName: "owner/repo", webhookSecret: "secret", specPath: "openapi.yaml", defaultBranch: "main" }]];
    const payload = JSON.stringify({
      ref: "refs/heads/main",
      repository: { full_name: "owner/repo" },
      commits: [
        {
          added: ["src/index.ts"],
          modified: ["package.json"],
          removed: [],
        }
      ]
    });
    const res = await app.request("/webhooks/github", {
      method: "POST",
      headers: {
        "x-hub-signature-256": sign(payload, "secret"),
        "x-github-event": "push",
      },
      body: payload,
    });
    expect(res.status).toBe(200);
    expect(getLatestConfig).not.toHaveBeenCalled();
    expect(createRun).not.toHaveBeenCalled();
    expect(enqueueGenerationJob).not.toHaveBeenCalled();
  });

  it("push event - should ignore push to non-default branch", async () => {
    mockDbState.mockDbResults = [[{ id: "project-1", repoFullName: "owner/repo", webhookSecret: "secret", specPath: "openapi.yaml", defaultBranch: "main" }]];
    const payload = JSON.stringify({
      ref: "refs/heads/feature-branch",
      repository: { full_name: "owner/repo" },
      commits: [
        {
          added: [],
          modified: ["openapi.yaml"],
          removed: [],
        }
      ]
    });
    const res = await app.request("/webhooks/github", {
      method: "POST",
      headers: {
        "x-hub-signature-256": sign(payload, "secret"),
        "x-github-event": "push",
      },
      body: payload,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toContain("Ignored push to non-default branch");
    expect(getLatestConfig).not.toHaveBeenCalled();
  });

  it("push event - should create and enqueue generation run if project.specPath is modified", async () => {
    mockDbState.mockDbResults = [[{ id: "project-1", repoFullName: "owner/repo", webhookSecret: "secret", specPath: "openapi.yaml", defaultBranch: "main" }]];
    vi.mocked(getLatestConfig).mockResolvedValueOnce({ id: "config-1" } as any);
    vi.mocked(createRun).mockResolvedValueOnce({ id: "run-1" } as any);

    const payload = JSON.stringify({
      ref: "refs/heads/main",
      repository: { full_name: "owner/repo" },
      commits: [
        {
          added: [],
          modified: ["openapi.yaml"],
          removed: [],
        }
      ]
    });
    const res = await app.request("/webhooks/github", {
      method: "POST",
      headers: {
        "x-hub-signature-256": sign(payload, "secret"),
        "x-github-event": "push",
      },
      body: payload,
    });
    expect(res.status).toBe(200);
    expect(getLatestConfig).toHaveBeenCalledWith("project-1");
    expect(createRun).toHaveBeenCalledWith("project-1", "config-1", "webhook");
    expect(enqueueGenerationJob).toHaveBeenCalledWith("run-1");
  });

  it("pull_request event - should tag SDK and MCP versions when PR is merged", async () => {
    const mockProject = { id: "project-1", repoFullName: "owner/repo", webhookSecret: "secret", specPath: "openapi.yaml" };
    const mockRun = { id: "run-1", sdkVersion: "1.2.3" };
    const mockConfig = { id: "config-1", outputs: ["SDK", "MCP"] };

    mockDbState.mockDbResults = [
      [mockProject],
      [{ run: mockRun, project: mockProject, config: mockConfig }]
    ];

    vi.mocked(getGitHubClientForProject).mockResolvedValueOnce({} as any);

    const payload = JSON.stringify({
      action: "closed",
      repository: { full_name: "owner/repo" },
      pull_request: {
        merged: true,
        merge_commit_sha: "merge-sha-123",
        head: {
          ref: "emitkit/run-run-1",
        }
      }
    });

    const res = await app.request("/webhooks/github", {
      method: "POST",
      headers: {
        "x-hub-signature-256": sign(payload, "secret"),
        "x-github-event": "pull_request",
      },
      body: payload,
    });

    expect(res.status).toBe(200);
    expect(getGitHubClientForProject).toHaveBeenCalledWith(mockProject);
    expect(createTag).toHaveBeenCalledTimes(2);
    expect(createTag).toHaveBeenNthCalledWith(1, expect.any(Object), "owner", "repo", "sdk/v1.2.3", "merge-sha-123");
    expect(createTag).toHaveBeenNthCalledWith(2, expect.any(Object), "owner", "repo", "mcp/v1.2.3", "merge-sha-123");
  });
});
