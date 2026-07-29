import type {
  Approval,
  Interaction,
  LedgerEntry,
  Plan,
  PlanLine,
  PlanLineKey,
  PlanVersion,
} from "./types.ts";

function keyOf(line: PlanLineKey): string {
  return `${line.accountId}::${line.skuId}::${line.month}`;
}

function assertDraft(version: PlanVersion): void {
  if (!["DRAFT", "READY", "RETURNED"].includes(version.status)) {
    throw new Error(`La versión ${version.id} es inmutable en estado ${version.status}`);
  }
}

function approvedBaselineUnits(line: PlanLine): number {
  if (line.baseline.state !== "APPROVED" || line.baseline.approvedUnits === undefined) {
    throw new Error(`Baseline no aprobado: ${keyOf(line)}`);
  }
  return line.baseline.approvedUnits;
}

export function calculatePlanLines(
  version: PlanVersion,
  ledgerEntries: readonly LedgerEntry[],
  interactions: readonly Interaction[],
): PlanVersion {
  assertDraft(version);
  const incrementalByLine = new Map<string, number>();
  for (const entry of ledgerEntries) {
    const key = keyOf(entry.allocation);
    incrementalByLine.set(key, (incrementalByLine.get(key) ?? 0) + entry.netUnits);
  }
  for (const interaction of interactions) {
    const key = keyOf(interaction);
    incrementalByLine.set(key, (incrementalByLine.get(key) ?? 0) + interaction.netUnits);
  }
  return {
    ...version,
    lines: version.lines.map((line) => ({
      ...line,
      planUnits:
        approvedBaselineUnits(line) +
        (incrementalByLine.get(keyOf(line)) ?? 0) +
        line.authorizedAdjustmentUnits,
    })),
  };
}

export function freezeVersion(
  version: PlanVersion,
  frozenAt: string,
): PlanVersion {
  assertDraft(version);
  const blockers = version.validations.filter(
    (validation) =>
      validation.severity === "BLOCKING" && validation.status === "OPEN",
  );
  if (blockers.length > 0) {
    throw new Error(`La versión tiene ${blockers.length} validación(es) bloqueante(s)`);
  }
  if (version.lines.some((line) => line.planUnits === undefined)) {
    throw new Error("La versión no está calculada");
  }
  return { ...version, status: "FROZEN", frozenAt };
}

export function submitVersion(version: PlanVersion): PlanVersion {
  if (version.status !== "FROZEN") {
    throw new Error("Sólo una versión congelada puede enviarse");
  }
  return { ...version, status: "SUBMITTED" };
}

export function createRevision(
  version: PlanVersion,
  id: string,
  createdBy: string,
  createdAt: string,
): PlanVersion {
  if (!["SUBMITTED", "RETURNED", "COMMERCIAL_APPROVED"].includes(version.status)) {
    throw new Error("La revisión requiere una versión enviada o devuelta");
  }
  return {
    ...structuredClone(version),
    id,
    number: version.number + 1,
    kind: "REVISION",
    status: "DRAFT",
    parentVersionId: version.id,
    createdBy,
    createdAt,
    frozenAt: undefined,
    approvals: [],
  };
}

export function decideVersion(
  version: PlanVersion,
  approval: Approval,
): PlanVersion {
  if (approval.stage === "COMMERCIAL" && version.status !== "SUBMITTED") {
    throw new Error("La aprobación comercial requiere una versión enviada");
  }
  if (approval.decision === "RETURNED") {
    return {
      ...version,
      status: "RETURNED",
      approvals: [...version.approvals, approval],
    };
  }
  return {
    ...version,
    status: "COMMERCIAL_APPROVED",
    approvals: [...version.approvals, approval],
  };
}

export function publishOfficial(plan: Plan, versionId: string): Plan {
  const version = plan.versions.find((candidate) => candidate.id === versionId);
  if (!version || version.status !== "COMMERCIAL_APPROVED") {
    throw new Error("Sólo una versión aprobada por la autoridad comercial puede oficializarse");
  }
  if (plan.officialVersionId && plan.officialVersionId !== versionId) {
    throw new Error("Ya existe una versión oficial para esta cuenta y año");
  }
  return {
    ...plan,
    officialVersionId: versionId,
    versions: plan.versions.map((candidate) =>
      candidate.id === versionId ? { ...candidate, status: "OFFICIAL" } : candidate,
    ),
  };
}
