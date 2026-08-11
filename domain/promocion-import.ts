/**
 * Importador del contrato `activity_export_v1` de PROMOCIÓN V3.
 *
 * PROMOCIÓN V3 exporta eventos comerciales cerrados (FAM/FAP) aprobados,
 * versionados y con `allocationStatus = ALLOCATED` — ver
 * `PROMOCION V3/docs/FASE_6_IMPORTADORES_ACTUALS_Y_EXPORT_REVENUE_V1.md` y
 * la función `buildRevenueActivityExport()` en `PROMOCION V3/index.html`.
 *
 * Este módulo convierte ese export al formato de `activitiesCsv` que espera
 * `calculateBaselineFromAcceptedPackage` en `baseline-engine.ts`
 * (`activity_id,activity_type,account_id,sku_id,start_period,end_period,impact_units`),
 * para desimpactar la base del año siguiente con los eventos reales del año
 * que cierra.
 *
 * BRECHA DE CONTRATO CONOCIDA (documentada aquí a propósito, no oculta):
 * el export real de PROMOCIÓN V3 (`buildRevenueActivityExport`) hoy solo
 * lleva montos (`planned_investment`, `planned_result`), no unidades. El
 * motor de baseline de REVENUE necesita `impact_units` (unidades), no
 * dinero. Para producción, PROMOCIÓN V3 debe agregar un campo de unidades
 * (`impact_units` o `units`) a cada actividad exportada — hoy no existe.
 * Mientras ese campo no exista del lado de PROMOCIÓN V3, este importador:
 *   - Si la actividad trae `impact_units` o `units`, los usa directamente.
 *   - Si no, lanza un error explícito en vez de inventar un número
 *     (nunca convierte dinero a unidades con un precio supuesto).
 */

export interface PromocionActivityExportItem {
  activity_id: string;
  source_event_id?: string;
  activity_type?: string;
  account_id: string | null;
  sku_ids?: string[];
  month: string; // "YYYY-MM"
  planned_investment?: number;
  planned_result?: number;
  impact_units?: number;
  units?: number;
  data_quality?: string;
}

export interface PromocionActivityExport {
  contract_version: string;
  generated_at?: string;
  source_system?: string;
  status?: string;
  activities: PromocionActivityExportItem[];
}

function csvEscape(value: string): string {
  return /[,";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Convierte un export `activity_export_v1` de PROMOCIÓN V3 en el texto CSV
 * de actividades que `calculateBaselineFromAcceptedPackage` espera como
 * `activitiesCsv`.
 *
 * Reglas:
 * - Rechaza cualquier `contract_version` distinto de `activity_export_v1`.
 * - Ignora actividades sin `account_id` (no se pueden desimpactar sin cuenta).
 * - Expande `sku_ids` (array) a una fila por SKU; si no hay SKU, usa `"SIN_SKU"`.
 * - Exige unidades explícitas (`impact_units` o `units`) por actividad — ver
 *   brecha de contrato documentada arriba.
 */
export function activitiesCsvFromPromocionExport(
  exportPayload: PromocionActivityExport,
): string {
  if (exportPayload.contract_version !== "activity_export_v1") {
    throw new Error(
      `Versión de contrato no soportada: ${exportPayload.contract_version}. Se esperaba activity_export_v1.`,
    );
  }

  const rows: string[] = [
    "activity_id,activity_type,account_id,sku_id,start_period,end_period,impact_units",
  ];

  for (const activity of exportPayload.activities) {
    if (!activity.account_id) continue; // sin cuenta no se puede desimpactar

    const units = activity.impact_units ?? activity.units;
    if (units === undefined || units === null) {
      throw new Error(
        `La actividad ${activity.activity_id} no trae unidades (impact_units/units). ` +
          "PROMOCIÓN V3 debe exportar unidades, no solo montos, antes de usarse en producción.",
      );
    }
    if (!Number.isFinite(units) || units < 0) {
      throw new Error(`La actividad ${activity.activity_id} trae unidades inválidas.`);
    }

    const skuIds = activity.sku_ids && activity.sku_ids.length > 0 ? activity.sku_ids : ["SIN_SKU"];
    const unitsPerSku = units / skuIds.length;

    for (const skuId of skuIds) {
      rows.push(
        [
          csvEscape(activity.activity_id),
          csvEscape(activity.activity_type ?? "PROMOCION_V3"),
          csvEscape(activity.account_id),
          csvEscape(skuId),
          csvEscape(activity.month),
          csvEscape(activity.month),
          String(unitsPerSku),
        ].join(","),
      );
    }
  }

  return rows.join("\n");
}
