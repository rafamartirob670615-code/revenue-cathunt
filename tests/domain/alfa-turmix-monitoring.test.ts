import test from "node:test";
import assert from "node:assert/strict";
import {
  ALFA_FAMILIES,
  ALFA_TURMIX_DATASET,
  alfaTurmixAsOfDate,
  alfaTurmixCatalog,
  createAlfaTurmixRows,
  createAlfaTurmixBillingMatrix,
  filterAlfaTurmixRows,
  summarizeAlfaTurmixRows,
} from "../../domain/alfa-turmix-monitoring.ts";

const accounts = [
  { id: "UCM-TEST-1", name: "Cuenta sintética", group: "Grupo sintético", territory: "Norte", channel: "Retail Moderno", subchannel: "General" },
  { id: "UCM-TEST-2", name: "Cuenta sintética 2", group: "(Individual)", territory: "Centro", channel: "Especialistas", subchannel: "General" },
] as const;

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
  const rows = createAlfaTurmixRows(accounts, "2027-09-07");
  const accountCount = alfaTurmixCatalog(accounts).accounts.length;
  assert.ok(accountCount > 0);
  assert.equal(rows.length, 12 * accountCount * 6 * 2);
  assert.equal(new Set(rows.map((row) => row.period)).size, 12);
  assert.equal(new Set(rows.map((row) => row.family)).size, 6);
  assert.ok(rows.every((row) => row.category === "Electrodomésticos"));
  assert.ok(rows.every((row) => row.sourceClass === ALFA_TURMIX_DATASET));
  assert.ok(rows.filter((row) => row.period > "2027-09").every((row) => row.actualValue === null && row.lastYearValue === null));
  assert.ok(rows.filter((row) => row.period === "2027-09").every((row) => row.actualValue !== null && row.acceptedPlanToDateValue !== null));
  assert.equal(alfaTurmixAsOfDate(new Date("2026-09-08T12:00:00Z")), "2027-09-08");
});

test("ALFA Turmix filters and reconciles plan, actual and year-ago", () => {
  const rows = createAlfaTurmixRows(accounts, "2027-09-07");
  const filtered = filterAlfaTurmixRows(rows, { family: "Licuadoras", territory: "Centro" });
  assert.equal(filtered.length, 12 * 2 * new Set(rows.filter((row) => row.territory === "Centro").map((row) => row.account)).size);
  const summary = summarizeAlfaTurmixRows(filtered);
  assert.ok(summary.acceptedPlanValue > 0);
  assert.ok(summary.actualValue > 0);
  assert.equal(summary.vsBusinessPlanValue, summary.actualValue - summary.businessPlanValue);
  assert.equal(summary.vsLastYearValue, summary.actualValue - summary.lastYearValue);
});

test("the Billing matrix keeps the Excel reading pattern", () => {
  const matrix = createAlfaTurmixBillingMatrix(createAlfaTurmixRows(accounts, "2027-09-07"));
  assert.equal(matrix.length, 7);
  assert.equal(matrix[0].label, "Complementos de cocina");
  assert.equal(matrix.at(-1)?.label, "TOTAL ELECTRODOMÉSTICOS");
  assert.equal("FY" in matrix[0].rows[0].values, false);
  assert.equal("YTD" in matrix[0].rows[0].values, true);
  assert.deepEqual(matrix[0].rows.map((row) => row.metric), [
    "Plan aceptado", "Actuales (ERP)", "Cobertura", "Business Plan",
    "Cobertura Vs. BP ($)", "Cobertura Vs. BP (%)", "Real facturado año anterior",
    "Δ a año anterior ($)", "Δ a año anterior (%)",
  ]);
  assert.equal(matrix[0].rows[0].values["Q1"], matrix[0].rows[0].values["01"]! + matrix[0].rows[0].values["02"]! + matrix[0].rows[0].values["03"]!);
  assert.ok(matrix[0].rows[0].values["10"] !== null);
  assert.ok(matrix[0].rows[3].values["10"] !== null);
  assert.equal(matrix[0].rows[1].values["10"], null);
  assert.equal(matrix[0].rows[2].values["10"], null);
  assert.equal(matrix[0].rows[4].values["10"], null);
  assert.equal(matrix[0].rows[5].values["10"], null);
  assert.equal(matrix[0].rows[1].values["YTD"], matrix[0].rows[1].values["Q1"]! + matrix[0].rows[1].values["Q2"]! + matrix[0].rows[1].values["Q3"]!);
});
