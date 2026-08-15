import type { BuildingBlockDefinition } from "../domain/types.ts";
import type { SqlDatabaseLike } from "./sql-repository.ts";

type BuildingBlockRow = {
  id: string;
  code: string;
  name: string;
  family: BuildingBlockDefinition["family"];
  economic_treatment: BuildingBlockDefinition["economicTreatment"];
  owner_function: string;
  requires_evidence: number;
  requires_approval: number;
  active: number;
  version: number;
};

export async function readCanonicalBuildingBlockCatalog(
  database: SqlDatabaseLike,
): Promise<readonly BuildingBlockDefinition[]> {
  const result = await database.prepare(
    `select id, code, name, family, economic_treatment, owner_function,
            requires_evidence, requires_approval, active, version
       from revenue.building_block_definitions
      where active = 1
      order by code, version`,
  ).run<BuildingBlockRow>();
  const rows = result.results ?? [];
  if (rows.length === 0) {
    throw new Error("CANÓNICOS no contiene el catálogo activo de building blocks.");
  }
  const ids = new Set<string>();
  return rows.map((row) => {
    if (ids.has(row.id)) throw new Error(`Building block canónico duplicado: ${row.id}`);
    ids.add(row.id);
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      family: row.family,
      economicTreatment: row.economic_treatment,
      ownerFunction: row.owner_function,
      requiresEvidence: Boolean(row.requires_evidence),
      requiresApproval: Boolean(row.requires_approval),
      active: Boolean(row.active),
      version: row.version,
    };
  });
}
