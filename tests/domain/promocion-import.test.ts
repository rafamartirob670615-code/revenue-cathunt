import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  activitiesCsvFromPromocionExport,
  type PromocionActivityExport,
} from "../../domain/promocion-import.ts";
import { calculateBaselineFromAcceptedPackage } from "../../domain/baseline-engine.ts";

function loadFixture(): PromocionActivityExport {
  const path = fileURLToPath(
    new URL("../fixtures/promocion-activity-export-synthetic.json", import.meta.url),
  );
  return JSON.parse(readFileSync(path, "utf8"));
}

test("rechaza un export con contract_version distinto de activity_export_v1", () => {
  assert.throws(
    () =>
      activitiesCsvFromPromocionExport({
        contract_version: "otra_version",
        activities: [],
      }),
    /activity_export_v1/,
  );
});

test("convierte el export de PROMOCIÓN V3 al CSV de actividades que espera el motor de baseline", () => {
  const csv = activitiesCsvFromPromocionExport(loadFixture());
  const lines = csv.split("\n");
  assert.equal(lines[0], "activity_id,activity_type,account_id,sku_id,start_period,end_period,impact_units");
  assert.equal(lines.length, 3); // encabezado + 2 actividades (1 sku cada una)
  assert.match(lines[1], /^EV-2026-014,FAP,cuenta-prueba,S,2026-01,2026-01,40$/);
  assert.match(lines[2], /^EV-2026-021,FAM,cuenta-prueba,S,2026-06,2026-06,25$/);
});

test("exige unidades explícitas: una actividad sin impact_units/units revienta con error claro, no con un número inventado", () => {
  const payload: PromocionActivityExport = {
    contract_version: "activity_export_v1",
    activities: [
      {
        activity_id: "EV-SIN-UNIDADES",
        account_id: "cuenta-prueba",
        sku_ids: ["S"],
        month: "2026-03",
        planned_investment: 10000,
        planned_result: 20000,
      },
    ],
  };
  assert.throws(() => activitiesCsvFromPromocionExport(payload), /no trae unidades/);
});

test("ignora actividades sin account_id en vez de fallar toda la conversión", () => {
  const payload: PromocionActivityExport = {
    contract_version: "activity_export_v1",
    activities: [
      { activity_id: "EV-SIN-CUENTA", account_id: null, month: "2026-02", impact_units: 10 },
    ],
  };
  const csv = activitiesCsvFromPromocionExport(payload);
  assert.equal(csv.split("\n").length, 1); // solo el encabezado
});

test("integración de punta a punta: el export sintético de PROMOCIÓN V3 desimpacta la base de REVENUE", () => {
  const activitiesCsv = activitiesCsvFromPromocionExport(loadFixture());

  const salesCsv = [
    "account_id,sku_id,period,units,value,currency",
    "cuenta-prueba,S,2025-01,100,1000,MXN",
    "cuenta-prueba,S,2026-01,140,1400,MXN", // +40 unidades por el evento EV-2026-014 (enero)
    "cuenta-prueba,S,2025-06,100,1000,MXN",
    "cuenta-prueba,S,2026-06,125,1250,MXN", // +25 unidades por el evento EV-2026-021 (junio)
  ].join("\n");

  const baseline = calculateBaselineFromAcceptedPackage({
    salesCsv,
    activitiesCsv,
    targetYear: 2027,
    synthetic: true,
  });

  const enero = baseline.lines.find((line) => line.period === "2027-01");
  const junio = baseline.lines.find((line) => line.period === "2027-06");

  assert.ok(enero, "debe existir la línea de enero");
  assert.ok(junio, "debe existir la línea de junio");
  // Con el impacto del evento retirado, ambos meses quedan en 100 unidades recurrentes.
  assert.equal(enero!.calculatedUnits, 100);
  assert.equal(junio!.calculatedUnits, 100);
});
