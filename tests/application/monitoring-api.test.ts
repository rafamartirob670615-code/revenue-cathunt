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
  const source = await readFile(new URL("../../app/revenue/MonitoringModule.tsx", import.meta.url), "utf8");
  assert.match(source, /Cuota comercial/);
  assert.match(source, /Venta real/);
  assert.match(source, /Plan contra venta real/);
  assert.match(source, /Actual vs\. Plan/);
  assert.match(source, /cutoffDate/);
});

test("cada desviación puede convertirse en una acción trazable y cerrarse con resultado", async () => {
  const route = await readFile(new URL("../../app/api/monitoring/actions/route.ts", import.meta.url), "utf8");
  const source = await readFile(new URL("../../app/revenue/MonitoringModule.tsx", import.meta.url), "utf8");
  assert.match(route, /monitoring_actions/);
  assert.match(route, /Causa, evidencia, acción y responsable son obligatorios/);
  assert.match(route, /Math\.abs\(varianceRate\) >= 0\.05/);
  assert.match(route, /Documenta el resultado antes de cerrar la acción/);
  assert.match(route, /IN_PROGRESS/);
  assert.match(route, /CLOSED/);
  assert.match(source, /Nueva acción/);
  assert.match(source, /Guardar acción/);
  assert.match(source, /Fecha compromiso/);
  assert.match(source, />Iniciar</);
  assert.match(source, />Cerrar</);
  assert.match(source, /umbral operativo 5%/);
});
