import { db } from "@Emitkit/db";
import { generationRuns } from "@Emitkit/db/schema";
import { eq, and, desc } from "drizzle-orm";

export interface DiffResult {
  isFirstRun: boolean;
  addedOperations: number;
  removedOperations: number;
  modifiedOperations: number;
  breakingChanges: string[];
}

export async function diffSpec(currentSpec: any, projectId: string): Promise<DiffResult> {
  const lastRuns = await db
    .select()
    .from(generationRuns)
    .where(
      and(
        eq(generationRuns.projectId, projectId),
        eq(generationRuns.status, "success")
      )
    )
    .orderBy(desc(generationRuns.createdAt))
    .limit(1);

  const lastRun = lastRuns[0];

  if (!lastRun || !lastRun.specSnapshot) {
    return {
      isFirstRun: true,
      addedOperations: (currentSpec.operations || []).length,
      removedOperations: 0,
      modifiedOperations: 0,
      breakingChanges: [],
    };
  }

  let previousSpec: any;
  try {
    previousSpec = typeof lastRun.specSnapshot === "string"
      ? JSON.parse(lastRun.specSnapshot)
      : lastRun.specSnapshot;
  } catch {
    return {
      isFirstRun: true,
      addedOperations: (currentSpec.operations || []).length,
      removedOperations: 0,
      modifiedOperations: 0,
      breakingChanges: [],
    };
  }

  if (!previousSpec || !Array.isArray(previousSpec.operations)) {
    return {
      isFirstRun: true,
      addedOperations: (currentSpec.operations || []).length,
      removedOperations: 0,
      modifiedOperations: 0,
      breakingChanges: [],
    };
  }

  const currentOps = currentSpec.operations || [];
  const previousOps = previousSpec.operations || [];

  const currentOpIds = new Set(currentOps.map((op: any) => op.operationId).filter(Boolean));
  const previousOpIds = new Set(previousOps.map((op: any) => op.operationId).filter(Boolean));

  const added = currentOps.filter((op: any) => op.operationId && !previousOpIds.has(op.operationId));
  const removed = previousOps.filter((op: any) => op.operationId && !currentOpIds.has(op.operationId));

  const breaking: string[] = [];

  for (const currentOp of currentOps) {
    if (!currentOp.operationId) continue;
    const prevOp = previousOps.find((op: any) => op.operationId === currentOp.operationId);
    if (!prevOp) continue;

    const currentRequired = (currentOp.parameters || []).filter((p: any) => p && p.required === true);
    const prevRequired = (prevOp.parameters || []).filter((p: any) => p && p.required === true);

    if (currentRequired.length > prevRequired.length) {
      breaking.push(currentOp.operationId);
    }
  }

  return {
    isFirstRun: false,
    addedOperations: added.length,
    removedOperations: removed.length,
    modifiedOperations: breaking.length,
    breakingChanges: breaking,
  };
}
