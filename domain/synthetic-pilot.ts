export const SYNTHETIC_DATA_LABEL = "CASO TÉCNICO V2 — NO COMERCIAL";
export const SYNTHETIC_SCENARIO_VERSION = "REVENUE-SYNTHETIC-V2";

const skus = [
  { id: "SKU-SYN-001", name: "Producto sintético A", price: 128.5, base: 940 },
  { id: "SKU-SYN-002", name: "Producto sintético B", price: 86.25, base: 720 },
  { id: "SKU-SYN-003", name: "Producto sintético C", price: 54.75, base: 510 },
] as const;

const seasonalFactors = [0.91, 0.94, 0.98, 1.01, 1.04, 1.07, 1.03, 0.99, 1.02, 1.08, 1.15, 1.22];

function csv(headers: string[], rows: Array<Array<string | number>>) {
  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

export function createSyntheticPilotPackage(planYear: number, accountId: string) {
  const historyYears = [planYear - 2, planYear - 1];
  const activities = new Map<string, number>([
    [`${planYear - 2}-05|SKU-SYN-001`, 85],
    [`${planYear - 2}-11|SKU-SYN-002`, 70],
    [`${planYear - 1}-03|SKU-SYN-003`, 55],
    [`${planYear - 1}-09|SKU-SYN-001`, 95],
  ]);
  const salesRows: Array<Array<string | number>> = [];
  for (const year of historyYears) {
    for (let month = 1; month <= 12; month += 1) {
      const period = `${year}-${String(month).padStart(2, "0")}`;
      for (const sku of skus) {
        const recurring = Math.round(sku.base * seasonalFactors[month - 1] * (year === planYear - 1 ? 1.025 : 1));
        const activityUnits = activities.get(`${period}|${sku.id}`) ?? 0;
        const units = recurring + activityUnits;
        salesRows.push([
          accountId,
          sku.id,
          period,
          units,
          (units * sku.price).toFixed(2),
          "MXN",
          "SYNTHETIC_NON_COMMERCIAL",
        ]);
      }
    }
  }

  const activityRows = [...activities.entries()].map(([key, impactUnits], index) => {
    const [period, skuId] = key.split("|");
    return [
      `ACT-SYN-${String(index + 1).padStart(3, "0")}`,
      "PROMOCION_SINTETICA",
      accountId,
      skuId,
      period,
      period,
      impactUnits,
      "SYNTHETIC_NON_COMMERCIAL",
    ];
  });
  const quotaRows:Array<Array<string|number>>=[]; const actualRows:Array<Array<string|number>>=[];
  for(let month=1;month<=12;month+=1){const period=`${planYear}-${String(month).padStart(2,"0")}`;for(const sku of skus){const plannedUnits=Math.round(sku.base*seasonalFactors[month-1]*1.04);quotaRows.push([accountId,sku.id,period,(plannedUnits*sku.price*1.02).toFixed(2),"MXN",SYNTHETIC_SCENARIO_VERSION]);if(month<=6){const actualUnits=Math.round(plannedUnits*(month%2===0?.97:1.03));actualRows.push([accountId,sku.id,period,`${planYear}-06-30`,actualUnits,(actualUnits*sku.price).toFixed(2),"MXN",SYNTHETIC_SCENARIO_VERSION]);}}}

  return [
    {
      requirementId: "sales-history",
      filename: "SINTETICO_V2_NO_COMERCIAL_historia_ventas.csv",
      content: csv(
        ["account_id", "sku_id", "period", "units", "value", "currency", "data_classification"],
        salesRows,
      ),
    },
    {
      requirementId: "account-product-mapping",
      filename: "SINTETICO_V2_NO_COMERCIAL_catalogo_correspondencias.csv",
      content: csv(
        ["source_type", "source_code", "canonical_id", "canonical_name", "data_classification"],
        [
          ["account", accountId, accountId, "Cuenta sintética controlada", "SYNTHETIC_NON_COMMERCIAL"],
          ...skus.map((sku) => ["sku", sku.id, sku.id, sku.name, "SYNTHETIC_NON_COMMERCIAL"]),
        ],
      ),
    },
    {
      requirementId: "unit-conversions",
      filename: "SINTETICO_V2_NO_COMERCIAL_conversiones.csv",
      content: csv(
        ["sku_id", "source_unit", "base_unit", "conversion_factor", "data_classification"],
        skus.map((sku) => [sku.id, "CAJA", "UNIDAD", 12, "SYNTHETIC_NON_COMMERCIAL"]),
      ),
    },
    {
      requirementId: "prices-currency",
      filename: "SINTETICO_V2_NO_COMERCIAL_precios.csv",
      content: csv(
        ["account_id", "sku_id", "valid_from", "price", "currency", "price_type", "data_classification"],
        skus.map((sku) => [accountId, sku.id, `${planYear}-01-01`, sku.price, "MXN", "LISTA_SINTETICA", "SYNTHETIC_NON_COMMERCIAL"]),
      ),
    },
    {
      requirementId: "activity-history",
      filename: "SINTETICO_V2_NO_COMERCIAL_actividades.csv",
      content: csv(
        ["activity_id", "activity_type", "account_id", "sku_id", "start_period", "end_period", "impact_units", "data_classification"],
        activityRows,
      ),
    },
    { requirementId:"sales-quota", filename:"SINTETICO_V2_NO_COMERCIAL_cuota.csv", content:csv(["account_id","sku_id","period","quota_value","currency","scenario_version"],quotaRows) },
    { requirementId:"actual-sales", filename:"SINTETICO_V2_NO_COMERCIAL_actuals.csv", content:csv(["account_id","sku_id","period","cutoff_date","actual_units","actual_value","currency","scenario_version"],actualRows) },
  ];
}
