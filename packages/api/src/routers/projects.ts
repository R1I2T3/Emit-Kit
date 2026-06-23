import { z } from "zod";
import { protectedProcedure } from "../index";
import { projects, organizationMembers, account } from "@Emitkit/db/schema";
import { eq, and } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { GitHubClient, listUserRepos } from "@Emitkit/github";
import {
  createFromExistingRepo,
  createNewRepo,
  deleteProject,
} from "../services/projects";

// Helper function to verify user is member of organization
async function checkMembership(db: any, orgId: string, userId: string) {
  const membership = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, orgId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!membership.length) {
    throw new ORPCError("FORBIDDEN");
  }
}

// Helper function to construct GitHubClient from user account
async function getGitHubClientForUser(db: any, userId: string) {
  const [userAccount] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "github")))
    .limit(1);

  if (!userAccount || !userAccount.accessToken) {
    throw new ORPCError("BAD_REQUEST", {
      message: "No connected GitHub account found",
    });
  }

  return new GitHubClient(userAccount.accessToken);
}

export const projectsRouter = {
  list: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .handler(async ({ context, input }) => {
      await checkMembership(context.db, input.orgId, context.user.id);

      const list = await context.db
        .select()
        .from(projects)
        .where(eq(projects.orgId, input.orgId));

      return list;
    }),

  get: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .handler(async ({ context, input }) => {
      const [project] = await context.db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new ORPCError("NOT_FOUND");
      }

      await checkMembership(context.db, project.orgId, context.user.id);

      return project;
    }),

  createFromExistingRepo: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        repoFullName: z.string(),
        specPath: z.string(),
        defaultBranch: z.string().default("main"),
      }),
    )
    .handler(async ({ context, input }) => {
      await checkMembership(context.db, input.orgId, context.user.id);

      const githubClient = await getGitHubClientForUser(
        context.db,
        context.user.id,
      );

      try {
        return await createFromExistingRepo(
          input.orgId,
          input.repoFullName,
          input.specPath,
          input.defaultBranch,
          githubClient,
          context.db,
        );
      } catch (error: any) {
        if (error.status === 404) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Could not find file "${input.specPath}" on branch "${input.defaultBranch}" (or repository is empty). Please check the file path and verify that the default branch has commits.`,
          });
        }
        if (
          error.status === 403 ||
          error.status === 401 ||
          error.message?.includes("Resource not accessible by integration")
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message: `GitHub permission denied: Cannot create repository webhook. Please verify that your GitHub App or OAuth App installation is granted "Webhooks: Read & Write" permissions, and that you have administrator/owner access to the repository".`,
          });
        }
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message:
            error.message ||
            "Failed to create project from existing repository",
        });
      }
    }),

  createNewRepo: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        repoName: z.string(),
        visibility: z.enum(["public", "private"]),
        orgLogin: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await checkMembership(context.db, input.orgId, context.user.id);

      const githubClient = await getGitHubClientForUser(
        context.db,
        context.user.id,
      );

      try {
        return await createNewRepo(
          input.orgId,
          input.repoName,
          input.visibility,
          input.orgLogin,
          githubClient,
          context.db,
        );
      } catch (error: any) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: error.message || "Failed to create new repository",
        });
      }
    }),

  listGithubRepos: protectedProcedure.handler(async ({ context }) => {
    const githubClient = await getGitHubClientForUser(
      context.db,
      context.user.id,
    );

    return await listUserRepos(githubClient);
  }),

  delete: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .handler(async ({ context, input }) => {
      const [project] = await context.db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new ORPCError("NOT_FOUND");
      }

      await checkMembership(context.db, project.orgId, context.user.id);

      const githubClient = await getGitHubClientForUser(
        context.db,
        context.user.id,
      ).catch(() => null);

      await deleteProject(input.projectId, githubClient, context.db);
    }),
};
