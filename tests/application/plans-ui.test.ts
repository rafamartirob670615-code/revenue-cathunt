import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL("../../app/PlansWorkspace.tsx", import.meta.url);

test("Crear Plan comienza vacío y permite volver a Mis Planes", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /El Plan se creará vacío/);
  assert.match(source, /Crear y guardar Plan/);
  assert.match(source, /Salir a Mis Planes/);
  assert.match(source, /Continúa un Plan/);
  assert.match(source, /lines:\s*\[\]/);
});

test("el recorrido vacío no presenta cifras demostrativas como resultados", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.doesNotMatch(source, /\$75\.4 M|1\.79 M|31\.4%|Mercado Central/);
  assert.match(source, /No habrá ventas, objetivos, baseline, iniciativas ni rentabilidad precargados/);
});

test("el checklist muestra requisitos pendientes y conserva bloqueado el baseline", async () => {
  const source = await readFile(componentUrl, "utf8");
  assert.match(source, /Abrir checklist/);
  assert.match(source, /essentialReady.*4 esenciales listos/s);
  assert.match(source, /No recibido/);
  assert.match(source, /no completa este paquete/);
  assert.match(source, /disabled=\{!packageAccepted\}/);
  assert.match(source, />Baseline<\/button>/);
  assert.match(source, /Seleccionar CSV/);
  assert.match(source, /received\.issues/);
  assert.match(source, /correspondencias pendientes/);
  assert.match(source, /Descargar plantilla/);
  assert.match(source, /requiredFields\.join/);
  assert.match(source, /Confirmar paquete listo/);
  assert.match(source, /¿Qué venderíamos sin volver a contar las actividades\?/);
  assert.match(source, /Base desimpactada/);
  assert.match(source, /Trade Marketing/);
  assert.match(source, /Vista seleccionada/);
  assert.match(source, /contra \{comparison\}/);
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
