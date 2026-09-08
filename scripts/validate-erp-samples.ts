/**
 * Corre los archivos de samples/erp-package/ por el mismo motor de
 * validación que usa /api/inputs, para confirmar que quedan READY antes
 * de que alguien los suba manualmente desde la pantalla de Información.
 *
 * Uso: node scripts/validate-erp-samples.ts
 */
import * as XLSX from "xlsx";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateCsvContent } from "../domain/input-package.ts";
import { analyzeSalesWorkbook, analyzeActivityWorkbook, analyzeFinancialWorkbook, type WorkbookCell } from "../domain/excel-intake.ts";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "samples", "erp-package");
const PREFIX = "SINTETICO_V2_NO_COMERCIAL_";

const financialRequirements = new Set(["commercial-conditions", "product-costs", "activity-investments", "sales-quota", "actual-sales"]);

const plan: Array<{ requirementId: string; file: string; kind: "csv" | "excel" }> = [
  { requirementId: "sales-history", file: "historia_ventas.xlsx", kind: "excel" },
  { requirementId: "account-product-mapping", file: "catalogo_correspondencias.csv", kind: "csv" },
  { requirementId: "unit-conversions", file: "unidades_conversiones.csv", kind: "csv" },
  { requirementId: "prices-currency", file: "precios_moneda.csv", kind: "csv" },
  { requirementId: "activity-history", file: "historia_promociones.csv", kind: "csv" },
  { requirementId: "marketing-plan", file: "plan_marketing.xlsx", kind: "excel" },
  { requirementId: "trade-marketing-plan", file: "plan_trade_marketing.xlsx", kind: "excel" },
  { requirementId: "commercial-conditions", file: "condiciones_comerciales.xlsx", kind: "excel" },
  { requirementId: "product-costs", file: "costos_producto.xlsx", kind: "excel" },
  { requirementId: "activity-investments", file: "inversion_actividades.xlsx", kind: "excel" },
  { requirementId: "sales-quota", file: "cuota_comercial.xlsx", kind: "excel" },
  { requirementId: "actual-sales", file: "ventas_actuales.xlsx", kind: "excel" },
];

let failures = 0;
for (const item of plan) {
  const fullPath = path.join(dir, `${PREFIX}${item.file}`);
  const bytes = fs.readFileSync(fullPath);
  let status: string;
  let issues: Array<{ code: string; message: string }>;
  let rowCount = 0;
  if (item.kind === "csv") {
    const result = validateCsvContent(item.requirementId, bytes.toString("utf8"));
    status = result.status;
    issues = result.issues;
    rowCount = result.summary.rowCount;
  } else {
    const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true, dense: true });
    const sheets = workbook.SheetNames.map((name) => ({
      name,
      rows: XLSX.utils.sheet_to_json<WorkbookCell[]>(workbook.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false }),
    }));
    const analysis = item.requirementId === "sales-history"
      ? analyzeSalesWorkbook(sheets)
      : financialRequirements.has(item.requirementId)
        ? analyzeFinancialWorkbook(sheets, item.requirementId as "commercial-conditions" | "product-costs" | "activity-investments" | "sales-quota" | "actual-sales")
        : analyzeActivityWorkbook(sheets, item.requirementId === "marketing-plan" ? "MARKETING" : "TRADE_MARKETING");
    status = analysis.status;
    issues = analysis.issues;
    rowCount = analysis.summary.validRowCount;
  }
  const ok = status === "READY";
  if (!ok) failures += 1;
  console.log(`${ok ? "✔" : "✘"} ${item.requirementId.padEnd(24)} ${status.padEnd(11)} filas=${rowCount}${issues.length ? `  issues=${JSON.stringify(issues)}` : ""}`);
}
console.log(failures ? `\n${failures} archivo(s) NO quedaron READY.` : "\nTodos los archivos quedaron READY.");
process.exit(failures ? 1 : 0);
