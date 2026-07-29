import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("../../app/api/result/route.ts", import.meta.url);

test("unidades y valor exigen baseline congelado y crecimiento reconciliado", async () => {
  const source = await readFile(routeUrl, "utf8");
  assert.match(source, /APPROVED_FROZEN/);
  assert.match(source, /growth\.controls\.reconciled/);
  assert.match(source, /Completa primero baseline y crecimiento/);
});

test("el resultado usa conversiones y precios aceptados del paquete", async () => {
  const source = await readFile(routeUrl, "utf8");
  assert.match(source, /unit-conversions/);
  assert.match(source, /prices-currency/);
  assert.match(source, /conversion_factor/);
  assert.match(source, /valid_from/);
  assert.match(source, /price_type/);
  assert.match(source, /row\.account_id === line\.accountId/);
  assert.match(source, /row\.valid_from\.slice\(0, 7\) <= line\.period/);
  assert.match(source, /planUnits \* unitPrice/);
});

test("el resultado reconcilia unidades, valor y persiste por Plan", async () => {
  const source = await readFile(routeUrl, "utf8");
  assert.match(source, /baselineUnits \+ incrementalNetUnits/);
  assert.match(source, /unitsReconciled/);
  assert.match(source, /valueReconciled/);
  assert.match(source, /INSERT INTO plan_results/);
  assert.match(source, /source\.data_classification/);
  assert.match(source, /growthFullyApplied/);
});
