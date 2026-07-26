import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("../../app/api/baseline/route.ts", import.meta.url);

test("la API exige motivo y evidencia para ajustar y conserva la decisión", async () => {
  const source = await readFile(routeUrl, "utf8");
  assert.match(source, /El motivo del ajuste es obligatorio/);
  assert.match(source, /La evidencia del ajuste es obligatoria/);
  assert.match(source, /ADJUSTMENT_PROPOSED/);
  assert.match(source, /APPROVED_FROZEN/);
  assert.match(source, /calculation_calculated_at/);
  assert.match(source, /decided_by/);
  assert.match(source, /frozen_at/);
});

test("la oficialización sintética está bloqueada en la API de Planes", async () => {
  const source = await readFile(new URL("../../app/api/plans/route.ts", import.meta.url), "utf8");
  assert.match(source, /SYNTHETIC_NON_COMMERCIAL/);
  assert.match(source, /no pueden convertirse en oficiales/);
});

test("reemplazar un archivo invalida cálculo y revisión", async () => {
  const source = await readFile(new URL("../../app/api/inputs/route.ts", import.meta.url), "utf8");
  const reviewDelete = source.indexOf("DELETE FROM baseline_reviews");
  const calculationDelete = source.indexOf("DELETE FROM baseline_calculations");
  assert.ok(reviewDelete >= 0);
  assert.ok(calculationDelete > reviewDelete);
});
