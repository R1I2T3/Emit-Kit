import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
  const session = context.session;
  if (!session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({
    context: {
      db: context.db,
      user: session.user,
      session: session,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);
