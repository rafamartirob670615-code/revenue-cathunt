import { buildIncrementLedger } from "../domain/ledger.ts";
import {
  calculatePlanLines,
  createRevision,
  decideVersion,
  freezeVersion,
  publishOfficial,
  submitVersion,
} from "../domain/plan-engine.ts";
import type {
  Activity,
  Approval,
  BuildingBlockDefinition,
  IncrementAllocation,
  Interaction,
  Plan,
  PlanVersion,
} from "../domain/types.ts";
import type {
  CommandReceipt,
  PlanRepository,
  StoredPlan,
  VersionSnapshot,
} from "./repository.ts";

export interface CommandContext {
  commandId: string;
  actorId: string;
  occurredAt: string;
}

export interface CalculationInput {
  activities: Activity[];
  allocations: IncrementAllocation[];
  interactions?: Interaction[];
  baselineInclusionKeys?: string[];
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export class PlanService {
  private readonly repository: PlanRepository;
  private readonly buildingBlocks: () => Promise<readonly BuildingBlockDefinition[]>;

  constructor(
    repository: PlanRepository,
    buildingBlocks: () => Promise<readonly BuildingBlockDefinition[]>,
  ) {
    this.repository = repository;
    this.buildingBlocks = buildingBlocks;
  }

  private async execute<T>(
    planId: string,
    commandType: string,
    context: CommandContext,
    mutate: (stored: StoredPlan | undefined) => Promise<{
      aggregate: Plan;
      result: T;
      snapshot?: VersionSnapshot;
    }>,
  ): Promise<T> {
    const previous = await this.repository.getReceipt<T>(context.commandId);
    if (previous) {
      if (previous.planId !== planId || previous.commandType !== commandType) {
        throw new Error("El commandId ya fue utilizado para otra operación");
      }
      return previous.result;
    }
    const current = await this.repository.get(planId);
    const mutation = await mutate(current);
    const stored = {
      aggregate: mutation.aggregate,
      revision: (current?.revision ?? 0) + 1,
    };
    const receipt: CommandReceipt<T> = {
      commandId: context.commandId,
      planId,
      commandType,
      result: mutation.result,
      createdAt: context.occurredAt,
    };
    await this.repository.commit(
      current?.revision,
      stored,
      receipt,
      mutation.snapshot,
    );
    return mutation.result;
  }

  async createPlan(plan: Plan, context: CommandContext): Promise<Plan> {
    return this.execute(plan.id, "CREATE_PLAN", context, async (current) => {
      if (current) throw new Error(`El Plan ${plan.id} ya existe`);
      if (plan.versions.length !== 1 || plan.versions[0].status !== "DRAFT") {
        throw new Error("Un Plan nuevo requiere exactamente una versión borrador");
      }
      const aggregate = {
        ...structuredClone(plan),
        versions: plan.versions.map((version) => ({
          ...structuredClone(version),
          createdBy: context.actorId,
          createdAt: context.occurredAt,
        })),
      };
      return { aggregate, result: aggregate };
    });
  }

  async getPlan(planId: string): Promise<Plan | undefined> {
    return (await this.repository.get(planId))?.aggregate;
  }

  async listPlans(creatorId: string): Promise<Plan[]> {
    return (await this.repository.listByCreator(creatorId)).map(
      (stored) => stored.aggregate,
    );
  }

  async calculate(
    planId: string,
    versionId: string,
    input: CalculationInput,
    context: CommandContext,
  ): Promise<PlanVersion> {
    return this.execute(planId, "CALCULATE_PLAN", context, async (stored) => {
      if (!stored) throw new Error(`Plan no encontrado: ${planId}`);
      const version = stored.aggregate.versions.find((item) => item.id === versionId);
      if (!version) throw new Error(`Versión no encontrada: ${versionId}`);
      const ledger = buildIncrementLedger(
        versionId,
        input.activities,
        input.allocations,
        await this.buildingBlocks(),
        input.interactions,
        new Set(input.baselineInclusionKeys),
      );
      const calculated = calculatePlanLines(version, ledger.entries, ledger.interactions);
      const aggregate = {
        ...stored.aggregate,
        versions: stored.aggregate.versions.map((item) =>
          item.id === versionId ? calculated : item,
        ),
      };
      return { aggregate, result: calculated };
    });
  }

  async freezeAndSubmit(
    planId: string,
    versionId: string,
    context: CommandContext,
  ): Promise<{ version: PlanVersion; snapshotSha256: string }> {
    return this.execute(planId, "FREEZE_AND_SUBMIT", context, async (stored) => {
      if (!stored) throw new Error(`Plan no encontrado: ${planId}`);
      const version = stored.aggregate.versions.find((item) => item.id === versionId);
      if (!version) throw new Error(`Versión no encontrada: ${versionId}`);
      const submitted = submitVersion(freezeVersion(version, context.occurredAt));
      const snapshotSha256 = await sha256(submitted);
      const aggregate = {
        ...stored.aggregate,
        versions: stored.aggregate.versions.map((item) =>
          item.id === versionId ? submitted : item,
        ),
      };
      return {
        aggregate,
        result: { version: submitted, snapshotSha256 },
        snapshot: {
          planId,
          versionId,
          snapshot: submitted,
          sha256: snapshotSha256,
          createdAt: context.occurredAt,
        },
      };
    });
  }

  async decide(
    planId: string,
    versionId: string,
    approval: Approval,
    context: CommandContext,
  ): Promise<PlanVersion> {
    return this.execute(planId, `DECIDE_${approval.stage}`, context, async (stored) => {
      if (!stored) throw new Error(`Plan no encontrado: ${planId}`);
      const version = stored.aggregate.versions.find((item) => item.id === versionId);
      if (!version) throw new Error(`Versión no encontrada: ${versionId}`);
      const decided = decideVersion(version, approval);
      return {
        aggregate: {
          ...stored.aggregate,
          versions: stored.aggregate.versions.map((item) =>
            item.id === versionId ? decided : item,
          ),
        },
        result: decided,
      };
    });
  }

  async revise(
    planId: string,
    sourceVersionId: string,
    newVersionId: string,
    context: CommandContext,
  ): Promise<PlanVersion> {
    return this.execute(planId, "CREATE_REVISION", context, async (stored) => {
      if (!stored) throw new Error(`Plan no encontrado: ${planId}`);
      const source = stored.aggregate.versions.find((item) => item.id === sourceVersionId);
      if (!source) throw new Error(`Versión no encontrada: ${sourceVersionId}`);
      const revision = createRevision(
        source,
        newVersionId,
        context.actorId,
        context.occurredAt,
      );
      return {
        aggregate: {
          ...stored.aggregate,
          versions: [...stored.aggregate.versions, revision],
        },
        result: revision,
      };
    });
  }

  async makeOfficial(
    planId: string,
    versionId: string,
    context: CommandContext,
  ): Promise<Plan> {
    return this.execute(planId, "MAKE_OFFICIAL", context, async (stored) => {
      if (!stored) throw new Error(`Plan no encontrado: ${planId}`);
      const aggregate = publishOfficial(stored.aggregate, versionId);
      return { aggregate, result: aggregate };
    });
  }

  async verifySnapshot(versionId: string): Promise<boolean> {
    const stored = await this.repository.getSnapshot(versionId);
    return stored ? (await sha256(stored.snapshot)) === stored.sha256 : false;
  }
}
