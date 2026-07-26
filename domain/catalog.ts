import type { BuildingBlockDefinition } from "./types.ts";

export const BUILDING_BLOCK_CATALOG_VERSION = 1;

export const initialBuildingBlockCatalog: readonly BuildingBlockDefinition[] = [
  {
    id: "bb-marketing",
    code: "MKT",
    name: "Marketing",
    family: "MARKETING",
    economicTreatment: "INCREMENTAL",
    ownerFunction: "Marketing",
    requiresEvidence: true,
    requiresApproval: true,
    active: true,
    version: 1,
  },
  {
    id: "bb-trade",
    code: "TRADE",
    name: "Mercadeo y promociones",
    family: "TRADE_PROMOTION",
    economicTreatment: "INCREMENTAL",
    ownerFunction: "Mercadeo",
    requiresEvidence: true,
    requiresApproval: true,
    active: true,
    version: 1,
  },
  {
    id: "bb-innovation",
    code: "INNO",
    name: "Lanzamientos e innovación",
    family: "INNOVATION",
    economicTreatment: "INCREMENTAL",
    ownerFunction: "Marketing",
    requiresEvidence: true,
    requiresApproval: true,
    active: true,
    version: 1,
  },
  {
    id: "bb-distribution",
    code: "DIST",
    name: "Distribución",
    family: "DISTRIBUTION",
    economicTreatment: "INCREMENTAL",
    ownerFunction: "Ventas",
    requiresEvidence: true,
    requiresApproval: true,
    active: true,
    version: 1,
  },
  {
    id: "bb-price",
    code: "PRICE",
    name: "Precio",
    family: "PRICE",
    economicTreatment: "INCREMENTAL",
    ownerFunction: "RGM",
    requiresEvidence: true,
    requiresApproval: true,
    active: true,
    version: 1,
  },
  {
    id: "bb-constraint",
    code: "CONSTRAINT",
    name: "Restricciones",
    family: "CONSTRAINT",
    economicTreatment: "CONSTRAINT",
    ownerFunction: "Operaciones",
    requiresEvidence: true,
    requiresApproval: false,
    active: true,
    version: 1,
  },
  {
    id: "bb-interaction",
    code: "INTERACTION",
    name: "Interacciones",
    family: "INTERACTION",
    economicTreatment: "INTERACTION",
    ownerFunction: "Revenue",
    requiresEvidence: true,
    requiresApproval: true,
    active: true,
    version: 1,
  },
  {
    id: "bb-authorized-adjustment",
    code: "AUTHORIZED_ADJUSTMENT",
    name: "Ajustes autorizados",
    family: "AUTHORIZED_ADJUSTMENT",
    economicTreatment: "ADJUSTMENT",
    ownerFunction: "Revenue",
    requiresEvidence: true,
    requiresApproval: true,
    active: true,
    version: 1,
  },
] as const;

export function getBuildingBlockDefinition(id: string): BuildingBlockDefinition {
  const definition = initialBuildingBlockCatalog.find((item) => item.id === id);
  if (!definition || !definition.active) {
    throw new Error(`Building block no disponible: ${id}`);
  }
  return definition;
}
