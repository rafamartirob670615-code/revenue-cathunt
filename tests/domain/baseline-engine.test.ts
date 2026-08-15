import assert from "node:assert/strict";
import test from "node:test";
import { calculateBaselineFromAcceptedPackage } from "../../domain/baseline-engine.ts";
import { createSyntheticPilotPackage } from "../fixtures/synthetic-pilot.ts";

test("el paquete sintético produce un baseline mensual reproducible y marcado", () => {
  const files = createSyntheticPilotPackage(2027, "cuenta-prueba");
  const sales = files.find((file) => file.requirementId === "sales-history")!;
  const activities = files.find((file) => file.requirementId === "activity-history")!;
  const first = calculateBaselineFromAcceptedPackage({
    salesCsv: sales.content,
    activitiesCsv: activities.content,
    targetYear: 2027,
    synthetic: true,
  });
  const second = calculateBaselineFromAcceptedPackage({
    salesCsv: sales.content,
    activitiesCsv: activities.content,
    targetYear: 2027,
    synthetic: true,
  });

  assert.deepEqual(first, second);
  assert.equal(first.dataClassification, "SYNTHETIC_NON_COMMERCIAL");
  assert.equal(first.historyPeriods, 24);
  assert.equal(first.lines.length, 36);
  assert.ok(first.annualUnits > 0);
  assert.ok(first.lines.every((line) => line.period.startsWith("2027-")));
});

test("el motor retira el impacto identificado antes del promedio estacional", () => {
  const result = calculateBaselineFromAcceptedPackage({
    salesCsv: [
      "account_id,sku_id,period,units,value,currency",
      "A,S,2025-01,100,1000,MXN",
      "A,S,2026-01,140,1400,MXN",
    ].join("\n"),
    activitiesCsv: [
      "activity_id,activity_type,account_id,sku_id,start_period,end_period,impact_units",
      "P1,PROMO,A,S,2026-01,2026-01,40",
    ].join("\n"),
    targetYear: 2027,
    synthetic: true,
  });
  assert.equal(result.lines[0].calculatedUnits, 100);
});
