import { db } from "@Emitkit/db";
import { sdkVersions } from "@Emitkit/db/schema";
import { eq, desc } from "drizzle-orm";
import semver from "semver";

export async function calcVersion(
  config: any,
  diff: any,
  parsedSpec: any
): Promise<string> {
  if (config?.sdkVersionStrategy === "spec-version") {
    return parsedSpec?.info?.version || "0.1.0";
  }

  if (diff?.isFirstRun) {
    return "0.1.0";
  }

  const lastVersions = await db
    .select()
    .from(sdkVersions)
    .where(eq(sdkVersions.projectId, config.projectId))
    .orderBy(desc(sdkVersions.createdAt))
    .limit(1);

  const lastVersion = lastVersions[0]?.version || "0.1.0";

  let bumpType: "minor" | "patch" | null = null;

  if ((diff?.breakingChanges || []).length > 0 || (diff?.removedOperations || 0) > 0) {
    bumpType = "minor";
  } else if ((diff?.addedOperations || 0) > 0) {
    bumpType = "patch";
  }

  if (!bumpType) {
    return lastVersion;
  }

  // Ensure lastVersion is parsed and coerced/incremented correctly
  const cleanVersion = semver.clean(lastVersion) || semver.coerce(lastVersion)?.version || "0.1.0";
  return semver.inc(cleanVersion, bumpType) || lastVersion;
}
