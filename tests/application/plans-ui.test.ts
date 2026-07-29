import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL("../../app/PlansWorkspace.tsx", import.meta.url);

test("Crear Plan real comienza vacío y permite volver al lobby", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /Siguiente: cargar lo que ya tengas/);
  assert.match(source, /Guardar y continuar/);
  assert.match(source, /Volver al lobby/);
  assert.match(source, /lines:\s*\[\]/);
});

test("el recorrido vacío no presenta cifras demostrativas como resultados", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.doesNotMatch(source, /\$75\.4 M|1\.79 M|31\.4%|Mercado Central/);
  assert.match(source, /cargar los datasets necesarios|cargar lo que ya tengas/);
});

test("la información del Plan conserva requisitos y mantiene bloqueado el baseline", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /Cargar mi Excel de ventas/);
  assert.match(source, /essentialReady.*4 grupos básicos reconocidos/s);
  assert.match(source, /No recibido/);
  assert.match(source, /no completa este paquete/);
  assert.match(source, />Baseline<\/button>/);
  assert.match(source, /Seleccionar Excel o CSV/);
  assert.match(source, /"sales-quota"/);
  assert.match(source, /"actual-sales"/);
  assert.match(source, /Información del Plan/);
  assert.match(source, /Hoja elegida/);
  assert.match(source, /Vista del dataset canónico/);
  assert.match(source, /received\.issues/);
  assert.match(source, /correspondencias pendientes/);
  assert.match(source, /Descargar plantilla/);
  assert.match(source, /requiredFields\.join/);
  assert.match(source, /Confirmar paquete listo/);
  assert.match(source, /Iniciar prueba guiada/);
  assert.match(source, /Volumen base anual propuesto/);
  assert.match(source, /Aceptar volumen base y continuar/);
  assert.match(source, /¿Qué venderíamos sin volver a contar las actividades\?/);
  assert.match(source, /Base desimpactada/);
  assert.match(source, /Trade Marketing/);
  assert.match(source, /Continuar al resultado/);
  assert.match(source, /Resumen integral del Plan/);
  assert.match(source, /Este es tu Plan anual/);
  assert.match(source, /Base aprobada/);
  assert.match(source, /Revenue del Plan/);
});

test("la revisión del baseline cubre periodos, SKU, ajuste documentado y congelamiento", async () => {
  const source = await readFile(componentUrl, "utf8");
  for (const label of ["Año", "Trimestre", "Mes", "SKU"]) {
    assert.match(source, new RegExp(`\"${label}\"`));
  }
  assert.match(source, /Proponer ajuste/);
  assert.match(source, /Motivo del ajuste/);
  assert.match(source, /Evidencia/);
  assert.match(source, /Aprobar ajuste/);
  assert.match(source, /Aceptar cálculo y congelar/);
  assert.match(source, /No puede convertirse en Plan oficial/);
  assert.match(source, /decidedBy/);
  assert.match(source, /methodVersion/);
});

test("crecimiento conecta Marketing, Trade Marketing e incremental neto", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /Crecimiento gobernado/);
  assert.match(source, /Marketing y Trade Marketing sin doble conteo/);
  assert.match(source, /Incremental bruto/);
  assert.match(source, /Incremental neto/);
  assert.match(source, /canibalización/);
  assert.match(source, /compra anticipada/);
  assert.match(source, /Solapamientos pendientes/);
  assert.match(source, /Construir crecimiento sintético/);
  assert.match(source, /Construir crecimiento real/);
  assert.match(source, /PLANES EMPRESARIALES — TRAZABLES/);
});

test("resultado muestra unidades y valor mensual con evidencia de precio y conversión", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /Plan mensual reconciliado por SKU/);
  assert.match(source, /Base aprobada \+ incremental neto = unidades del Plan/);
  assert.match(source, /Calcular unidades y valor/);
  assert.match(source, /Unidades anuales/);
  assert.match(source, /Valor anual/);
  assert.match(source, /Conversiones faltantes/);
  assert.match(source, /Precios faltantes/);
  assert.match(source, /precio aceptado/);
  assert.match(source, /DATOS SINTÉTICOS — NO COMERCIALES/);
});

test("rentabilidad distingue condiciones reales de parámetros sintéticos", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /Rentabilidad · comparador declarado/);
  assert.match(source, /valor del baseline aprobado/);
  assert.match(source, /CONDICIONES COMERCIALES Y COSTOS — TRAZABLES/);
  assert.match(source, /PARÁMETROS SINTÉTICOS — NO SON CONDICIONES COMERCIALES/);
  assert.match(source, /Calcular rentabilidad real/);
  assert.match(source, /Gross sales/);
  assert.match(source, /Net sales/);
  assert.match(source, /Gross margin/);
  assert.match(source, /Contribution/);
  assert.match(source, /Calcular rentabilidad/);
});

test("el Plan completo tiene una vista de versión y presentación", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /Versión final/);
  assert.match(source, /Vista para defender el Plan/);
  assert.match(source, /Revenue del Plan/);
  assert.match(source, /Historia del Plan/);
  assert.match(source, /Baseline aprobado/);
  assert.match(source, /Oficialización bloqueada por ser sintético/);
});

test("baseline permite ajustar cada combinación mensual y persiste evidencia", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /baseline-line-editor/);
  assert.match(source, /Base ajustada/);
  assert.match(source, /adjustments:/);
});

test("crecimiento permite editar y guardar building blocks reconciliados", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /Editar building blocks/);
  assert.match(source, /Guardar crecimiento/);
  assert.match(source, /method:"PUT"/);
});

test("resultado permite edición tabular documentada", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /Editar tabla/);
  assert.match(source, /Ajuste autorizado/);
  assert.match(source, /Guardar resultado/);
});
