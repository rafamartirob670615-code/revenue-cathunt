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
  assert.match(source, /Seleccionar Excel de ventas/);
  assert.match(source, /Ver información que se solicitará después/);
  assert.match(source, /Hoja elegida/);
  assert.match(source, /Confirmar información/);
  assert.match(source, /Iniciar prueba guiada/);
});

test("el volumen base abre con una respuesta y mantiene detalle progresivo", async () => {
  const source = await readFile(modulesUrl, "utf8");
  assert.match(source, /Volumen base anual propuesto/);
  assert.match(source, /Ver resultado mensual por producto/);
  assert.match(source, /Aceptar volumen base/);
  assert.match(source, /Todavía no existe una base calculada/);
});

test("crecimiento conecta Marketing, Trade Marketing e incremental neto", async () => {
  const source = await readFile(modulesUrl, "utf8");
  assert.match(source, /Incremental bruto/);
  assert.match(source, /Incremental neto/);
  assert.match(source, /Marketing/);
  assert.match(source, /Trade Marketing/);
  assert.match(source, /Construir crecimiento/);
});

test("Plan anual muestra unidades, valor y reconciliación", async () => {
  const source = await readFile(modulesUrl, "utf8");
  assert.match(source, /Unidades del Plan/);
  assert.match(source, /Revenue del Plan/);
  assert.match(source, /Base aprobada/);
  assert.match(source, /Ver detalle mensual por producto/);
  assert.match(source, /Calcular Plan anual/);
});

test("rentabilidad separa el estado de resultados", async () => {
  const source = await readFile(modulesUrl, "utf8");
  for (const label of ["Gross sales", "Deducciones", "Net sales", "COGS", "Gross margin", "Inversión", "Contribution"]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /Calcular rentabilidad/);
});

test("Revisión concentra validaciones y bloquea el caso sintético", async () => {
  const source = await readFile(modulesUrl, "utf8");
  assert.match(source, /Oficialización bloqueada por ser sintético/);
  assert.match(source, /Congelar y enviar a revisión/);
  assert.match(source, /Volumen base aprobado/);
});

test("la nueva maquinaria usa un registro único de módulos", async () => {
  const source = await readFile(registryUrl, "utf8");
  for (const module of ["inicio", "informacion", "volumen-base", "crecimiento", "plan-anual", "rentabilidad", "revision", "monitoreo", "administracion"]) {
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
