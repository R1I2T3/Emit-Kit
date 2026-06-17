import { Octokit } from "@octokit/rest";
import { eq, and } from "drizzle-orm";
import { db } from "@Emitkit/db";
import { organizations, organizationMembers } from "@Emitkit/db/schema";
import { encrypt } from "@Emitkit/auth/crypto";
import { randomUUID } from "crypto";

async function getUniqueSlug(
  baseSlug: string,
  orgId: string,
  tx: any
): Promise<string> {
  let slug = baseSlug;
  let suffix = 0;
  while (true) {
    const [existingWithSlug] = await tx
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (!existingWithSlug || existingWithSlug.id === orgId) {
      return slug;
    }
    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }
}

export async function syncGitHubOrgsForUser(
  userId: string,
  accessToken: string,
  database = db,
): Promise<string> {
  const octokit = new Octokit({ auth: accessToken });

  // Fetch from GitHub API outside transaction to avoid holding database locks
  const { data: ghUser } = await octokit.users.getAuthenticated();
  const { data: orgs } = await octokit.orgs.listForAuthenticatedUser();

  return await database.transaction(async (tx) => {
    // 1. Create/ensure personal workspace exists
    const personalGithubId = String(ghUser.id);

    const [existingPersonal] = await tx
      .select()
      .from(organizations)
      .where(
        and(
          eq(organizations.isPersonal, true),
          eq(organizations.ownerUserId, userId),
        ),
      )
      .limit(1);

    let personalOrgId = existingPersonal?.id;

    if (!personalOrgId) {
      personalOrgId = randomUUID();
      const baseSlug = ghUser.login.toLowerCase();
      const slug = await getUniqueSlug(baseSlug, personalOrgId, tx);

      await tx.insert(organizations).values({
        id: personalOrgId,
        githubOrgId: personalGithubId,
        name: ghUser.login,
        slug,
        isPersonal: true,
        ownerUserId: userId,
      });
    } else {
      const baseSlug = ghUser.login.toLowerCase();
      const slug = await getUniqueSlug(baseSlug, personalOrgId, tx);

      if (
        existingPersonal.githubOrgId !== personalGithubId ||
        existingPersonal.name !== ghUser.login ||
        existingPersonal.slug !== slug
      ) {
        await tx
          .update(organizations)
          .set({
            githubOrgId: personalGithubId,
            name: ghUser.login,
            slug,
          })
          .where(eq(organizations.id, personalOrgId));
      }
    }

    await tx
      .insert(organizationMembers)
      .values({
        orgId: personalOrgId,
        userId,
        role: "owner",
      })
      .onConflictDoNothing();

    // 2. Sync GitHub organization workspaces (existing logic)
    for (const org of orgs) {
      const githubOrgId = String(org.id);

      const [existingOrg] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.githubOrgId, githubOrgId))
        .limit(1);

      let orgId = existingOrg?.id;

      if (!orgId) {
        orgId = randomUUID();
        const baseSlug = org.login.toLowerCase();
        const slug = await getUniqueSlug(baseSlug, orgId, tx);

        await tx.insert(organizations).values({
          id: orgId,
          githubOrgId,
          name: org.login,
          slug,
        });
      } else {
        const baseSlug = org.login.toLowerCase();
        const slug = await getUniqueSlug(baseSlug, orgId, tx);

        if (existingOrg.name !== org.login || existingOrg.slug !== slug) {
          await tx
            .update(organizations)
            .set({
              name: org.login,
              slug,
            })
            .where(eq(organizations.id, orgId));
        }
      }

      const role = org.role === "admin" ? "owner" : "member";

      await tx
        .insert(organizationMembers)
        .values({
          orgId,
          userId,
          role,
        })
        .onConflictDoUpdate({
          target: [organizationMembers.orgId, organizationMembers.userId],
          set: { role },
        });
    }

    return encrypt(accessToken);
  });
}
