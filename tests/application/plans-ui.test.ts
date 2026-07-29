import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const platformUrl = new URL("../../app/revenue/RevenuePlatform.tsx", import.meta.url);
const modulesUrl = new URL("../../app/revenue/PlanModules.tsx", import.meta.url);
const registryUrl = new URL("../../app/revenue/modules.ts", import.meta.url);

test("Crear Plan real comienza vacío y entra a Información", async () => {
  const source = await readFile(platformUrl, "utf8");
  assert.match(source, /Registra el contexto una sola vez/);
  assert.match(source, /Guardar y continuar/);
  assert.match(source, /lines: \[\]/);
  assert.match(source, /setActive\("informacion"\)/);
});

test("el recorrido vacío no presenta cifras demostrativas como resultados", async () => {
  const source = await readFile(platformUrl, "utf8");
  assert.doesNotMatch(source, /\$75\.4 M|1\.79 M|31\.4%|Mercado Central/);
  assert.match(source, /No hay una cuenta activa/);
});

test("la información comienza con un Excel y revela lo demás después", async () => {
  const source = await readFile(modulesUrl, "utf8");
  assert.match(source, /criticality === "ESSENTIAL"/);
  assert.doesNotMatch(source, /requirement\.essential/);
  assert.match(source, /salesReceived \? essential/);
  assert.match(source, /Seleccionar archivo/);
  assert.match(source, /Fuentes complementarias/);
  assert.match(source, /conserva el original/);
  assert.match(source, /Confirmar información/);
  assert.match(source, /Usar prueba guiada/);
});

test("el volumen base abre con una respuesta y mantiene detalle progresivo", async () => {
  const source = await readFile(modulesUrl, "utf8");
  assert.match(source, /Volumen base anual/);
  assert.match(source, /Resultado mensual por producto/);
  assert.match(source, /Aprobar y congelar Volumen base/);
  assert.match(source, /Falta calcular esta respuesta/);
});

test("Marketing y Trade Marketing viven en pantallas independientes", async () => {
  const source = await readFile(modulesUrl, "utf8");
  const platform = await readFile(platformUrl, "utf8");
  assert.match(source, /Incremental bruto/);
  assert.match(source, /Incremental neto/);
  assert.match(source, /GrowthPlanModule/);
  assert.match(platform, /family="MARKETING"/);
  assert.match(platform, /family="TRADE_MARKETING"/);
  assert.match(platform, /active === "plan-marketing"/);
  assert.match(platform, /active === "plan-trade"/);
  assert.match(platform, /growthCanBuild/);
  assert.match(source, /Reconciliar Marketing y Trade/);
});

test("las acciones no fallan después del clic cuando faltan dependencias", async () => {
  const source = await readFile(modulesUrl, "utf8");
  const platform = await readFile(platformUrl, "utf8");
  assert.match(source, /action=\{ready \? <button className="clay-primary"/);
  assert.match(source, /action=\{source && canBuild \? <button className="clay-primary"/);
  assert.match(platform, /if \(accepted\) setActive\("volumen-base"\)/);
});

test("Plan anual muestra unidades, valor y reconciliación", async () => {
  const source = await readFile(modulesUrl, "utf8");
  assert.match(source, /Unidades del Plan/);
  assert.match(source, /Revenue del Plan/);
  assert.match(source, /Volumen base/);
  assert.match(source, /Detalle mensual por producto/);
  assert.match(source, /Consolidar Plan anual/);
});

test("rentabilidad separa el estado de resultados", async () => {
  const source = await readFile(modulesUrl, "utf8");
  for (const label of ["Gross sales", "Condiciones comerciales", "Net sales", "Costo", "Margen bruto", "Inversión", "Contribución"]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /Calcular Rentabilidad/);
});

test("Revisión concentra validaciones y bloquea el caso sintético", async () => {
  const source = await readFile(modulesUrl, "utf8");
  assert.match(source, /Prueba no comercial/);
  assert.match(source, /Congelar y enviar/);
  assert.match(source, /Información y base/);
});

test("la nueva maquinaria usa un registro único de módulos", async () => {
  const source = await readFile(registryUrl, "utf8");
  for (const module of ["inicio", "contexto", "informacion", "volumen-base", "plan-marketing", "plan-trade", "plan-anual", "rentabilidad", "revision", "monitoreo", "administracion"]) {
    assert.match(source, new RegExp(`\"${module}\"`));
  }
});

test("cada cálculo permanece conectado a su API existente", async () => {
  const source = await readFile(platformUrl, "utf8");
  for (const route of ["/api/inputs", "/api/baseline", "/api/growth", "/api/result", "/api/profitability", "/api/plans"]) {
    assert.match(source, new RegExp(route));
  }
});

test("la app conserva edición y gobierno en sus motores", async () => {
  const baseline = await readFile(new URL("../../app/api/baseline/route.ts", import.meta.url), "utf8");
  const growth = await readFile(new URL("../../app/api/growth/route.ts", import.meta.url), "utf8");
  const result = await readFile(new URL("../../app/api/result/route.ts", import.meta.url), "utf8");
  assert.match(baseline, /export async function PUT/);
  assert.match(growth, /export async function PUT/);
  assert.match(result, /export async function PUT/);
});
