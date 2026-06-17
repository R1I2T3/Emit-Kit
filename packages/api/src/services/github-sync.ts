import { Octokit } from "@octokit/rest";
import { eq, and } from "drizzle-orm";
import { db } from "@Emitkit/db";
import { organizations, organizationMembers } from "@Emitkit/db/schema";
import { encrypt } from "@Emitkit/auth/crypto";
import { randomUUID } from "crypto";

export async function syncGitHubOrgsForUser(
  userId: string,
  accessToken: string,
  database = db,
): Promise<string> {
  const octokit = new Octokit({ auth: accessToken });

  // 1. Create/ensure personal workspace exists
  const { data: ghUser } = await octokit.users.getAuthenticated();
  const personalGithubId = String(ghUser.id);

  const [existingPersonal] = await database
    .select()
    .from(organizations)
    .where(
      and(
        eq(organizations.isPersonal, true),
        eq(organizations.ownerUserId, userId),
      ),
    )
    .limit(1);

  if (!existingPersonal) {
    const personalOrgId = randomUUID();
    await database.insert(organizations).values({
      id: personalOrgId,
      githubOrgId: personalGithubId,
      name: ghUser.login,
      slug: ghUser.login.toLowerCase(),
      isPersonal: true,
      ownerUserId: userId,
    });

    await database
      .insert(organizationMembers)
      .values({
        orgId: personalOrgId,
        userId,
        role: "owner",
      })
      .onConflictDoNothing();
  }

  // 2. Sync GitHub organization workspaces (existing logic)
  const { data: orgs } = await octokit.orgs.listForAuthenticatedUser();

  for (const org of orgs) {
    const githubOrgId = String(org.id);

    const [existingOrg] = await database
      .select()
      .from(organizations)
      .where(eq(organizations.githubOrgId, githubOrgId))
      .limit(1);

    let orgId = existingOrg?.id;

    if (!orgId) {
      orgId = randomUUID();
      await database.insert(organizations).values({
        id: orgId,
        githubOrgId,
        name: org.login,
        slug: org.login.toLowerCase(),
      });
    }

    const role = org.role === "admin" ? "owner" : "member";

    await database
      .insert(organizationMembers)
      .values({
        orgId,
        userId,
        role,
      })
      .onConflictDoNothing();
  }

  return encrypt(accessToken);
}
