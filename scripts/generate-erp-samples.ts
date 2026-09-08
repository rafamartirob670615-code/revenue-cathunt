/**
 * Genera el paquete de archivos sintéticos que un usuario real subiría en
 * Información (Paso 2 de 8). Reemplaza la referencia rota a
 * outputs/demo_sintetica_oficial/ (esa carpeta nunca existió en el repo).
 *
 * Uso: node scripts/generate-erp-samples.ts
 * Salida: samples/erp-package/*.csv y *.xlsx
 */
import * as XLSX from "xlsx";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

XLSX.set_fs(fs);
const { writeFileSync, mkdirSync } = fs;

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "samples", "erp-package");
mkdirSync(outDir, { recursive: true });

const PREFIX = "SINTETICO_V2_NO_COMERCIAL_";
const ACCOUNT_ID = "UCM-0161";
const ACCOUNT_NAME = "Turmix de México";

const SKUS = [
  { id: "CAF-001", name: "Cafetera Turmix", family: "Café y Bebidas", price: 1450, cost: 870, sourceUnit: "CAJA", factor: 6, monthlyUnits: 300 },
  { id: "PUR-001", name: "Purificador Hogar", family: "Purificadores de agua", price: 2380, cost: 1428, sourceUnit: "PZA", factor: 1, monthlyUnits: 150 },
  { id: "LIC-001", name: "Licuadora Clásica", family: "Licuadoras", price: 920, cost: 552, sourceUnit: "CAJA", factor: 4, monthlyUnits: 420 },
] as const;

const HISTORY_YEAR = 2026;
const PLAN_YEAR = 2027;
const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const seasonal = [0.88, 0.92, 0.98, 1.01, 1.04, 1.07, 1.02, 0.97, 1.03, 1.09, 1.17, 1.24];

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(fileName: string, headers: string[], rows: Array<Array<string | number>>) {
  const lines = [headers.join(","), ...rows.map((row) => row.map(csvEscape).join(","))];
  writeFileSync(path.join(outDir, `${PREFIX}${fileName}.csv`), lines.join("\n") + "\n", "utf8");
}

function writeXlsx(fileName: string, headers: string[], rows: Array<Array<string | number>>) {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Datos");
  XLSX.writeFile(workbook, path.join(outDir, `${PREFIX}${fileName}.xlsx`));
}

// 1) Historia de ventas — Excel, encabezados en español (simula lo que ya usa la empresa).
{
  const rows: Array<Array<string | number>> = [];
  for (let m = 0; m < 12; m += 1) {
    for (const sku of SKUS) {
      const units = Math.round(sku.monthlyUnits * seasonal[m]);
      rows.push([ACCOUNT_ID, sku.id, `${HISTORY_YEAR}-${months[m]}`, units, units * sku.price, "MXN"]);
    }
  }
  writeXlsx("historia_ventas", ["Cuenta", "Producto", "Periodo", "Unidades", "Valor", "Moneda"], rows);
}

// 2) Catálogo y correspondencias — CSV, encabezados exactos.
{
  const rows: Array<Array<string | number>> = [
    ["cuenta", ACCOUNT_ID, ACCOUNT_ID, ACCOUNT_NAME],
    ...SKUS.map((sku) => ["producto", sku.id, sku.id, sku.name]),
  ];
  writeCsv("catalogo_correspondencias", ["source_type", "source_code", "canonical_id", "canonical_name"], rows);
}

// 3) Unidades y conversiones — CSV.
{
  const rows = SKUS.map((sku) => [sku.id, sku.sourceUnit, "PZA", sku.factor]);
  writeCsv("unidades_conversiones", ["sku_id", "source_unit", "base_unit", "conversion_factor"], rows);
}

// 4) Precios y moneda — CSV.
{
  const rows = SKUS.map((sku) => [ACCOUNT_ID, sku.id, `${HISTORY_YEAR}-01`, sku.price, "MXN", "LIST"]);
  writeCsv("precios_moneda", ["account_id", "sku_id", "valid_from", "price", "currency", "price_type"], rows);
}

// 5) Historia de promociones y actividades — CSV.
{
  const rows = [
    ["ACT-2026-01", "PROMO", ACCOUNT_ID, SKUS[0].id, `${HISTORY_YEAR}-06`, `${HISTORY_YEAR}-06`],
    ["ACT-2026-02", "DISPLAY", ACCOUNT_ID, SKUS[1].id, `${HISTORY_YEAR}-11`, `${HISTORY_YEAR}-11`],
  ];
  writeCsv("historia_promociones", ["activity_id", "activity_type", "account_id", "sku_id", "start_period", "end_period"], rows);
}

