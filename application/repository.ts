import type { Plan, PlanVersion } from "../domain/types.ts";

export interface StoredPlan {
  aggregate: Plan;
  revision: number;
}

export interface CommandReceipt<T = unknown> {
  commandId: string;
  planId: string;
  commandType: string;
  result: T;
  createdAt: string;
}

export interface VersionSnapshot {
  planId: string;
  versionId: string;
  snapshot: PlanVersion;
  sha256: string;
  createdAt: string;
}

export interface PlanRepository {
  get(planId: string): Promise<StoredPlan | undefined>;
  listByCreator(creatorId: string): Promise<StoredPlan[]>;
  getReceipt<T>(commandId: string): Promise<CommandReceipt<T> | undefined>;
  commit<T>(
    expectedRevision: number | undefined,
    stored: StoredPlan,
    receipt: CommandReceipt<T>,
    snapshot?: VersionSnapshot,
  ): Promise<void>;
  getSnapshot(versionId: string): Promise<VersionSnapshot | undefined>;
}

export class InMemoryPlanRepository implements PlanRepository {
  private plans = new Map<string, StoredPlan>();
  private receipts = new Map<string, CommandReceipt>();
  private snapshots = new Map<string, VersionSnapshot>();

  async get(planId: string): Promise<StoredPlan | undefined> {
    const stored = this.plans.get(planId);
    return stored ? structuredClone(stored) : undefined;
  }

  async listByCreator(creatorId: string): Promise<StoredPlan[]> {
    return [...this.plans.values()]
      .filter((stored) =>
        stored.aggregate.versions.some((version) => version.createdBy === creatorId),
      )
      .map((stored) => structuredClone(stored));
  }

  async getReceipt<T>(commandId: string): Promise<CommandReceipt<T> | undefined> {
    const receipt = this.receipts.get(commandId);
    return receipt ? structuredClone(receipt as CommandReceipt<T>) : undefined;
  }

  async commit<T>(
    expectedRevision: number | undefined,
    stored: StoredPlan,
    receipt: CommandReceipt<T>,
    snapshot?: VersionSnapshot,
  ): Promise<void> {
    const current = this.plans.get(stored.aggregate.id);
    if (current?.revision !== expectedRevision || (!current && expectedRevision !== undefined)) {
      throw new Error("Conflicto de concurrencia");
    }
    if (this.receipts.has(receipt.commandId)) return;
    this.plans.set(stored.aggregate.id, structuredClone(stored));
    this.receipts.set(receipt.commandId, structuredClone(receipt));
    if (snapshot) this.snapshots.set(snapshot.versionId, structuredClone(snapshot));
  }

  async getSnapshot(versionId: string): Promise<VersionSnapshot | undefined> {
    const snapshot = this.snapshots.get(versionId);
    return snapshot ? structuredClone(snapshot) : undefined;
  }
}
