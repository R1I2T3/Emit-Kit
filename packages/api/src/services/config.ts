import { db } from "@Emitkit/db";
import { projectConfigs } from "@Emitkit/db/schema";
import { eq, desc } from "drizzle-orm";
import { encrypt } from "@Emitkit/auth/crypto";
import { z } from "zod";
import crypto from "crypto";

export const configSchema = z.object({
  outputs: z.array(z.enum(["SDK", "CLI", "MCP", "DOCS"])),
  sdkLanguages: z.array(z.enum(["typescript", "python"])),
  outputDir: z.string().default(".emitkit/"),
  sdkNpmScope: z.string().nullable().optional(),
  sdkPypiName: z.string().nullable().optional(),
  sdkVersionStrategy: z.enum(["emitkit-managed", "spec-version"]).default("emitkit-managed"),
  geminiApiKey: z.string().nullable().optional(),
});

export async function getLatestConfig(projectId: string, dbConnection?: any) {
  const client = dbConnection || db;
  const [config] = await client
    .select()
    .from(projectConfigs)
    .where(eq(projectConfigs.projectId, projectId))
    .orderBy(desc(projectConfigs.createdAt))
    .limit(1);

  return config;
}

export async function saveConfig(
  projectId: string,
  data: z.infer<typeof configSchema>,
  dbConnection?: any,
) {
  const validated = configSchema.parse(data);
  const client = dbConnection || db;

  const id = crypto.randomUUID();
  const encryptedApiKey = validated.geminiApiKey
    ? encrypt(validated.geminiApiKey)
    : null;

  const [inserted] = await client
    .insert(projectConfigs)
    .values({
      id,
      projectId,
      outputs: validated.outputs,
      sdkLanguages: validated.sdkLanguages,
      outputDir: validated.outputDir,
      sdkNpmScope: validated.sdkNpmScope ?? null,
      sdkPypiName: validated.sdkPypiName ?? null,
      sdkVersionStrategy: validated.sdkVersionStrategy,
      geminiApiKey: encryptedApiKey,
    })
    .returning();

  return inserted;
}