const activityHeaders = [
  "ID actividad", "Actividad", "Cuenta", "Producto", "Periodo inicio", "Periodo fin",
  "Volumen corporativo", "Participación cuenta", "Canibalización", "Halo",
  "Compra anticipada", "Interacción", "Evidencia",
];

// 6) Plan anual de Marketing — Excel.
{
  const rows: Array<Array<string | number>> = [
    ["MKT-2027-01", "Campaña Verano Café", ACCOUNT_ID, SKUS[0].id, `${PLAN_YEAR}-05`, `${PLAN_YEAR}-06`, 5000, 0.62, 80, 30, 10, 15, "Brief aprobado por Marketing 2027-02"],
    ["MKT-2027-02", "Relanzamiento Purificador", ACCOUNT_ID, SKUS[1].id, `${PLAN_YEAR}-09`, `${PLAN_YEAR}-10`, 3200, 0.55, 40, 20, 0, 5, "Brief aprobado por Marketing 2027-06"],
  ];
  writeXlsx("plan_marketing", activityHeaders, rows);
}

// 7) Plan anual de Trade Marketing — Excel.
{
  const rows: Array<Array<string | number>> = [
    ["TRADE-2027-01", "Exhibición fin de año Licuadora", ACCOUNT_ID, SKUS[2].id, `${PLAN_YEAR}-11`, `${PLAN_YEAR}-12`, 6000, 0.58, 90, 25, 60, -10, "Acuerdo comercial firmado 2027-08"],
  ];
  writeXlsx("plan_trade_marketing", activityHeaders, rows);
}

// 8) Condiciones comerciales — Excel.
{
  const rows = SKUS.map((sku) => [ACCOUNT_ID, sku.id, `${PLAN_YEAR}-01`, 0.08, 0.02, 0.01, 0.01, "Acuerdo comercial 2027 firmado por Finanzas Comercial"]);
  writeXlsx("condiciones_comerciales", ["Cuenta", "Producto", "Vigente desde", "Descuento", "Rebate", "Devoluciones", "Otras deducciones", "Evidencia"], rows);
}

// 9) Costos por producto — Excel.
{
  const rows = SKUS.map((sku) => [sku.id, `${PLAN_YEAR}-01`, sku.cost, "MXN", "Costo estándar vigente publicado por Finanzas"]);
  writeXlsx("costos_producto", ["Producto", "Vigente desde", "Costo unitario", "Moneda", "Evidencia"], rows);
}

// 10) Inversión de actividades — Excel.
{
  const rows: Array<Array<string | number>> = [
    ["MKT-2027-01", ACCOUNT_ID, SKUS[0].id, `${PLAN_YEAR}-05`, 150000, "MXN", "Presupuesto aprobado Marketing 2027"],
    ["TRADE-2027-01", ACCOUNT_ID, SKUS[2].id, `${PLAN_YEAR}-11`, 95000, "MXN", "Presupuesto aprobado Trade Marketing 2027"],
  ];
  writeXlsx("inversion_actividades", ["ID actividad", "Cuenta", "Producto", "Periodo", "Inversión", "Moneda", "Evidencia"], rows);
}

// 11) Cuota comercial — Excel.
{
  const rows: Array<Array<string | number>> = [];
  for (let m = 0; m < 12; m += 1) {
    for (const sku of SKUS) {
      rows.push([ACCOUNT_ID, sku.id, `${PLAN_YEAR}-${months[m]}`, Math.round(sku.monthlyUnits * 1.05 * sku.price), "MXN"]);
    }
  }
  writeXlsx("cuota_comercial", ["Cuenta", "Producto", "Periodo", "Cuota", "Moneda"], rows);
}

// 12) Ventas actuales — Excel (corte parcial, primer trimestre del año del Plan).
{
  const rows: Array<Array<string | number>> = [];
  for (let m = 0; m < 3; m += 1) {
    for (const sku of SKUS) {
      const units = Math.round(sku.monthlyUnits * 1.02);
      rows.push([ACCOUNT_ID, sku.id, `${PLAN_YEAR}-${months[m]}`, `${PLAN_YEAR}-03-31`, units, units * sku.price, "MXN"]);
    }
  }
  writeXlsx("ventas_actuales", ["Cuenta", "Producto", "Periodo", "Fecha de corte", "Unidades actuales", "Venta actual", "Moneda"], rows);
}

console.log(`Listo: 12 archivos generados en ${outDir}`);
