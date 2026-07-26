import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("../../app/api/profitability/route.ts", import.meta.url);

test("rentabilidad exige unidades y valor reconciliados", async () => {
  const source = await readFile(routeUrl, "utf8");
  assert.match(source, /Consolida primero unidades y valor/);
  assert.match(source, /unitsReconciled/);
  assert.match(source, /valueReconciled/);
});

test("los parámetros son sintéticos, explícitos y no corporativos", async () => {
  const source = await readFile(routeUrl, "utf8");
  assert.match(source, /SYNTHETIC_PNL_PARAMETERS/);
  assert.match(source, /deductionRate: 0\.1/);
  assert.match(source, /cogsRateOnNetSales: 0\.55/);
  assert.match(source, /investmentRateOnIncrementalGross: 0\.08/);
  assert.match(source, /corporatePolicy: false/);
  assert.match(source, /no representan políticas corporativas/);
});

test("P&L declara comparador, reconcilia y persiste", async () => {
  const source = await readFile(routeUrl, "utf8");
  assert.match(source, /APPROVED_BASELINE_VALUE/);
  assert.match(source, /grossSales - deductions/);
  assert.match(source, /netSales - cogs/);
  assert.match(source, /grossMargin - investment/);
  assert.match(source, /planReconciled/);
  assert.match(source, /comparatorReconciled/);
  assert.match(source, /INSERT INTO financial_results/);
});
