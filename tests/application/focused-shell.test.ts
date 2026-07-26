import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Inicio es un dashboard conectado a Planes reales y separa Construcción de Monitoreo", async () => {
  const source = await readFile(new URL("../../app/page.tsx", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../../app/RevenueDashboard.tsx", import.meta.url), "utf8");
  assert.match(source, /RevenueDashboard/);
  assert.match(source, />Inicio<\/button>/);
  assert.match(source, />Construcción<\/button>/);
  assert.match(source, />Monitoreo<\/button>/);
  assert.match(source, /Monitoreo del Plan/);
  assert.match(source, /Sin resultados sustitutos/);
  assert.match(dashboard, /fetch\("\/api\/dashboard"/);
  assert.match(dashboard, /Lo que necesita tu decisión/);
  assert.match(dashboard, /Situación y siguiente acción/);
  assert.match(dashboard, /Paquetes aceptados/);
  assert.match(dashboard, /Monitoreo del Plan/);
  assert.match(dashboard, /visiblePlans/);
  assert.doesNotMatch(source, /Mercado Central|\$131\.4 M|Sistema confiable|Confianza del dato/);
  assert.doesNotMatch(dashboard, /Mercado Central|\$131\.4 M|Sistema confiable|Confianza del dato/);
});

test("el baseline explica evidencia, estados y gobierno sin inventar resultados", async () => {
  const source = await readFile(new URL("../../app/PlansWorkspace.tsx", import.meta.url), "utf8");
  assert.match(source, /¿Qué venderíamos sin volver a contar las actividades\?/);
  assert.match(source, /Historia observada/);
  assert.match(source, /Base calculada/);
  assert.match(source, /Base ajustada/);
  assert.match(source, /Base aprobada/);
  assert.match(source, /Aún no seleccionado/);
  assert.match(source, /Todavía no existe un cálculo/);
  assert.match(source, /salesEvidence\?\.summary\.rowCount/);
});
