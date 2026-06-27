# Worker Code Quality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve code quality issues in `apps/worker` as identified by the Task 2 Code Quality Review.

**Architecture:** Add error listener to Redis client, use atomic SQLite string concatenation (`||`) for database logging in `logStep` and `markStaleRunsAsFailed` to avoid concurrency issues, wrap DB and Redis log operations in try-catch blocks to avoid worker crashes, duplicate Redis connection for BullMQ Worker, and execute stale run cleanup on startup only if run as the main script.

**Tech Stack:** Bun, Drizzle ORM, SQLite, ioredis, BullMQ

---

### Task 1: Add Redis Error Listener
**Files:**
- Modify: [apps/worker/src/lib/redis.ts](file:///home/ritesh/workspace/Emit-Kit/apps/worker/src/lib/redis.ts)

- [ ] **Step 1: Add the error listener**
  Add the `.on("error", ...)` registration to `apps/worker/src/lib/redis.ts`.

### Task 2: Use Atomic String Concatenation and Try-Catch in Logger
**Files:**
- Modify: [apps/worker/src/lib/logger.ts](file:///home/ritesh/workspace/Emit-Kit/apps/worker/src/lib/logger.ts)
- Modify: [apps/worker/src/lib/logger.test.ts](file:///home/ritesh/workspace/Emit-Kit/apps/worker/src/lib/logger.test.ts)

- [ ] **Step 1: Import `sql` and update `logStep` logic**
  Change `logStep` in `apps/worker/src/lib/logger.ts` to use atomic sql string concatenation and separate try-catch blocks for DB update and Redis publish.
- [ ] **Step 2: Update unit tests in `logger.test.ts`**
  Remove DB select mock/assertions, update mock to support new DB update/set pattern, and add tests for database/redis logging failure handling.

### Task 3: Worker Connection Duplication, Startup Behavior, and Stale Logs Append
**Files:**
- Modify: [apps/worker/src/index.ts](file:///home/ritesh/workspace/Emit-Kit/apps/worker/src/index.ts)
- Modify: [apps/worker/src/index.test.ts](file:///home/ritesh/workspace/Emit-Kit/apps/worker/src/index.test.ts)

- [ ] **Step 1: Use duplicate connection and update startup condition**
  Modify the `Worker` instantiation in `apps/worker/src/index.ts` to use `redis.duplicate()`, change `markStaleRunsAsFailed` to append abort status using atomic concatenation, and wrap the startup call in `if (import.meta.main)`.
- [ ] **Step 2: Update index unit tests**
  Mock `redis.duplicate` in `index.test.ts` to prevent TypeError on load.
