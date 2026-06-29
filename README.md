# EmitKit

**API-first SDK generation platform** combining GitHub-native workflows, OpenAPI spec parsing, BullMQ pipeline orchestration, and multi-target code generation for automated client library delivery.

[![Version](https://img.shields.io/badge/version-0.1.0-blue)]()
[![Bun](https://img.shields.io/badge/bun-1.3.14-f472b6)]()
[![React](https://img.shields.io/badge/react-19-61DAFB)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## Table of Contents

- [What is EmitKit?](#what-is-emitkit)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## What is EmitKit?

EmitKit connects to your GitHub repositories, watches for OpenAPI specification changes, and generates production-ready client libraries — TypeScript SDKs, Python SDKs, CLI tools, MCP servers, and API documentation — then opens pull requests with the generated code and auto-tags releases when merged.

The platform runs a **7-step BullMQ worker pipeline** that fetches specs, diffs them against previous versions, computes SemVer bumps, runs generators in parallel, validates output with `tsc` and `ruff`, formats with `prettier`, and commits results via the GitHub tree API.

### What it does

- **GitHub OAuth login** with automatic organization and repository sync
- **Interactive spec editing** via a CodeMirror editor with live OpenAPI/Swagger validation
- **Webhook-driven builds** — push to your default branch triggers generation automatically
- **Manual generation triggers** from the web dashboard
- **Five code generators**: TypeScript SDK, Python SDK, CLI (Commander), MCP server, Markdown docs
- **AI-enriched documentation** using Gemini 1.5 Flash for curl/TypeScript/Python examples
- **Automatic SemVer versioning** based on API diff (breaking changes, added/removed operations)
- **Real-time log streaming** via SSE during generation runs
- **Syntax checking and formatting** — `tsc --noEmit --strict` + `prettier` for TypeScript, `ruff check` + `ruff format` for Python
- **Optimistic locking** on spec saves via GitHub file SHA verification
- **PR automation** — creates branches, commits multi-file trees, opens pull requests
- **Release tagging** — auto-creates `sdk/v{version}` and `mcp/v{version}` Git tags on PR merge
- **CI workflow generation** — produces GitHub Actions workflows for npm and PyPI publishing
- **Encrypted credential storage** — AES-256-GCM encryption for webhook secrets and Gemini API keys

### What it does not do

- **Not an API gateway** — does not proxy or route live client traffic
- **Not an API designer** — ingests existing specs, does not provide a drag-and-drop schema builder
- **GitHub-only** — no support for GitLab, Bitbucket, or other VCS providers
- **Single-branch generation** — targets the default branch only, no multi-branch generation
- **No native mobile app** — web UI only (responsive)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              EmitKit Platform                               │
│                                                                              │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────────────────┐   │
│  │   Frontend   │     │   Backend    │     │        Worker               │   │
│  │  React 19    │────▶│   Hono       │────▶│      BullMQ                 │   │
│  │  Vite        │     │   oRPC       │     │   7-step pipeline           │   │
│  │  TanStack    │◀────│   SSE        │◀────│                             │   │
│  │  CodeMirror  │     │   Webhooks   │     │  fetch → parse → diff →    │   │
│  │  :3001       │     │   :3000      │     │  version → generate →      │   │
│  └─────────────┘     └──────┬───────┘     │  check → commit            │   │
│                              │             └─────────────────────────────┘   │
│                              │                                               │
│  ┌───────────────────────────┴───────────────────────────────────────────┐   │
│  │                       Persistence Layer                               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │   │
│  │  │  SQLite   │  │  Redis   │  │  GitHub  │  │     Local Disk       │  │   │
│  │  │  Drizzle  │  │  BullMQ  │  │  Octokit │  │  /tmp compile zone  │  │   │
│  │  │  ORM      │  │  Pub/Sub │  │  API     │  │                     │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Generation Pipeline

The worker executes a deterministic 7-step pipeline for each generation run:

| Step | Module | Description |
|---|---|---|
| 1. Fetch Spec | `steps/fetch-spec` | Downloads the OpenAPI spec from GitHub via Octokit. Validates `owner/repo` format. Enforces 2 MB size limit. |
| 2. Parse Spec | `steps/parse-spec` | Parses JSON/YAML with `js-yaml`, validates with `@apidevtools/swagger-parser`. Extracts operations, schemas, security, servers. Merges path-level and operation-level parameters. |
| 3. Diff Spec | `steps/diff-spec` | Compares current spec against the last successful run's `specSnapshot`. Detects added, removed, and modified operations. Identifies breaking changes (new required parameters). |
| 4. Calculate Version | `steps/calc-version` | SemVer bump via the `semver` package. Two strategies: `spec-version` (use `info.version`) or `emitkit-managed` (auto-bump based on diff — breaking → major, additions → minor, patches → patch). |
| 5. Run Generators | `steps/run-generators` | Runs configured generators in parallel via `Promise.allSettled`. Outputs TypeScript SDK, Python SDK, CLI, MCP server, and/or documentation. |
| 6. Syntax Check & Format | `steps/syntax-check` | TypeScript: `tsc --noEmit --strict` + `prettier --write`. Python: `ruff check --fix` + `ruff format`. Writes to `/tmp/emitkit-{runId}`, reads back formatted output. |
| 7. Commit Output | `steps/commit-output` | Creates branch `emitkit/run-{runId}`, commits files via Git tree API, opens PR. Supports `append` (same repo) and `separate` (output repo) modes. Skips custom stub files that already exist. Adds CI workflows for npm/PyPI publishing. |

### Code Generators

| Generator | Output Directory | Key Dependencies | Description |
|---|---|---|---|
| **TypeScript SDK** | `{outputDir}/sdk/typescript/` | — | Client class, typed resources per tag, error classes, `package.json` with optional npm scope |
| **Python SDK** | `{outputDir}/sdk/python/` | httpx, pydantic | Client module, Pydantic models from schemas, resource files per tag, `pyproject.toml` |
| **CLI** | `{outputDir}/cli/` | commander ^11.0.0 | Commander-based CLI with one command per operation, `bin` entry in `package.json` |
| **MCP Server** | `{outputDir}/mcp/` | @modelcontextprotocol/sdk ^1.0.1 | Full MCP server registering each operation as a tool with input schemas, stdio transport |
| **Documentation** | `{outputDir}/docs/v{version}/` | @google/generative-ai (optional) | Markdown docs grouped by tag. Optional Gemini AI enrichment for curl/TS/Python examples |

### Data Stores

| Store | Technology | Purpose |
|---|---|---|
| RDBMS | SQLite + Drizzle ORM (libsql) | Users, sessions, organizations, projects, configs, generation runs, SDK versions |
| Task Broker | Redis 7 + BullMQ | Job queue for generation pipeline. Pub/Sub for real-time log streaming |
| Source Control | GitHub API (Octokit REST) | Spec retrieval, webhook registration, multi-file commits, PR creation, release tagging |
| Compile Zone | Local disk (`/tmp`) | Temporary directory for `tsc` and `ruff` compilation checks |

### Database Schema

EmitKit uses 8 tables managed by Drizzle ORM:

| Table | Key Columns | Purpose |
|---|---|---|
| `user` | id, email, githubId, avatarUrl | GitHub-authenticated users |
| `session` | id, token, userId, expiresAt | Active auth sessions |
| `account` | id, providerId, accessToken, userId | OAuth provider accounts (GitHub) |
| `verification` | id, identifier, value, expiresAt | Email/token verification records |
| `organizations` | id, githubOrgId, slug, isPersonal, ownerUserId | Synced GitHub organizations |
| `organization_members` | orgId, userId, role | Org membership (owner/member) |
| `projects` | id, orgId, repoFullName, specPath, outputMode, webhookId | Linked GitHub repositories |
| `project_configs` | id, projectId, outputs (JSON), sdkLanguages (JSON), outputDir, geminiApiKey | Generation configuration per project |
| `generation_runs` | id, projectId, status, commitSha, specSnapshot, logs, prUrl | Individual generation run records |
| `sdk_versions` | id, projectId, version, runId, changeType, changelog | Published SDK version history |

---

## Quick Start

### Prerequisites

- **Bun ≥ 1.3.14** — `curl -fsSL https://bun.sh/install | bash`
- **Redis 7** — running locally or via Docker
- **Node.js ≥ 20** — required for `tsc` and `prettier` during syntax checking
- A **GitHub OAuth App** — create one at [github.com/settings/developers](https://github.com/settings/developers)
  - Set the callback URL to `http://localhost:3000/api/auth/callback/github`
  - Required scopes: `repo`, `read:org`, `workflow`, `user:email`, `write:repo_hook`

### 1. Clone and configure

```bash
git clone <repo-url>
cd Emit-Kit
```

Create `apps/server/.env`:

```env
DATABASE_URL=file:../../local.db
BETTER_AUTH_SECRET=<random-string-at-least-32-chars>
BETTER_AUTH_URL=http://localhost:3000
WEBHOOK_BASE_URL=https://<your-public-domain>
CORS_ORIGIN=http://localhost:3001
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
ENCRYPTION_KEY=<64-character-hex-string>
REDIS_URL=redis://localhost:6379
```

Create `apps/web/.env`:

```env
VITE_SERVER_URL=http://localhost:3000
```

> **Tip:** Generate the encryption key with `openssl rand -hex 32`.

### 2. Start Redis

```bash
docker run --name emitkit-redis -p 6379:6379 -d redis:7
```

### 3. Install dependencies

```bash
bun install
```

### 4. Push database schema

```bash
bun db:push
```

### 5. Start the full stack

```bash
bun dev
```

This launches all three services concurrently via Turborepo:

| Service | Port | Command |
|---|---|---|
| Hono API server | 3000 | `bun dev:server` |
| React frontend | 3001 | `bun dev:web` |
| BullMQ worker | — | `bun dev:worker` |

### 6. Open the app

Navigate to **http://localhost:3001** and sign in with GitHub.

---

## Usage

### Web UI Workflow

1. **Sign in** with GitHub OAuth — organizations sync automatically
2. **Create a project** — link an existing repo with an OpenAPI spec, or create a new repo
3. **Configure outputs** — select generators (SDK, CLI, MCP, Docs), languages (TypeScript, Python), version strategy
4. **Edit the spec** — use the built-in CodeMirror editor with live OpenAPI validation
5. **Trigger generation** — click "Save & Generate" or push to your default branch
6. **Monitor runs** — watch real-time logs stream via SSE
7. **Review PRs** — EmitKit opens a PR with generated code; merge to publish
8. **Track versions** — view version history with changelogs and change types

### API Examples

#### Fetch a project's OpenAPI spec

```bash
curl -X POST http://localhost:3000/rpc/projects/spec/get \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{"projectId": "proj-uuid"}'
```

#### Save spec with optimistic locking

```bash
curl -X POST http://localhost:3000/rpc/projects/spec/save \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{
    "projectId": "proj-uuid",
    "content": "openapi: 3.1.0\ninfo:\n  title: My API\n  version: 1.0.0\npaths: {}",
    "sha": "current-github-file-sha"
  }'
```

#### Trigger a generation run

```bash
curl -X POST http://localhost:3000/rpc/projects/runs/trigger \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{"projectId": "proj-uuid"}'
```

#### List published SDK versions

```bash
curl -X POST http://localhost:3000/rpc/versions/list \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{"projectId": "proj-uuid"}'
```

---

## Configuration

### Backend Environment (`apps/server/.env`)

| Variable | Required | Default | Validation | Description |
|---|---|---|---|---|
| `DATABASE_URL` | Yes | — | `z.string().min(1)` | SQLite database file path (e.g., `file:../../local.db`) |
| `BETTER_AUTH_SECRET` | Yes | — | `z.string().min(32)` | Secret key for signing auth cookies and tokens |
| `BETTER_AUTH_URL` | Yes | — | `z.url()` | URL where the auth server runs |
| `WEBHOOK_BASE_URL` | Yes | — | `z.string().url()` | Publicly accessible URL for GitHub webhook callbacks |
| `CORS_ORIGIN` | Yes | — | Comma-separated URLs | Allowed CORS origins (e.g., `http://localhost:3001`) |
| `NODE_ENV` | No | `development` | `development \| production \| test` | Runtime environment |
| `GITHUB_CLIENT_ID` | Yes | — | `z.string().min(1)` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes | — | `z.string().min(1)` | GitHub OAuth App client secret |
| `ENCRYPTION_KEY` | Yes | — | 64-char hex string | AES-256-GCM key for encrypting webhook secrets and API keys |
| `REDIS_URL` | No | `redis://localhost:6379` | `z.string().url()` | Redis connection string for BullMQ |

### Frontend Environment (`apps/web/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_SERVER_URL` | Yes | — | Backend API server URL (e.g., `http://localhost:3000`) |

### Project-Level Configuration

Each project has a `project_configs` record with:

| Field | Type | Default | Description |
|---|---|---|---|
| `outputs` | JSON array | — | Generator targets: `"SDK"`, `"CLI"`, `"MCP"`, `"DOCS"` |
| `sdkLanguages` | JSON array | — | SDK languages: `"typescript"`, `"python"` |
| `outputDir` | string | `.emitkit/` | Base directory for generated files in the repo |
| `sdkNpmScope` | string | — | Optional npm scope (e.g., `@myorg`) |
| `sdkPypiName` | string | — | Optional PyPI package name |
| `sdkVersionStrategy` | string | `emitkit-managed` | `"emitkit-managed"` (auto SemVer) or `"spec-version"` (use `info.version`) |
| `geminiApiKey` | string | — | Optional Gemini API key for AI-enriched documentation |

---

## API Reference

All API communication uses the oRPC protocol over HTTP POST. The frontend uses `@orpc/client` with TanStack Query integration.

### Auth Endpoints

| Path | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/*` | POST/GET | — | Better-Auth handlers (login, session, callback, sign-out) |

### RPC Endpoints

| Path | Auth | Input | Description |
|---|---|---|---|
| `/rpc/healthCheck` | No | — | Returns `"OK"` |
| `/rpc/orgs/list` | Yes | — | Lists all organizations the user belongs to |
| `/rpc/orgs/get` | Yes | `{ orgId }` | Gets org details and member count |
| `/rpc/projects/list` | Yes | `{ orgId }` | Lists all projects in an organization |
| `/rpc/projects/get` | Yes | `{ projectId }` | Gets a single project by ID |
| `/rpc/projects/createFromExistingRepo` | Yes | `{ orgId, repoFullName, specPath, defaultBranch? }` | Links an existing GitHub repo. Validates spec file exists. Registers webhook |
| `/rpc/projects/createNewRepo` | Yes | `{ orgId, repoName, visibility, orgLogin? }` | Creates a new GitHub repo and links it |
| `/rpc/projects/listGithubRepos` | Yes | — | Lists user's GitHub repos with push access |
| `/rpc/projects/delete` | Yes | `{ projectId }` | Deletes project and removes webhook from GitHub |
| `/rpc/projects/config/get` | Yes | `{ projectId }` | Gets project configuration (Gemini key masked) |
| `/rpc/projects/config/save` | Yes | `{ projectId, outputs, sdkLanguages, outputDir, ... }` | Creates or updates project configuration |
| `/rpc/projects/runs/list` | Yes | `{ projectId, limit?, offset? }` | Lists generation runs with pagination |
| `/rpc/projects/runs/get` | Yes | `{ runId }` | Gets a single generation run |
| `/rpc/projects/runs/trigger` | Yes | `{ projectId }` | Enqueues a manual generation job |
| `/rpc/projects/spec/get` | Yes | `{ projectId }` | Fetches OpenAPI spec content, SHA, and format from GitHub |
| `/rpc/projects/spec/save` | Yes | `{ projectId, content, sha }` | Updates spec on GitHub. Returns `CONFLICT` if SHA mismatch |
| `/rpc/versions/list` | Yes | `{ projectId }` | Lists SDK versions ordered by creation date (desc) |

### Server-Sent Events

| Path | Method | Auth | Description |
|---|---|---|---|
| `/api/runs/:runId/logs/stream` | GET | — | SSE stream of generation run logs. Publishes via Redis `run-logs:{runId}` channel. Terminates on `[DONE]` message |

### Webhook Endpoints

| Path | Method | Description |
|---|---|---|
| `/webhooks/github` | POST | Receives GitHub push and pull_request events. Verifies `x-hub-signature-256` via HMAC-SHA256. Push events trigger generation if spec changed. PR merge events create release tags |

### OpenAPI Reference

| Path | Method | Description |
|---|---|---|
| `/api-reference/*` | GET | Auto-generated OpenAPI reference UI via `@orpc/openapi` |

---

## Testing

### Unit & Integration Tests

Tests use Vitest with a shared base configuration at `packages/config/vitest.config.base.ts`. Environment validation is skipped during test runs.

```bash
# Run all unit and integration tests
bun run test

# Run with coverage report
bun run test:coverage

# Run tests for a specific package
DATABASE_URL=file:local.db bun test packages/api/src/services/spec.test.ts
```

### End-to-End Tests

E2E tests use Playwright with mocked API responses (no live backend required).

```bash
# Run all Playwright E2E tests
bun run test:e2e
```

| Test File | Coverage |
|---|---|
| `auth.test.ts` | Auth layout rendering, GitHub OAuth redirect |
| `smoke.test.ts` | Basic page load verification |
| `projects.test.ts` | Project creation, listing, detail views |
| `configuration.test.ts` | Project configuration tab interactions |
| `runs.test.ts` | Generation runs tab, triggering runs |
| `spec-editor.test.ts` | Spec editor loading, validation states, save and generate flows |

### Type Checking

```bash
# Verify TypeScript types across all workspaces
bun run check-types
```

### CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on push and PR to `main`:

| Job | Steps |
|---|---|
| `unit-tests` | Checkout → Bun setup → Install → `bun run test` → Codecov upload |
| `e2e-tests` | Checkout → Bun setup → Install → Playwright browsers → DB push → Dev server → `bun test:e2e` → Upload Playwright report |

---

## Project Structure

```
Emit-Kit/
├── apps/
│   ├── server/                      # Hono API server (port 3000)
│   │   └── src/
│   │       ├── index.ts             # Server entry: Hono app, CORS, auth, oRPC handlers
│   │       └── routes/
│   │           ├── sse.ts           # SSE endpoint for real-time log streaming
│   │           └── webhook.ts       # GitHub webhook handler (push + PR merge)
│   ├── web/                         # React 19 SPA (port 3001)
│   │   ├── e2e/                     # Playwright E2E test specs
│   │   └── src/
│   │       ├── components/
│   │       │   ├── layout/          # OrgSwitcher, Header
│   │       │   └── projects/        # EditorTab, VersionsTab, RunsTab, ConfigTab
│   │       ├── hooks/               # useDebounce
│   │       └── routes/
│   │           ├── login.tsx        # Glassmorphic GitHub OAuth login
│   │           ├── _auth/
│   │           │   ├── dashboard.tsx # Stat cards, project grid
│   │           │   ├── projects.new.tsx     # New project creation
│   │           │   ├── projects.$projectId.tsx  # Project detail (tabbed)
│   │           │   └── runs.$runId.tsx      # Run detail with live logs
│   │           └── __root.tsx       # Root layout, providers
│   └── worker/                      # BullMQ worker process
│       └── src/
│           ├── index.ts             # Worker entry, stale run cleanup
│           ├── processors/          # Generation pipeline orchestrator
│           ├── steps/               # 7 pipeline steps
│           └── lib/                 # Logger (DB + Redis pub/sub)
├── packages/
│   ├── api/                         # @Emitkit/api
│   │   └── src/
│   │       ├── routers/             # oRPC routers (orgs, projects, versions)
│   │       ├── services/            # Business logic (github-sync, projects, config, runs, spec)
│   │       └── context.ts           # Request context builder
│   ├── auth/                        # @Emitkit/auth
│   │   └── src/
│   │       ├── index.ts             # Better-Auth config with GitHub OAuth
│   │       └── crypto.ts            # AES-256-GCM encrypt/decrypt
│   ├── config/                      # @Emitkit/config
│   │   └── vitest.config.base.ts    # Shared Vitest configuration
│   ├── db/                          # @Emitkit/db
│   │   └── src/
│   │       ├── schema/              # 6 schema files (auth, orgs, projects, configs, runs, versions)
│   │       └── migrations/          # Drizzle migration files
│   ├── env/                         # @Emitkit/env
│   │   └── src/
│   │       ├── server.ts            # Backend env validation (t3-env + Zod)
│   │       └── web.ts               # Frontend env (VITE_SERVER_URL)
│   ├── generators/                  # @Emitkit/generators
│   │   └── src/
│   │       ├── sdk/typescript/      # TypeScript SDK generator
│   │       ├── sdk/python/          # Python SDK generator
│   │       ├── cli/                 # CLI generator (Commander)
│   │       ├── mcp/                 # MCP server generator
│   │       ├── docs/                # Docs generator (+ Gemini AI enrichment)
│   │       └── workflows/           # CI workflow generator (npm + PyPI)
│   ├── github/                      # @Emitkit/github
│   │   └── src/
│   │       ├── client.ts            # Octokit wrapper with retry logic
│   │       ├── repo.ts              # Repo operations (list, create, getContent)
│   │       ├── pr.ts                # PR operations (branch, commit, PR, tag)
│   │       └── webhook.ts           # Webhook register, verify, delete
│   ├── queue/                       # @Emitkit/queue
│   │   └── src/index.ts             # BullMQ queue factory (generation queue)
│   └── ui/                          # @Emitkit/ui
│       └── src/components/          # Shared components (Alert, Badge, Table, Select, Button)
├── .github/workflows/ci.yml         # CI pipeline (unit + E2E)
├── turbo.json                       # Turborepo task pipeline
├── package.json                     # Bun workspaces manifest
└── local.db                         # SQLite database (gitignored)
```

---

## Troubleshooting

### `LibsqlError: URL_INVALID: The URL 'undefined' is not in a valid format`

The `DATABASE_URL` environment variable is missing. Ensure it is set in `apps/server/.env` (e.g., `file:../../local.db`) or passed directly when running tests:

```bash
DATABASE_URL=file:local.db bun run test
```

### GitHub API HTTP 409 Conflict on spec save

The spec file was modified externally on GitHub since you loaded it in the editor. The SHA you sent no longer matches the current HEAD. Reload the editor tab to fetch the latest SHA before saving.

### Tailwind utility classes not rendering for `@Emitkit/ui` components

Ensure `turbo dev` is running (or run `bun run build` at the root) so that package changes are compiled and picked up by Vite's Tailwind watcher. Check that `apps/web/tailwind.config.ts` includes `../../packages/ui/src/**/*.tsx` in its content paths.

### Worker not processing jobs

Verify Redis is running and `REDIS_URL` is set. Check that the worker process is running (`bun dev:worker`). The worker marks stale runs (stuck in "running" status) as "failed" on startup.

### Webhook events not triggering generation

1. Ensure `WEBHOOK_BASE_URL` is publicly accessible (use a tunnel like ngrok for local development)
2. Verify the webhook is registered on the GitHub repo (check Settings → Webhooks)
3. Check that the push event modified a file matching the project's `specPath`

### `ENCRYPTION_KEY` validation error

The key must be exactly 64 hexadecimal characters (representing 32 bytes for AES-256). Generate one with:

```bash
openssl rand -hex 32
```

---

## Contributing

Contributions are welcome. Please open an issue to discuss proposed changes before submitting a pull request.

1. Fork the repository and create a feature branch
2. Ensure all tests pass: `bun run test` and `bun run test:e2e`
3. Verify types: `bun run check-types`
4. Follow existing code style and patterns
5. Submit a PR against `main`

---

## License

MIT. See [LICENSE](LICENSE) for details.
