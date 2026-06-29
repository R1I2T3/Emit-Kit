# Emit-Kit

**Multi-agent Client & SDK Generation Platform** combining OpenAPI spec parsing, live validation, and BullMQ task orchestration for automated client SDK generation.

[![Version](https://img.shields.io/badge/version-0.1.0-blue)]()
[![Bun](https://img.shields.io/badge/bun-1.3.14-blue)]()
[![React](https://img.shields.io/badge/react-19-61DAFB)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## Table of Contents

- [What is Emit-Kit?](#what-is-emit-kit)
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

## What is Emit-Kit?

Emit-Kit is a **multi-agent client and SDK generation engine** that synchronizes with your GitHub repositories, allows real-time spec editing, performs live syntax and OpenAPI schema validation in the browser, and triggers background workers to compile, format, and push generated client libraries back to GitHub.

Unlike standard static code generators, Emit-Kit uses a **BullMQ-orchestrated background pipeline** that:

- Watches repositories via automatic **GitHub Webhooks**
- Parses specifications into structured representations
- Runs layout-aware parsing and schema resolution
- Performs static analysis and **compilation checks** on the generated SDKs
- Leverages Gemini-driven AI to optimize code and type safety
- Computes automatic **SemVer version bumps** (Major, Minor, Patch) based on API changes
- Manages optimistic locking (SHA-based verification) to prevent overwriting external changes

### What it does

- Synchronize organizations and repository access via GitHub OAuth
- Interactively edit OpenAPI/Swagger specs (JSON/YAML) with a high-fidelity CodeMirror editor
- Live check spec validity via browser-side parser (`SwaggerParser`)
- Automatically trigger SDK builds on repository push events
- Generate TypeScript, Python clients, Markdown documentation, and MCP servers
- Trace real-time generation logs and job runs from a web dashboard
- View and expand changelog summaries for published versions

### What it doesn't

- Not a general-purpose API designer — focused on spec ingestion, validation, and SDK output
- Not a runtime API Gateway — does not route live client requests
- No support for non-Git repositories — native integration with GitHub only
- No multi-branch generation targeting — builds target the default branch (e.g., `main`)
- No native mobile app (responsive web UI only)

---

## Architecture

```
┌──────────────┐     ┌─────────────────────────────────────────────────────────────────────────────┐
│   Frontend   │     │                                  Backend                                    │
│  (React 19 + │     │                                                                             │
│  Vite + TS)  │     │  ┌──────────┐   ┌──────────────────────────────────────────────────────┐   │
│              │     │  │   Hono   │   │                 BullMQ Pipelines                     │   │
│  ┌────────┐  │     │  │  Routes  │   │                                                      │   │
│  │ Spec   │──┼─────┼─►│          │──►│  ┌──────┐  ┌─────────┐  ┌──────┐  ┌──────────┐       │   │
│  │ Editor │  │     │  │ /rpc     │   │  │Queue │─►│  Fetch  │─►│Check │─►│  Parse   │       │   │
│  └────────┘  │     │  │ (oRPC)   │   │  │Submit│  │  Spec   │  │Syntax│  │  Spec    │       │   │
│  ┌────────┐  │     │  │          │   │  └──────┘  └─────────┘  └──────┘  └────┬─────┘       │   │
│  │ Runs   │──┼─────┼─►│ /auth    │   │                                          │            │   │
│  │ Log    │  │     │  │          │   │                              ┌───────────┼──────────┐ │   │
│  └────────┘  │     │  └──────────┘   │                              ▼           ▼          │ │   │
│  ┌────────┐  │     │  BullMQ Worker  │  ┌──────────────┐  ┌────────────┐  ┌────────────┐   │ │   │
│  │Versions│──┼─────┼─►  Processes    │  │   Compile    │◄─│   Format   │◄─│  Generate  │   │ │   │
│  │ List   │  │     │  │             │  │ (tsc check)  │  │ (prettier) │  │  (SDKs)     │   │ │   │
│  └────────┘  │     │  │ ┌─────────┐  │  └──────┬───────┘  └────────────┘  └────────────┘   │ │   │
│              │     │  │ │Stale Run│  │         │                                           │ │   │
│              │     │  │ │Handler  │  │         ▼                                           │ │   │
│              │     │  │ └─────────┘  │  ┌──────────────┐                                   │ │   │
│              │     │  └─────────────┘  │ Git Push Spec│                                   │ │   │
│              │     │                   │  (to GitHub) │                                   │ │   │
│              │     │                   └──────┬───────┘                                   │ │   │
│              │     │                          │                                           │ │   │
│              │     │                          ▼                                           │ │   │
│              │     │  ┌────────────────────────────────────────────────────────────┐    │ │   │
│              │     │  │                    Persistence Layer                       │    │ │   │
│              │     │  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │    │ │   │
│              │     │  │  │ SQLite  │  │  GitHub  │  │  Redis   │  │   Disk   │   │    │ │   │
│              │     │  │  │ (Drizzle│  │  Client  │  │ (BullMQ  │  │ (local   │   │    │ │   │
│              │     │  │  │   ORM)  │  │ (Octokit)│  │  queues) │  │  files)  │   │    │ │   │
│              │     │  │  └─────────┘  └──────────┘  └──────────┘  └──────────┘   │    │ │   │
│              │     │  └────────────────────────────────────────────────────────────┘    │ │   │
│              │     └─────────────────────────────────────────────────────────────────────┘ │   │
└──────────────┘     └───────────────────────────────────────────────────────────────────────┘   │
                                                                                                 │
┌─────────────────────────────────────────────────────────────────────────────────────────────────┘
│
▼
curl -X POST http://localhost:3000/rpc/projects/runs/trigger \
  -H "Authorization: Bearer <token>" \
  -d '{"projectId": "proj-uuid"}'
```

### Generation Pipeline

| Stage | Process | What it does |
|---|---|---|
| Fetch Spec | `worker/steps/fetch-spec` | Downloads OpenAPI spec file from target GitHub branch using Octokit |
| Syntax Check | `worker/steps/syntax-check` | Pre-validates spec formatting (JSON/YAML parser check) |
| Parse Spec | `worker/steps/parse-spec` | De-references schemas and converts parameters into generator definitions |
| Diff Spec | `worker/steps/diff-spec` | Compares current spec against previous published commit to identify changes |
| Calc Version | `worker/steps/calc-version` | Analyzes diff and determines SemVer bump (e.g., Major for breaking, Patch for description) |
| Generate SDKs | `packages/generators` | Writes boilerplate, models, client APIs, typings, and setup scripts |
| Format Code | `worker/steps/format` | Runs code formatters (`prettier`, `ruff format`) over generated directories |
| Compile Code | `worker/steps/compile` | Resolves syntax & compile health check (`tsc --noEmit` and `ruff check`) |
| Push Commit | `worker/steps/push` | Commits generated source code libraries directly back to repository |

### Data Stores

| Store | Technology | Purpose |
|---|---|---|
| RDBMS | SQLite 3 + Drizzle ORM | Stores users, oauth sessions, organizations, project configuration, generation runs, and versions |
| Task Broker | Redis 7 | Queue engine for BullMQ generation workers, triggers scheduling, and keeps execution lock |
| Source Control | GitHub API (Octokit) | Retrieves spec files, registers webhooks, commits code outputs |
| File Storage | Local / Disk | Local folder cache for cloning and compiling code steps in isolation |

### Background Workers

| Task | Trigger / Schedule | Description |
|---|---|---|
| SDK Generation Pipeline | On Webhook Push or Manual click | Performs parsing, code generation, lint, formatting, checks compile, commits output |
| Stale Runs Cleanup | Every 10 minutes | Cleans up generation jobs marked "running" but timed out or interrupted |

---

## Quick Start

### Prerequisites

- **Bun 1.3.14** (recommended runner: `curl -fsSL https://bun.sh/install | bash`)
- **Redis 7** (Running locally or via Docker)
- **Node.js 20+**
- A **GitHub OAuth App** (client ID and secret) for user login integration

### 1. Clone and configure

```bash
git clone <repo-url>
cd Emit-Kit
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env — set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET
```

### 2. Start Redis

```bash
docker run --name emitkit-redis -p 6379:6379 -d redis:7
```

### 3. Install dependencies

```bash
bun install
```

### 4. Run database setup

```bash
# Push schema changes to SQLite database
bun db:push
```

### 5. Start the stack

Launch all application components (Vite dev server, Hono backend API, and BullMQ worker pipeline):

```bash
bun dev
```

If you prefer to start them individually:

```bash
# Terminal 1 — Backend Hono API Server (port 3000)
bun dev:server

# Terminal 2 — React Frontend (port 3001)
bun dev:web

# Terminal 3 — BullMQ generation worker
bun dev:worker
```

### 6. Open the app

Open your browser to **http://localhost:3001** and log in with your GitHub account.

---

## Usage

### Fetch repository specification details

```bash
curl -X POST http://localhost:3000/rpc/projects/spec/get \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"projectId": "proj-uuid"}'
```

### Save edited specification with optimistic locking

```bash
curl -X POST http://localhost:3000/rpc/projects/spec/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "projectId": "proj-uuid",
    "content": "openapi: 3.0.0\n...",
    "sha": "current-github-file-sha-hash"
  }'
```

### Trigger a manual SDK generation run

```bash
curl -X POST http://localhost:3000/rpc/projects/runs/trigger \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"projectId": "proj-uuid"}'
```

### List published SDK versions

```bash
curl -X POST http://localhost:3000/rpc/versions/list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"projectId": "proj-uuid"}'
```

---

## Configuration

Settings are configured via environment variables in the corresponding workspace `.env` files.

### Backend Configurations (`apps/server/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:../../local.db` | Path to the SQLite local database file |
| `BETTER_AUTH_SECRET` | — | Secret key used for signing cookies and tokens |
| `BETTER_AUTH_URL` | `http://localhost:3000` | URL where Hono auth handlers are running |
| `CORS_ORIGIN` | `http://localhost:3001` | Semicolon/comma separated allowed origins |
| `REDIS_URL` | `redis://localhost:6379` | Connection string for BullMQ storage |
| `WEBHOOK_BASE_URL` | — | Publicly accessible domain for receiving GitHub push webhooks |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth Application Client ID |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth Application Client Secret |

### Frontend Configurations (`apps/web/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_SERVER_URL` | `http://localhost:3000` | Address of Hono backend API |

---

## API Reference

Communication between Frontend and Backend is structured around the `oRPC` RPC system.

| Endpoint Path | Method | Auth Required | Description |
|---|---|---|---|
| `/api/auth/*` | POST/GET | — | Better Auth login, refresh, session handlers |
| `/rpc/orgs/list` | POST | Yes | List organizations user belongs to |
| `/rpc/orgs/get` | POST | Yes | Get organization details and membership metadata |
| `/rpc/projects/list` | POST | Yes | List project configurations |
| `/rpc/projects/get` | POST | Yes | Fetch details for a project config |
| `/rpc/projects/createFromExistingRepo` | POST | Yes | Create project from existing GitHub repo |
| `/rpc/projects/createNewRepo` | POST | Yes | Create project by initiating a new repository |
| `/rpc/projects/delete` | POST | Yes | Delete project configuration and remove webhook |
| `/rpc/projects/spec/get` | POST | Yes | Fetch spec file content and SHA from GitHub |
| `/rpc/projects/spec/save` | POST | Yes | Update spec content on GitHub with SHA concurrency checks |
| `/rpc/projects/runs/list` | POST | Yes | Fetch recent generation runs for project |
| `/rpc/projects/runs/trigger` | POST | Yes | Manually trigger code generation job |
| `/rpc/versions/list` | POST | Yes | List SemVer releases published |

---

## Testing

Tests are structured into package-specific vitest test suites and root E2E browser tests.

### Unit & Integration tests (Vitest)

```bash
# Run backend, api routers and service tests
bun run test

# Run coverage report
bun run test:coverage
```

### End-to-End browser tests (Playwright)

```bash
# Make sure the application is built before running
bun run test:e2e
```

E2E configuration is located at [playwright.config.ts](./apps/web/playwright.config.ts) and mock API responses are setup inside the `apps/web/e2e` scripts.

### Build type checking

To compile and verify TypeScript typings across the workspaces:
```bash
bun run check-types
```

---

## Project Structure

```
Emit-Kit/
├── apps/
│   ├── web/               # React 19 Frontend (Vite)
│   │   ├── e2e/           # Playwright E2E browser test specs
│   │   ├── src/
│   │   │   ├── components/# Tab Switchers (Editor, Versions, Runs) & layouts
│   │   │   ├── hooks/     # React state hooks (useDebounce, etc.)
│   │   │   └── routes/    # Pages hierarchy (Dashboard, login, projects detail)
│   ├── server/            # Hono API Server
│   └── worker/            # BullMQ tasks processing pipeline
├── packages/
│   ├── api/               # oRPC routes schema definitions & business logic
│   ├── auth/              # Better Auth config and key cryptography utils
│   ├── config/            # Base configuration templates (Vitest, tsconfig)
│   ├── db/                # Drizzle schemas definitions & migration files
│   ├── env/               # Zod runtime environment variable validation
│   ├── generators/        # Code compiler templates (TS, Python, MCP, Docs)
│   ├── github/            # Octokit Client wraps and webhook verifiers
│   ├── queue/             # BullMQ queue managers
│   └── ui/                # Shared custom design components (Alert, table, badge)
├── local.db               # Local SQLite database (gitignored)
├── turbo.json             # Turborepo task pipeline mappings
├── package.json           # Bun workspaces manifest
└── README.md              # Project documentation
```

---

## Troubleshooting

### "LibsqlError: URL_INVALID: The URL 'undefined' is not in a valid format"

Verify that you are running test commands using `bun run test` (which triggers `vitest run`) instead of `bun test` (which runs Bun's native runner without isolating mock scopes). Ensure `DATABASE_URL` is set in the environment or present in `.env`.

### GitHub API HTTP 409 Conflict

If saving a specification changes fails with a conflict error, it means the spec file has been edited externally on GitHub since you loaded it. Reload the page to fetch the newest SHA before making edits.

### Tailwind utility classes not updating in web app

If custom UI component styles from `@Emitkit/ui` are not visible, ensure that you ran `bun run build` at the root or that `turbo dev` is running, so changes to packages are compiled and picked up by Vite's tailwind watcher.

---

## Contributing

Contributions are welcome. Open an issue to discuss changes before submitting PRs.

- Report bugs and suggest features via GitHub Issues.
- Ensure that formatting and lint rules match project specifications (`bun run check-types` and local unit test suites pass).

---

## License

MIT. See [LICENSE](LICENSE) for details.
