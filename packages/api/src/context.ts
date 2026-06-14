import { auth } from "@Emitkit/auth";
import { db } from "@Emitkit/db";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    db,
    user: session?.user,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
