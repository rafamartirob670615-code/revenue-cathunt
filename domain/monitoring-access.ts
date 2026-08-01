import type { AlfaBillingFilters, AlfaBillingRow } from "./alfa-turmix-monitoring.ts";

export type MonitoringPersona = "KEY_ACCOUNT" | "TRADE_MARKETING" | "MARKETING" | "AREA_DIRECTOR" | "DEPARTMENT_DIRECTOR" | "ADMINISTRATOR";
export type MonitoringAction = "VIEW" | "DRILLDOWN" | "CREATE_OPPORTUNITY" | "EXPORT" | "EDIT_OFFICIAL_DATA" | "CONFIGURE_ACCESS";

export type MonitoringScope = {
  persona: MonitoringPersona;
  accountNames?: string[];
  territories?: string[];
  channels?: string[];
  families?: string[];
};

export type MonitoringAccessRule = {
  type: "ALL" | "ACCOUNT" | "TERRITORY" | "CHANNEL" | "FAMILY";
  value?: string;
};

export type MonitoringOpportunity = {
  id: string;
  createdBy: MonitoringPersona;
  scope: AlfaBillingFilters;
  metric: "COVERAGE" | "VS_BUSINESS_PLAN" | "VS_LAST_YEAR" | "MIX";
  description: string;
  owner: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  sourceDataset: string;
  createdAt: string;
};

const actions: Record<MonitoringPersona, MonitoringAction[]> = {
  KEY_ACCOUNT: ["VIEW", "DRILLDOWN", "CREATE_OPPORTUNITY", "EXPORT"],
  TRADE_MARKETING: ["VIEW", "DRILLDOWN", "CREATE_OPPORTUNITY", "EXPORT"],
  MARKETING: ["VIEW", "DRILLDOWN", "CREATE_OPPORTUNITY", "EXPORT"],
  AREA_DIRECTOR: ["VIEW", "DRILLDOWN", "CREATE_OPPORTUNITY", "EXPORT"],
  DEPARTMENT_DIRECTOR: ["VIEW", "DRILLDOWN", "CREATE_OPPORTUNITY", "EXPORT"],
  ADMINISTRATOR: ["CONFIGURE_ACCESS"],
};

export function canMonitoring(persona: MonitoringPersona, action: MonitoringAction) {
  return actions[persona].includes(action);
}

export function scopeMonitoringRows(rows: AlfaBillingRow[], scope: MonitoringScope) {
  return rows.filter((row) => {
    if (scope.accountNames?.length && !scope.accountNames.includes(row.account)) return false;
    if (scope.territories?.length && !scope.territories.includes(row.territory)) return false;
    if (scope.channels?.length && !scope.channels.includes(row.channel)) return false;
    if (scope.families?.length && !scope.families.includes(row.family)) return false;
    return true;
  });
}

export function filterRowsByMonitoringAccess(rows: AlfaBillingRow[], rules: MonitoringAccessRule[]) {
  if (!rules.length || rules.some((rule) => rule.type === "ALL")) return rows;
  return rows.filter((row) => rules.some((rule) =>
    (rule.type === "ACCOUNT" && row.account === rule.value) ||
    (rule.type === "TERRITORY" && row.territory === rule.value) ||
    (rule.type === "CHANNEL" && row.channel === rule.value) ||
    (rule.type === "FAMILY" && row.family === rule.value)
  ));
}

export function createMonitoringOpportunity(input: Omit<MonitoringOpportunity, "sourceDataset" | "status">): MonitoringOpportunity {
  return { ...input, status: "OPEN", sourceDataset: "ALFA_TURMIX_SINTETICO_NO_COMERCIAL" };
}

export function personaScope(persona: MonitoringPersona): MonitoringScope {
  switch (persona) {
    case "KEY_ACCOUNT": return { persona, accountNames: ["Bodega Aurrera", "Coppel"] };
    case "TRADE_MARKETING": return { persona, channels: ["Retail Moderno", "Departamental"] };
    case "MARKETING": return { persona, families: ["Café y Bebidas", "Licuadoras", "Extractores de Jugo"] };
    case "AREA_DIRECTOR": return { persona, territories: ["Centro"] };
    case "DEPARTMENT_DIRECTOR": return { persona };
    case "ADMINISTRATOR": return { persona };
  }
}
