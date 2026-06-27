import { env } from "@Emitkit/env/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

export function createDb() {
  const client = createClient({
    url: env.DATABASE_URL,
  });

  // Enable WAL mode for concurrent reads/writes across processes (server + worker).
  // Set a busy_timeout so transient locks are retried automatically instead of throwing SQLITE_BUSY.
  client.execute("PRAGMA journal_mode = WAL;");
  client.execute("PRAGMA busy_timeout = 5000;");

  return drizzle({ client, schema });
}

export const db = createDb();
