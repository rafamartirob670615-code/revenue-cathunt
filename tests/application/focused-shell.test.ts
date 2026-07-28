import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Inicio es un lobby que lleva directamente a continuar, crear o explorar el piloto", async () => {
  const source = await readFile(new URL("../../app/page.tsx", import.meta.url), "utf8");
  const lobby = await readFile(new URL("../../app/RevenueLobby.tsx", import.meta.url), "utf8");
  assert.match(source, /type AppView = "lobby" \| "plan"/);
  assert.match(source, /onExit=\{\(\) => setView\("lobby"\)\}/);
  assert.doesNotMatch(source, />Monitoreo<\/button>/);
  assert.match(lobby, /Continuar un Plan/);
  assert.match(lobby, /Crear un Plan real/);
  assert.match(lobby, /Explorar el Plan piloto/);
  assert.match(lobby, /DATOS SINTÉTICOS — NO COMERCIALES/);
  assert.match(lobby, /method: "PUT"/);
  assert.match(lobby, /method: "PATCH"/);
  assert.match(lobby, /inputState\.accepted === true/);
  assert.match(lobby, /inputState\.files\?\.every/);
  assert.match(lobby, /openSynthetic\(planId\)/);
  assert.doesNotMatch(source, /Mercado Central|\$131\.4 M|Sistema confiable|Confianza del dato/);
  assert.doesNotMatch(lobby, /Mercado Central|\$131\.4 M|Sistema confiable|Confianza del dato/);
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
