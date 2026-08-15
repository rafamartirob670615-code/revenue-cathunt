import assert from "node:assert/strict";
import test from "node:test";
import { createAlfaTurmixRows } from "../../domain/alfa-turmix-monitoring.ts";
import { canMonitoring, createMonitoringOpportunity, personaScope, scopeMonitoringRows } from "../../domain/monitoring-access.ts";

test("cada persona ve sólo el alcance que le corresponde", () => {
  const rows = createAlfaTurmixRows([
    { id: "UCM-TEST-1", name: "Cuenta sintética", group: "(Individual)", territory: "Centro", channel: "Retail Moderno", subchannel: "General" },
  ]);
  const keyAccountRows = scopeMonitoringRows(rows, personaScope("KEY_ACCOUNT"));
  const tradeRows = scopeMonitoringRows(rows, personaScope("TRADE_MARKETING"));
  const marketingRows = scopeMonitoringRows(rows, personaScope("MARKETING"));
  const areaRows = scopeMonitoringRows(rows, personaScope("AREA_DIRECTOR"));
  const directorRows = scopeMonitoringRows(rows, personaScope("DEPARTMENT_DIRECTOR"));

  assert.ok(keyAccountRows.length < directorRows.length);
  assert.ok(tradeRows.every((row) => ["Retail Moderno", "Departamental"].includes(row.channel)));
  assert.ok(marketingRows.every((row) => ["Café y Bebidas", "Licuadoras", "Extractores de Jugo"].includes(row.family)));
  assert.ok(areaRows.every((row) => row.territory === "Centro"));
  assert.equal(directorRows.length, rows.length);
});

test("los roles comerciales pueden analizar y registrar oportunidades, pero nadie edita el ERP", () => {
  for (const persona of ["KEY_ACCOUNT", "TRADE_MARKETING", "MARKETING", "AREA_DIRECTOR", "DEPARTMENT_DIRECTOR"] as const) {
    assert.equal(canMonitoring(persona, "VIEW"), true);
    assert.equal(canMonitoring(persona, "CREATE_OPPORTUNITY"), true);
    assert.equal(canMonitoring(persona, "EDIT_OFFICIAL_DATA"), false);
  }
  assert.equal(canMonitoring("ADMINISTRATOR", "CONFIGURE_ACCESS"), true);
  assert.equal(canMonitoring("ADMINISTRATOR", "EDIT_OFFICIAL_DATA"), false);

  const opportunity = createMonitoringOpportunity({
    id: "OPP-ALFA-001", createdBy: "TRADE_MARKETING", scope: { channel: "Retail Moderno" },
    metric: "COVERAGE", description: "Revisar caída de cobertura en Café y Bebidas.", owner: "Trade Marketing", createdAt: "2026-08-01T12:00:00Z",
  });
  assert.equal(opportunity.status, "OPEN");
  assert.equal(opportunity.sourceDataset, "ALFA_TURMIX_SINTETICO_NO_COMERCIAL");
});
