import type { auth as authInstance } from "@Emitkit/auth";
import { db } from "@Emitkit/db";
import type { Context as HonoContext } from "hono";

export type Auth = typeof authInstance;

export type CreateContextOptions = {
  context: HonoContext;
  auth: Auth;
};

export async function createContext({ context, auth }: CreateContextOptions) {
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
