import type { Plan } from "../domain/types.ts";
import type {
  CommandReceipt,
  PlanRepository,
  StoredPlan,
  VersionSnapshot,
} from "./repository.ts";

interface D1Result<T> {
  results?: T[];
  meta?: { changes?: number };
}

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  run<T>(): Promise<D1Result<T>>;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1Statement;
  batch<T = unknown>(statements: D1Statement[]): Promise<D1Result<T>[]>;
}

export class D1PlanRepository implements PlanRepository {
  private readonly db: D1DatabaseLike;

  constructor(db: D1DatabaseLike) {
    this.db = db;
  }

  async get(planId: string): Promise<StoredPlan | undefined> {
    const row = await this.db
      .prepare("SELECT aggregate_json, revision FROM plan_aggregates WHERE plan_id = ?")
      .bind(planId)
      .first<{ aggregate_json: string; revision: number }>();
    return row
      ? { aggregate: JSON.parse(row.aggregate_json) as Plan, revision: row.revision }
      : undefined;
  }

  async listByCreator(creatorId: string): Promise<StoredPlan[]> {
    const rows = await this.db
      .prepare(
        "SELECT aggregate_json, revision FROM plan_aggregates WHERE json_extract(aggregate_json, '$.versions[0].createdBy') = ? ORDER BY updated_at DESC",
      )
      .bind(creatorId)
      .run<{ aggregate_json: string; revision: number }>();
    return (rows.results ?? []).map((row) => ({
      aggregate: JSON.parse(row.aggregate_json) as Plan,
      revision: row.revision,
    }));
  }

  async getReceipt<T>(commandId: string): Promise<CommandReceipt<T> | undefined> {
    const row = await this.db
      .prepare(
        "SELECT command_id, plan_id, command_type, result_json, created_at FROM command_receipts WHERE command_id = ?",
      )
      .bind(commandId)
      .first<{
        command_id: string;
        plan_id: string;
        command_type: string;
        result_json: string;
        created_at: string;
      }>();
    return row
      ? {
          commandId: row.command_id,
          planId: row.plan_id,
          commandType: row.command_type,
          result: JSON.parse(row.result_json) as T,
          createdAt: row.created_at,
        }
      : undefined;
  }

  async commit<T>(
    expectedRevision: number | undefined,
    stored: StoredPlan,
    receipt: CommandReceipt<T>,
    snapshot?: VersionSnapshot,
  ): Promise<void> {
    const aggregateJson = JSON.stringify(stored.aggregate);
    const writeAggregate =
      expectedRevision === undefined
        ? this.db
            .prepare(
              "INSERT INTO plan_aggregates (plan_id, revision, aggregate_json, updated_at) VALUES (?, ?, ?, ?)",
            )
            .bind(stored.aggregate.id, stored.revision, aggregateJson, receipt.createdAt)
        : this.db
            .prepare(
              "UPDATE plan_aggregates SET revision = ?, aggregate_json = ?, updated_at = ? WHERE plan_id = ? AND revision = ?",
            )
            .bind(
              stored.revision,
              aggregateJson,
              receipt.createdAt,
              stored.aggregate.id,
              expectedRevision,
            );
    const statements = [
      writeAggregate,
      this.db
        .prepare(
          "INSERT INTO command_receipts (command_id, plan_id, command_type, result_json, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          receipt.commandId,
          receipt.planId,
          receipt.commandType,
          JSON.stringify(receipt.result),
          receipt.createdAt,
        ),
    ];
    if (snapshot) {
      statements.push(
        this.db
          .prepare(
            "INSERT INTO version_snapshots (version_id, plan_id, snapshot_json, sha256, created_at) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(
            snapshot.versionId,
            snapshot.planId,
            JSON.stringify(snapshot.snapshot),
            snapshot.sha256,
            snapshot.createdAt,
          ),
      );
    }
    const [aggregateResult] = await this.db.batch(statements);
    if ((aggregateResult.meta?.changes ?? 0) !== 1) {
      throw new Error("Conflicto de concurrencia");
    }
  }

  async getSnapshot(versionId: string): Promise<VersionSnapshot | undefined> {
    const row = await this.db
      .prepare(
        "SELECT plan_id, version_id, snapshot_json, sha256, created_at FROM version_snapshots WHERE version_id = ?",
      )
      .bind(versionId)
      .first<{
        plan_id: string;
        version_id: string;
        snapshot_json: string;
        sha256: string;
        created_at: string;
      }>();
    return row
      ? {
          planId: row.plan_id,
          versionId: row.version_id,
          snapshot: JSON.parse(row.snapshot_json),
          sha256: row.sha256,
          createdAt: row.created_at,
        }
      : undefined;
  }
}
