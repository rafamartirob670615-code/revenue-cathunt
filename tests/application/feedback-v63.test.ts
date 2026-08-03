import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("feedback v63: Monitoreo conserva Shell, alcance y exportación", async () => {
  const platform = await readFile(new URL("../../app/revenue/RevenuePlatform.tsx", import.meta.url), "utf8");
  const monitor = await readFile(new URL("../../app/revenue/AlfaTurmixMonitor.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../../app/monitoring/page.tsx", import.meta.url), "utf8");
  assert.match(platform, /active === "monitoreo" \? selected \? <MonitoringModule/);
  assert.match(platform, /<AlfaTurmixMonitor \/>/);
  assert.match(page, /initialModule="monitoreo"/);
  assert.match(monitor, /Alcance seleccionado/);
  assert.match(monitor, /Todas las cuentas/);
  assert.match(monitor, /window\.print/);
  assert.match(monitor, /download/);
  assert.match(monitor, /bookType: "xlsx"/);
  assert.match(monitor, /\.xlsx/);
});

test("feedback v63: cuenta existente, archivos y bloqueo Product Cost son visibles", async () => {
  const platform = await readFile(new URL("../../app/revenue/RevenuePlatform.tsx", import.meta.url), "utf8");
  const modules = await readFile(new URL("../../app/revenue/PlanModules.tsx", import.meta.url), "utf8");
  assert.match(platform, /ALFA_UNIVERSE_ACCOUNTS/);
  assert.match(platform, /revenue-account-options/);
  assert.match(platform, /Selecciona una cuenta existente/);
  assert.match(modules, /Obligatorio/);
  assert.match(modules, /Responsable sugerido/);
  assert.match(modules, /Falta Product Cost/);
  assert.match(modules, /Subir Product Cost/);
  assert.match(modules, /Building blocks reconciliados/);
  assert.match(modules, /Documento oficial actualizado/);
  assert.match(modules, /Registra una fila mínima/);
  assert.match(platform, /async function guidedCapture/);
});

test("decisiones aclaradas: Billing oficial y P&L comparativo", async () => {
  const modules = await readFile(new URL("../../app/revenue/PlanModules.tsx", import.meta.url), "utf8");
  const profitability = await readFile(new URL("../../app/api/profitability/route.ts", import.meta.url), "utf8");
  assert.match(modules, /OfficialPlanBilling/);
  assert.match(modules, /Diferencial/);
  assert.match(modules, /priorYearAnnual/);
  assert.match(profitability, /priorYearAnnual/);
  assert.match(profitability, /sideDifference/);
});

test("decisiones aclaradas: Administración requiere capacidad de administrador", async () => {
  const access = await readFile(new URL("../../app/api/_access.ts", import.meta.url), "utf8");
  const admin = await readFile(new URL("../../app/api/admin/access/route.ts", import.meta.url), "utf8");
  assert.match(access, /ADMINISTER_ACCESS/);
  assert.match(admin, /administrador/);
  assert.match(admin, /scope_type='ORGANIZATION'/);
  assert.match(admin, /plans:/);
});
