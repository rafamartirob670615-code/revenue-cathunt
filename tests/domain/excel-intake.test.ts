import assert from "node:assert/strict";
import test from "node:test";
import { analyzeActivityWorkbook, analyzeFinancialWorkbook, analyzeSalesWorkbook } from "../../domain/excel-intake.ts";

test("detecta una tabla de ventas aunque los encabezados estén en español y no comiencen en la primera fila", () => {
  const rows: Array<Array<string | number | null>> = [
    ["Reporte anual", null, null, null, null, null],
    ["Cliente", "Código producto", "Mes", "Cantidad", "Venta bruta", "Moneda"],
    ...Array.from({ length: 12 }, (_, index) => [
      "CUENTA-1",
      "SKU-1",
      `2025-${String(index + 1).padStart(2, "0")}`,
      100 + index,
      1_000 + index * 10,
      "MXN",
    ]),
  ];
  const result = analyzeSalesWorkbook([
    { name: "Portada", rows: [["Sólo notas"]] },
    { name: "Ventas 2025", rows },
  ]);
  assert.equal(result.status, "READY");
  assert.equal(result.selectedSheet, "Ventas 2025");
  assert.equal(result.headerRow, 2);
  assert.equal(result.confidence, 100);
  assert.equal(result.summary.validRowCount, 12);
  assert.equal(result.summary.coverageMonths, 12);
  assert.equal(result.mapping.account_id, "Cliente");
  assert.equal(result.canonicalRows[0].period, "2025-01");
});

test("convierte un plan de Marketing y asigna a la cuenta su participación del volumen corporativo", () => {
  const result = analyzeActivityWorkbook([{
    name: "Plan Marketing",
    rows: [
      ["ID actividad","Actividad","Cuenta","SKU","Fecha inicio","Fecha fin","Unidades corporativas","Participación cuenta","Canibalización","Halo","Compra anticipada","Interacción","Evidencia"],
      ["MKT-01","Campaña verano","WALMART","SKU-1","2027-05","2027-06",1000,40,30,10,20,-5,"Plan MKT aprobado"],
    ],
  }], "MARKETING");
  assert.equal(result.status, "READY");
  assert.equal(result.confidence, 100);
  assert.equal(result.canonicalRows[0].allocationShare, 0.4);
  assert.equal(result.canonicalRows[0].grossUnits, 400);
  assert.equal(result.summary.allocatedUnits, 400);
  assert.equal(result.canonicalRows[0].source_row, 2);
});

test("no inventa campos ni aprueba una historia con cobertura insuficiente", () => {
  const result = analyzeSalesWorkbook([{
    name: "Datos",
    rows: [
      ["Cuenta", "SKU", "Mes", "Unidades", "Valor"],
      ["CUENTA-1", "SKU-1", "2025-01", 100, 1_000],
    ],
  }]);
  assert.equal(result.status, "INCOMPLETE");
  assert.ok(result.issues.some((issue) => issue.code === "MISSING_FIELDS"));
  assert.equal(result.mapping.currency, undefined);
  assert.equal(result.canonicalRows.length, 0);
});

test("separa filas inválidas y conserva la trazabilidad de la fila fuente", () => {
  const rows: Array<Array<string | number>> = [
    ["Account", "Product code", "Period", "Units", "Value", "Currency"],
    ...Array.from({ length: 12 }, (_, index) => [
      "ACC-1", "SKU-1", `2025-${String(index + 1).padStart(2, "0")}`, 10, 100, "MXN",
    ]),
    ["ACC-1", "SKU-1", "periodo inválido", 10, 100, "MXN"],
  ];
  const result = analyzeSalesWorkbook([{ name: "Export ERP", rows }]);
  assert.equal(result.status, "READY");
  assert.equal(result.summary.validRowCount, 12);
  assert.equal(result.summary.rejectedRowCount, 1);
  assert.equal(result.canonicalRows[0].source_sheet, "Export ERP");
  assert.equal(result.canonicalRows[0].source_row, 2);
  assert.ok(result.issues.some((issue) => issue.code === "REJECTED_ROWS"));
});

test("normaliza condiciones comerciales y bloquea deducciones mayores a cien por ciento", () => {
  const valid = analyzeFinancialWorkbook([{
    name: "Condiciones",
    rows: [
      ["Cuenta","SKU","Vigencia","Descuento","Rebate","Devoluciones","Otras deducciones","Evidencia"],
      ["CUENTA-1","SKU-1","2027-01-01",8,3,0.01,0.005,"Acuerdo 2027"],
    ],
  }], "commercial-conditions");
  assert.equal(valid.status, "READY");
  assert.equal(valid.canonicalRows[0].discount_rate, 0.08);
  assert.equal(valid.canonicalRows[0].other_deduction_rate, 0.005);

  const invalid = analyzeFinancialWorkbook([{
    name: "Condiciones",
    rows: [
      ["Cuenta","SKU","Vigencia","Descuento","Rebate","Devoluciones","Otras deducciones","Evidencia"],
      ["CUENTA-1","SKU-1","2027-01-01",80,30,0.01,0.005,"Acuerdo 2027"],
    ],
  }], "commercial-conditions");
  assert.equal(invalid.status, "INCOMPLETE");
  assert.ok(invalid.issues.some((issue) => issue.code === "REJECTED_ROWS"));
});
