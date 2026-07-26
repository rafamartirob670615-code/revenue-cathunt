import { getBuildingBlockDefinition } from "./catalog.ts";
import type {
  Activity,
  IncrementAllocation,
  Interaction,
  LedgerEntry,
} from "./types.ts";

export interface LedgerResult {
  entries: LedgerEntry[];
  interactions: Interaction[];
  grossUnits: number;
  netActivityUnits: number;
  interactionUnits: number;
  netUnits: number;
}

function economicIdentity(activity: Activity): string {
  return [
    activity.sourceSystem,
    activity.sourceActivityId,
    activity.sourceVersion,
  ].join("::");
}

function sameScope(a: IncrementAllocation, b: IncrementAllocation): boolean {
  return (
    a.accountId === b.accountId &&
    a.skuId === b.skuId &&
    a.month === b.month &&
    (a.channelId ?? "") === (b.channelId ?? "") &&
    (a.geographyId ?? "") === (b.geographyId ?? "")
  );
}

export function calculateNetUnits(allocation: IncrementAllocation): number {
  return (
    allocation.grossUnits -
    allocation.cannibalizationUnits +
    allocation.haloUnits -
    allocation.pullForwardUnits +
    allocation.otherInteractionUnits
  );
}

export function buildIncrementLedger(
  versionId: string,
  activities: readonly Activity[],
  allocations: readonly IncrementAllocation[],
  interactions: readonly Interaction[] = [],
  baselineInclusionKeys: ReadonlySet<string> = new Set(),
): LedgerResult {
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const identities = new Set<string>();
  const allocationIdentities = new Set<string>();
  const entries: LedgerEntry[] = [];

  for (const activity of activities) {
    const definition = getBuildingBlockDefinition(activity.blockDefinitionId);
    if (definition.economicTreatment !== "INCREMENTAL") continue;
    if (!["ELIGIBLE", "APPROVED"].includes(activity.status)) continue;
    if (definition.requiresEvidence && activity.evidence.length === 0) {
      throw new Error(`La actividad ${activity.id} requiere evidencia`);
    }
    const identity = economicIdentity(activity);
    if (identities.has(identity)) {
      throw new Error(`Identidad económica duplicada: ${identity}`);
    }
    identities.add(identity);
    if (
      activity.baselineInclusionKey &&
      baselineInclusionKeys.has(activity.baselineInclusionKey)
    ) {
      throw new Error(`Actividad ya incluida en baseline: ${activity.id}`);
    }
  }

  for (const allocation of allocations) {
    const activity = activityById.get(allocation.activityId);
    if (!activity || !["ELIGIBLE", "APPROVED"].includes(activity.status)) continue;
    const definition = getBuildingBlockDefinition(activity.blockDefinitionId);
    if (definition.economicTreatment !== "INCREMENTAL") continue;
    const allocationIdentity = [
      versionId,
      allocation.activityId,
      allocation.accountId,
      allocation.skuId,
      allocation.month,
      allocation.channelId ?? "",
      allocation.geographyId ?? "",
    ].join("::");
    if (allocationIdentities.has(allocationIdentity)) {
      throw new Error(`Asignación económica duplicada: ${allocationIdentity}`);
    }
    allocationIdentities.add(allocationIdentity);
    entries.push({
      id: `ledger:${versionId}:${allocation.id}`,
      versionId,
      activity,
      allocation,
      netUnits: calculateNetUnits(allocation),
    });
  }

  for (let index = 0; index < entries.length; index += 1) {
    for (let other = index + 1; other < entries.length; other += 1) {
      const left = entries[index];
      const right = entries[other];
      if (!sameScope(left.allocation, right.allocation)) continue;
      const covered = interactions.some(
        (interaction) =>
          interaction.versionId === versionId &&
          interaction.accountId === left.allocation.accountId &&
          interaction.skuId === left.allocation.skuId &&
          interaction.month === left.allocation.month &&
          interaction.activityIds.includes(left.activity.id) &&
          interaction.activityIds.includes(right.activity.id),
      );
      if (!covered) {
        throw new Error(
          `Solapamiento sin interacción: ${left.activity.id} / ${right.activity.id}`,
        );
      }
    }
  }

  const acceptedInteractions = interactions.filter((interaction) => {
    if (interaction.versionId !== versionId) return false;
    if (!interaction.approvedBy || interaction.evidence.length === 0) {
      throw new Error(`Interacción no aprobada o sin evidencia: ${interaction.id}`);
    }
    return true;
  });
  const grossUnits = entries.reduce(
    (total, entry) => total + entry.allocation.grossUnits,
    0,
  );
  const netActivityUnits = entries.reduce(
    (total, entry) => total + entry.netUnits,
    0,
  );
  const interactionUnits = acceptedInteractions.reduce(
    (total, interaction) => total + interaction.netUnits,
    0,
  );
  return {
    entries,
    interactions: acceptedInteractions,
    grossUnits,
    netActivityUnits,
    interactionUnits,
    netUnits: netActivityUnits + interactionUnits,
  };
}
