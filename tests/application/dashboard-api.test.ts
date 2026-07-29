import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("el dashboard usa identidad y estado persistido, no cifras demostrativas", async () => {
  const source = await readFile(new URL("../../app/api/dashboard/route.ts", import.meta.url), "utf8");
  assert.match(source, /oai-authenticated-user-email/);
  assert.match(source, /plan_aggregates/);
  assert.match(source, /input_package_files/);
  assert.match(source, /input_package_reviews/);
  assert.match(source, /deriveStage/);
  assert.match(source, /ORDER BY pa\.updated_at DESC/);
  assert.doesNotMatch(source, /Mercado Central|\$131\.4 M|98\.4%|Nova Consumer/);
});

test("cada etapa del dashboard conduce a una acción comercial", async () => {
  const source = await readFile(new URL("../../app/api/dashboard/route.ts", import.meta.url), "utf8");
  for (const action of [
    "Preparar información",
    "Completar información",
    "Confirmar información",
    "Calcular Volumen base",
    "Continuar construcción",
    "Preparar Marketing y Trade",
    "Consolidar unidades y valor",
    "Revisar rentabilidad",
    "Preparar versión",
    "Revisar aprobación",
    "Abrir Plan oficial",
  ]) {
    assert.match(source, new RegExp(action));
  }
});
