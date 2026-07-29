import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("las capacidades piloto universales fueron sustituidas por asignaciones por Plan", async () => {
  const page = await readFile(new URL("../../app/page.tsx", import.meta.url), "utf8");
  const access = await readFile(new URL("../../app/api/_access.ts", import.meta.url), "utf8");
  assert.doesNotMatch(page, /PILOT_CAPABILITIES/);
  assert.match(access, /scope_type = 'PLAN'/);
  assert.match(access, /No tienes una asignación para este Plan/);
  for (const capability of ["MARKETING_CONTRIBUTE","TRADE_CONTRIBUTE","PLAN_INTEGRATE","REVIEW","APPROVE","VIEW_FINANCIALS"]) {
    assert.match(access, new RegExp(capability));
  }
});

test("la administración sólo concede las seis capacidades aprobadas", async () => {
  const route = await readFile(new URL("../../app/api/admin/access/route.ts", import.meta.url), "utf8");
  assert.match(route, /ASSIGNABLE_CAPABILITIES\.includes/);
  assert.doesNotMatch(route, /FINANCE.*APPROVE|VIEW_FINANCIALS.*PLAN_INTEGRATE/);
  assert.match(route, /ADMINISTER_ACCESS/);
});

test("Marketing y Trade sólo aportan a su función y únicamente el KAM integra", async () => {
  const route = await readFile(new URL("../../app/api/contributions/route.ts", import.meta.url), "utf8");
  assert.match(route, /body\.businessFunction === "MARKETING" \? "MARKETING_CONTRIBUTE" : "TRADE_CONTRIBUTE"/);
  assert.match(route, /authorizePlan\(request, planId, \["PLAN_INTEGRATE"\]\)/);
  assert.match(route, /status = 'SUBMITTED'/);
});

test("Finanzas recibe una vista sin decisiones y no puede calcular rentabilidad", async () => {
  const platform = await readFile(new URL("../../app/revenue/RevenuePlatform.tsx", import.meta.url), "utf8");
  const profitability = await readFile(new URL("../../app/api/profitability/route.ts", import.meta.url), "utf8");
  assert.match(platform, /financeOnly/);
  assert.match(platform, /readOnly=\{financeOnly\}/);
  assert.match(profitability, /\["VIEW_FINANCIALS","PLAN_INTEGRATE","REVIEW","APPROVE"\]/);
  assert.match(profitability, /\["PLAN_INTEGRATE"\]/);
});

test("la consolidación conserva contribución, propietario, fuente y calidad del supuesto", async () => {
  const growth = await readFile(new URL("../../app/api/growth/route.ts", import.meta.url), "utf8");
  for (const field of ["contributionId","contributionOwnerId","sourceSystem","assumptionQuality"]) {
    assert.match(growth, new RegExp(field));
  }
  assert.match(growth, /status = 'ACCEPTED'/);
});
