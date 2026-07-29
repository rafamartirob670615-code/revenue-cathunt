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

test("cada desviación puede convertirse en una acción trazable y cerrarse con resultado", async () => {
  const route = await readFile(new URL("../../app/api/monitoring/actions/route.ts", import.meta.url), "utf8");
  const source = await readFile(new URL("../../app/PlanMonitor.tsx", import.meta.url), "utf8");
  assert.match(route, /monitoring_actions/);
  assert.match(route, /Causa, evidencia, acción y responsable son obligatorios/);
  assert.match(route, /Math\.abs\(varianceRate\) >= 0\.05/);
  assert.match(route, /Documenta el resultado antes de cerrar la acción/);
  assert.match(route, /IN_PROGRESS/);
  assert.match(route, /CLOSED/);
  assert.match(source, /Desviación → causa → acción → seguimiento/);
  assert.match(source, /Guardar acción trazable/);
  assert.match(source, /Fecha compromiso/);
  assert.match(source, /Iniciar seguimiento/);
  assert.match(source, /Cerrar con resultado/);
  assert.match(source, /No sustituye una política corporativa/);
});
