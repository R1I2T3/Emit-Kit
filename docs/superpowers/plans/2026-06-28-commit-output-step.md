# Commit Output Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the commitOutput function in `apps/worker/src/steps/commit-output.ts` and write tests for it in `apps/worker/src/steps/commit-output.test.ts`.

**Architecture:** The step determines the output repo, filters out custom files that already exist on GitHub, adds GitHub actions workflow files for TypeScript and Python if required by configuration, creates a run-specific branch, commits the files, and opens a pull request.

**Tech Stack:** TypeScript, Vitest, @Emitkit/github, @Emitkit/generators

---

### Task 1: Implement `commitOutput` Function

**Files:**
- Create: `apps/worker/src/steps/commit-output.ts`

- [ ] **Step 1: Write implementation of `commitOutput`**
  - Parse output repository name and split into `owner` and `repo`.
  - Filter files with `"/custom/"` in their path if they already exist in the repository's default branch using `checkFileExists`.
  - Safely parse string/array properties for `config.outputs` and `config.sdkLanguages`.
  - Add npm workflow (`.github/workflows/publish-npm.yml`) using `generateNpmWorkflow` if outputs contains `"SDK"` and languages contains `"typescript"`.
  - Add PyPI workflow (`.github/workflows/publish-pypi.yml`) using `generatePyPIWorkflow` if outputs contains `"SDK"` and languages contains `"python"`.
  - Fetch default branch head ref using `githubClient.getOctokit().git.getRef`.
  - Create Git branch `emitkit/run-${runId}`.
  - Commit files with message `chore: emitkit run #${runId} — ${version}`.
  - Create a pull request with the required title and body.
  - Return `{ prUrl, branchName }`.

### Task 2: Implement Unit Tests

**Files:**
- Create: `apps/worker/src/steps/commit-output.test.ts`

- [ ] **Step 1: Write test suite**
  - Mock `@Emitkit/github` functions (`createBranch`, `checkFileExists`, `createCommitWithFiles`, `createPullRequest`) and `GitHubClient`.
  - Mock `@Emitkit/generators` functions (`generateNpmWorkflow`, `generatePyPIWorkflow`).
  - Test repository determination logic (separate repo if `project.outputMode === "separate"`, else base repo).
  - Test filtering logic for custom files (excludes file if `checkFileExists` returns `true`, includes file if `checkFileExists` returns `false`).
  - Test addition of workflows based on config outputs and sdkLanguages (handling both parsed arrays and raw JSON string arrays).
  - Test ref fetching, branch creation, commit message formatting, and PR generation with title and markdown body formatting.
