import assert from "node:assert/strict";
import test from "node:test";
import {
  canAcceptInputPackage,
  canCalculateBaseline,
  createEmptyInputPackage,
  PILOT_INPUT_REQUIREMENTS,
  validateCsvContent,
  validateCsvHeaders,
  validatePackageCorrespondence,
} from "../../domain/input-package.ts";

test("el paquete nuevo inicia sin insumos recibidos y no habilita baseline", () => {
  const inputPackage = createEmptyInputPackage("plan:pilot");
  assert.equal(inputPackage.items.length, PILOT_INPUT_REQUIREMENTS.length);
  assert.ok(inputPackage.items.every((item) => item.status === "NOT_RECEIVED"));
  assert.equal(canCalculateBaseline(inputPackage), false);
});

test("la aceptación exige cuatro esenciales listos y cero correspondencias pendientes", () => {
  const summaries = PILOT_INPUT_REQUIREMENTS
    .filter((requirement) => requirement.criticality === "ESSENTIAL")
    .map((requirement) => ({
      requirementId: requirement.id,
      status: "READY",
      summary: { rowCount: 1, accountIds: [], skuIds: [], periods: [] },
    }));
  assert.equal(canAcceptInputPackage(summaries, []), true);
  assert.equal(canAcceptInputPackage(summaries.slice(1), []), false);
  assert.equal(
    canAcceptInputPackage(summaries, [{ code: "MISMATCH", message: "Pendiente" }]),
    false,
  );
});

test("la historia válida supera contenido, cobertura y duplicados", () => {
  const rows = Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return `ACC-1,SKU-1,2025-${month},10,100,MXN`;
  });
  const result = validateCsvContent(
    "sales-history",
    ["account_id,sku_id,period,units,value,currency", ...rows].join("\n"),
  );
  assert.equal(result.status, "READY");
  assert.equal(result.summary.rowCount, 12);
});

test("la validación explica errores de contenido y correspondencia", () => {
  const invalid = validateCsvContent(
    "sales-history",
    [
      "account_id,sku_id,period,units,value,currency",
      "ACC-1,SKU-1,2025-13,-2,100,PESOS",
      "ACC-1,SKU-1,2025-13,-2,100,PESOS",
    ].join("\n"),
  );
  assert.equal(invalid.status, "INCOMPLETE");
  assert.ok(invalid.issues.some((issue) => issue.code === "INVALID_NUMBERS"));
  assert.ok(invalid.issues.some((issue) => issue.code === "INVALID_CURRENCY"));
  assert.ok(invalid.issues.some((issue) => issue.code === "INVALID_PERIOD"));
  assert.ok(invalid.issues.some((issue) => issue.code === "DUPLICATE_GRAIN"));

  const packageIssues = validatePackageCorrespondence([
    {
      requirementId: "sales-history",
      status: "READY",
      summary: { rowCount: 12, accountIds: ["ACC-1"], skuIds: ["SKU-1"], periods: ["2025-01"] },
    },
    {
      requirementId: "unit-conversions",
      status: "READY",
      summary: { rowCount: 1, accountIds: [], skuIds: ["SKU-2"], periods: [] },
    },
  ]);
  assert.match(packageIssues[0].message, /SKU-1/);
});

test("la recepción distingue estructura completa de columnas faltantes", () => {
  const complete = validateCsvHeaders("sales-history", [
    "account_id", "sku_id", "period", "units", "value", "currency",
  ]);
  assert.equal(complete.status, "READY");
  assert.deepEqual(complete.missingFields, []);

  const incomplete = validateCsvHeaders("sales-history", [
    "account_id", "sku_id", "period", "units",
  ]);
  assert.equal(incomplete.status, "INCOMPLETE");
  assert.deepEqual(incomplete.missingFields, ["value", "currency"]);
});

test("sólo los requisitos esenciales completos habilitan el cálculo", () => {
  const inputPackage = createEmptyInputPackage("plan:pilot");
  for (const item of inputPackage.items) {
    const requirement = PILOT_INPUT_REQUIREMENTS.find(
      (candidate) => candidate.id === item.requirementId,
    );
    if (requirement?.criticality === "ESSENTIAL") item.status = "READY";
  }
  assert.equal(canCalculateBaseline(inputPackage), true);
});
