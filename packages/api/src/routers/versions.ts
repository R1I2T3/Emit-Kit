import { z } from "zod";
import { protectedProcedure } from "../index";
import { projects, organizationMembers, sdkVersions } from "@Emitkit/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { ORPCError } from "@orpc/server";

export const versionsRouter = {
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      })
    )
    .handler(async ({ context, input }) => {
      const [project] = await context.db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new ORPCError("NOT_FOUND");
      }

      // Check if the current authenticated user is a member of the project's organization
      const membership = await context.db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.orgId, project.orgId),
            eq(organizationMembers.userId, context.user.id),
          ),
        )
        .limit(1);

      if (!membership.length) {
        throw new ORPCError("FORBIDDEN");
      }

      // Return versions from sdkVersions table
      const list = await context.db
        .select({
          id: sdkVersions.id,
          version: sdkVersions.version,
          changeType: sdkVersions.changeType,
          changelog: sdkVersions.changelog,
          createdAt: sdkVersions.createdAt,
          runId: sdkVersions.runId,
        })
        .from(sdkVersions)
        .where(eq(sdkVersions.projectId, input.projectId))
        .orderBy(desc(sdkVersions.createdAt));

      return list;
    }),
};
