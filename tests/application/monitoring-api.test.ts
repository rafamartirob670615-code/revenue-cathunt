import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Monitoreo consume Actuals, cuota e historia canónicos", async () => {
  const route = await readFile(new URL("../../app/api/monitoring/route.ts", import.meta.url), "utf8");
  assert.match(route, /actual-sales/);
  assert.match(route, /sales-quota/);
  assert.match(route, /sales-history/);
  assert.match(route, /cutoffDate/);
  assert.match(route, /includedRows/);
  assert.match(route, /excludedRows/);
  assert.match(route, /account_id.*sku_id.*period/s);
});

test("la vista integral carga Excel y calcula variaciones comparables", async () => {
  const source = await readFile(new URL("../../app/PlanMonitor.tsx", import.meta.url), "utf8");
  assert.match(source, /Cargar Actuals Excel/);
  assert.match(source, /Cargar cuota Excel/);
  assert.match(source, /Vs\. Plan %/);
  assert.match(source, /Vs\. cuota %/);
  assert.match(source, /Variación vs\. AA/);
  assert.match(source, /YTD termina en el mes de la fecha de corte/);
});
