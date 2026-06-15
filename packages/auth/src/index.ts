import { createDb } from "@Emitkit/db";
import * as schema from "@Emitkit/db/schema/auth";
import { env } from "@Emitkit/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export function createAuth() {
  const db = createDb();

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
    trustedOrigins: [env.CORS_ORIGIN],
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        scope: ["repo", "read:org", "workflow"],
        mapProfileToUser: (profile) => {
          return {
            githubId: profile.id.toString(),
            avatarUrl: profile.avatar_url,
          };
        },
      },
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
    plugins: [],
  });
}

export const auth = createAuth();
