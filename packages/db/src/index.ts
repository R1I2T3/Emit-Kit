import { env } from "@Emitkit/env/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

export function createDb() {
  const client = createClient({
    url: env.DATABASE_URL,
  });

  try {
    // Set busy_timeout FIRST so any contention during WAL mode switch is retried.
    client.execute("PRAGMA busy_timeout = 5000;");
    client.execute("PRAGMA journal_mode = WAL;");
  } catch (err) {
    console.error("Failed to configure database PRAGMAs:", err);
  }

  return drizzle({ client, schema });
}

export const db = createDb();
