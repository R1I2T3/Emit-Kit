import { z } from "zod";
import { protectedProcedure } from "../index";
import { organizations, organizationMembers } from "@Emitkit/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";

export const orgsRouter = {
  list: protectedProcedure.handler(async ({ context }) => {
    const orgs = await context.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        githubOrgId: organizations.githubOrgId,
        isPersonal: organizations.isPersonal,
      })
      .from(organizations)
      .innerJoin(
        organizationMembers,
        eq(organizations.id, organizationMembers.orgId),
      )
      .where(eq(organizationMembers.userId, context.user.id));

    return orgs;
  }),

  get: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .handler(async ({ context, input }) => {
      // Verify user is member
      const membership = await context.db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.orgId, input.orgId),
            eq(organizationMembers.userId, context.user.id),
          ),
        )
        .limit(1);

      if (!membership.length) {
        throw new ORPCError("FORBIDDEN");
      }

      const [org] = await context.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.orgId))
        .limit(1);

      if (!org) {
        throw new ORPCError("NOT_FOUND");
      }

      // Get member count
      const memberCountResult = await context.db
        .select({ count: sql<number>`count(*)` })
        .from(organizationMembers)
        .where(eq(organizationMembers.orgId, input.orgId));

      return { ...org, memberCount: memberCountResult[0]?.count ?? 0 };
    }),
};
