import test from "node:test";
import assert from "node:assert/strict";
import {
  ALFA_FAMILIES,
  ALFA_TURMIX_DATASET,
  alfaTurmixCatalog,
  createAlfaTurmixRows,
  createAlfaTurmixBillingMatrix,
  filterAlfaTurmixRows,
  summarizeAlfaTurmixRows,
} from "../../domain/alfa-turmix-monitoring.ts";

test("ALFA Turmix uses the current Electrodomésticos taxonomy", () => {
  assert.deepEqual([...ALFA_FAMILIES], [
    "Complementos de cocina",
    "Café y Bebidas",
    "Purificadores de agua",
    "Parrillas y asadores",
    "Licuadoras",
    "Extractores de Jugo",
  ]);
  assert.equal(ALFA_TURMIX_DATASET, "ALFA_TURMIX_SINTETICO_NO_COMERCIAL");
});

test("ALFA Turmix generates a complete twelve-month monitoring grain", () => {
  const rows = createAlfaTurmixRows();
  assert.equal(alfaTurmixCatalog().accounts.length, 199);
  assert.equal(rows.length, 12 * 199 * 6 * 2);
  assert.equal(new Set(rows.map((row) => row.period)).size, 12);
  assert.equal(new Set(rows.map((row) => row.family)).size, 6);
  assert.ok(rows.every((row) => row.category === "Electrodomésticos"));
  assert.ok(rows.every((row) => row.sourceClass === ALFA_TURMIX_DATASET));
});

test("ALFA Turmix filters and reconciles plan, actual and year-ago", () => {
  const rows = createAlfaTurmixRows();
  const filtered = filterAlfaTurmixRows(rows, { family: "Licuadoras", territory: "Centro" });
  assert.equal(filtered.length, 12 * 2 * new Set(rows.filter((row) => row.territory === "Centro").map((row) => row.account)).size);
  const summary = summarizeAlfaTurmixRows(filtered);
  assert.ok(summary.acceptedPlanValue > 0);
  assert.ok(summary.actualValue > 0);
  assert.equal(summary.vsBusinessPlanValue, summary.actualValue - summary.businessPlanValue);
  assert.equal(summary.vsLastYearValue, summary.actualValue - summary.lastYearValue);
});

test("the Billing matrix keeps the Excel reading pattern", () => {
  const matrix = createAlfaTurmixBillingMatrix(createAlfaTurmixRows());
  assert.equal(matrix.length, 7);
  assert.equal(matrix[0].label, "Complementos de cocina");
  assert.equal(matrix.at(-1)?.label, "TOTAL ELECTRODOMÉSTICOS");
  assert.equal("FY" in matrix[0].rows[0].values, false);
  assert.equal("YTD" in matrix[0].rows[0].values, true);
  assert.deepEqual(matrix[0].rows.map((row) => row.metric), [
    "Plan aceptado", "Actuales (ERP)", "Cobertura", "Vs. Business Plan",
    "Cobertura Vs. BP ($)", "Cobertura Vs. BP (%)", "Real facturado año anterior",
    "Δ a año anterior ($)", "Δ a año anterior (%)",
  ]);
  assert.equal(matrix[0].rows[0].values["Q1"], matrix[0].rows[0].values["01"]! + matrix[0].rows[0].values["02"]! + matrix[0].rows[0].values["03"]!);
});
