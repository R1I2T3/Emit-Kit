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
  sdkNpmScope: z.string().nullable().optional().transform(v => v === "" || v === undefined ? null : v),
  sdkPypiName: z.string().nullable().optional().transform(v => v === "" || v === undefined ? null : v),
  sdkVersionStrategy: z.enum(["emitkit-managed", "spec-version"]).default("emitkit-managed"),
  geminiApiKey: z.string().nullable().optional().transform(v => v === "" || v === undefined ? null : v),
});

export async function getLatestConfig(projectId: string, database = db) {
  const [config] = await database
    .select()
    .from(projectConfigs)
    .where(eq(projectConfigs.projectId, projectId))
    .orderBy(desc(projectConfigs.createdAt))
    .limit(1);

  return config;
}

export async function saveConfig(
  projectId: string,
  data: z.input<typeof configSchema>,
  database = db,
) {
  const validated = configSchema.parse(data);

  const id = crypto.randomUUID();
  let encryptedApiKey = validated.geminiApiKey || null;
  if (validated.geminiApiKey && !/^[0-9a-fA-F]{24}:[0-9a-fA-F]{32}:[0-9a-fA-F]+$/.test(validated.geminiApiKey) && !validated.geminiApiKey.startsWith("encrypted:")) {
    encryptedApiKey = encrypt(validated.geminiApiKey);
  }

  const [inserted] = await database
    .insert(projectConfigs)
    .values({
      id,
      projectId,
      outputs: validated.outputs,
      sdkLanguages: validated.sdkLanguages,
      outputDir: validated.outputs.includes("SDK") ? validated.outputDir : ".emitkit/",
      sdkNpmScope: validated.sdkNpmScope,
      sdkPypiName: validated.sdkPypiName,
      sdkVersionStrategy: validated.sdkVersionStrategy,
      geminiApiKey: encryptedApiKey,
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to save configuration");
  }

  return inserted;
}

