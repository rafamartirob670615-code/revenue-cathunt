import type { BuildingBlockDefinition } from "../../domain/types.ts";

// Muestra mínima sintética para pruebas; no es un catálogo operativo.
export const testBuildingBlocks: readonly BuildingBlockDefinition[] = [
  {
    id: "bb-trade",
    code: "TEST-TRADE",
    name: "Trade de prueba",
    family: "TRADE_PROMOTION",
    economicTreatment: "INCREMENTAL",
    ownerFunction: "Test",
    requiresEvidence: true,
    requiresApproval: true,
    active: true,
    version: 1,
  },
  {
    id: "bb-distribution",
    code: "TEST-DIST",
    name: "Distribución de prueba",
    family: "DISTRIBUTION",
    economicTreatment: "INCREMENTAL",
    ownerFunction: "Test",
    requiresEvidence: true,
    requiresApproval: true,
    active: true,
    version: 1,
  },
];

export const readTestBuildingBlocks = async () => testBuildingBlocks;
