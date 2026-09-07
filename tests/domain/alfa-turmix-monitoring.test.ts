import test from "node:test";
import assert from "node:assert/strict";
import {
  createAlfaTurmixBillingMatrix,
  filterAlfaTurmixRows,
  summarizeAlfaTurmixRows,
  type AlfaBillingRow,
} from "../../domain/alfa-turmix-monitoring.ts";

function billingRow(period: string, overrides: Partial<AlfaBillingRow> = {}): AlfaBillingRow {
  const month = Number(period.slice(-2));
  const actual = month <= 9 ? 95 : null;
  return {
    scenarioId: "ALFA_TURMIX_SYNTHETIC_2027",
    period,
    asOfDate: "2027-09-07",
    accountId: "UCM-TEST-1",
    territory: "Norte",
    account: "Cuenta sintética",
    accountGroup: "Grupo sintético",
    channel: "Retail Moderno",
    subchannel: "General",
    category: "Electrodomésticos",
    family: "Complementos de cocina",
    familySort: 10,
    product: "Producto sintético",
    productSort: 10,
    currency: "MXN",
    acceptedPlanUnits: 100,
    acceptedPlanValue: 100,
    acceptedPlanToDateUnits: actual === null ? null : 100,
    acceptedPlanToDateValue: actual === null ? null : 100,
    businessPlanUnits: 105,
    businessPlanValue: 105,
    businessPlanToDateUnits: actual === null ? null : 105,
    businessPlanToDateValue: actual === null ? null : 105,
    actualUnits: actual,
    actualValue: actual,
    lastYearUnits: actual === null ? null : 90,
    lastYearValue: actual === null ? null : 90,
    sourceClass: "SYNTHETIC_NON_COMMERCIAL",
    companyName: "ALFA Turmix",
    datasetLabel: "ALFA Turmix · Datos sintéticos no comerciales",
    erpStatus: "SIMULATED_OFFICIAL_FEED",
    ...overrides,
  };
}

test("filters and summaries consume canonical Billing rows without changing their meaning", () => {
  const rows = [
    billingRow("2027-01"),
    billingRow("2027-02", { territory: "Centro", account: "Otra cuenta" }),
    billingRow("2027-10"),
  ];
  const filtered = filterAlfaTurmixRows(rows, { territory: "Norte" });
  assert.equal(filtered.length, 2);
  const summary = summarizeAlfaTurmixRows(filtered);
  assert.equal(summary.acceptedPlanValue, 100);
  assert.equal(summary.actualValue, 95);
  assert.equal(summary.lastYearValue, 90);
  assert.equal(summary.vsBusinessPlanValue, -10);
  assert.equal(summary.vsLastYearValue, 5);
});

test("the Billing matrix retains annual plan and hides only future Actuals", () => {
  const rows = [
    billingRow("2027-01"), billingRow("2027-02"), billingRow("2027-03"), billingRow("2027-10"),
    billingRow("2027-01", { family: "Café y Bebidas", familySort: 20, product: "Segundo producto", productSort: 20 }),
  ];
  const matrix = createAlfaTurmixBillingMatrix(rows);
  assert.deepEqual(matrix.map((block) => block.label), ["Complementos de cocina", "Café y Bebidas", "TOTAL ELECTRODOMÉSTICOS"]);
  const firstBlock = matrix[0];
  assert.deepEqual(firstBlock.rows.map((row) => row.metric), [
    "Plan aceptado", "Actuales (ERP)", "Cobertura", "Business Plan",
    "Cobertura Vs. BP ($)", "Cobertura Vs. BP (%)", "Real facturado año anterior",
    "Δ a año anterior ($)", "Δ a año anterior (%)",
  ]);
  assert.equal(firstBlock.rows[0].values.Q1, 300);
  assert.equal(firstBlock.rows[0].values["10"], 100);
  assert.equal(firstBlock.rows[1].values["10"], null);
  assert.equal(firstBlock.rows[2].values["10"], null);
  assert.equal(firstBlock.rows[0].values.YTD, 400);
  assert.equal(firstBlock.rows[1].values.YTD, 285);
});
