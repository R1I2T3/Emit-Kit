import { createDb } from "@Emitkit/db";
import * as schema from "@Emitkit/db/schema/auth";
import { env } from "@Emitkit/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export type AuthHooks = {
  /** Called after a social-provider account is created or updated (OAuth sign-in).
   *  Receives the userId and raw accessToken so the consumer can trigger org sync. */
  onAccountLinked?: (userId: string, accessToken: string) => Promise<void>;
};

export function createAuth(hooks?: AuthHooks) {
  const db = createDb();

  const accountHook = hooks?.onAccountLinked
    ? async (account: Record<string, unknown>) => {
        const accessToken = account.accessToken as string | null | undefined;
        const userId = account.userId as string;
        const providerId = account.providerId as string;

        if (providerId === "github" && accessToken) {
          try {
            await hooks.onAccountLinked!(userId, accessToken);
          } catch (err) {
            console.error("[auth] onAccountLinked hook failed:", err);
          }
        }
      }
    : undefined;

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",

      schema: schema,
    }),
    user: {
      additionalFields: {
        githubId: {
          type: "string",
          required: true,
        },
        avatarUrl: {
          type: "string",
          required: false,
        },
      },
    },
    trustedOrigins: (env.CORS_ORIGIN || "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        scope: [
          "repo",
          "read:org",
          "workflow",
          "user:email",
          "write:repo_hook",
        ],
        mapProfileToUser: (profile) => {
          return {
            githubId: profile.id.toString(),
            avatarUrl: profile.avatar_url,
          };
        },
      },
    },
    account: {
      // Re-save account data (including refreshed accessToken) on every sign-in
      // so the update hook fires for subsequent logins, not just the first one.
      updateAccountOnSignIn: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    databaseHooks: accountHook
      ? {
          account: {
            create: { after: async (account) => accountHook(account) },
            update: { after: async (account) => accountHook(account) },
          },
        }
      : undefined,
    plugins: [],
  });
}

export const auth = createAuth();
