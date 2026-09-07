import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Inicio y los módulos viven en una sola maquinaria", async () => {
  const page = await readFile(new URL("../../app/page.tsx", import.meta.url), "utf8");
  const shell = await readFile(new URL("../../app/revenue/Shell.tsx", import.meta.url), "utf8");
  const home = await readFile(new URL("../../app/revenue/HomeModule.tsx", import.meta.url), "utf8");
  assert.match(page, /RevenuePlatform/);
  assert.match(shell, /REVENUE_MODULES\.filter/);
  assert.match(shell, /sidebarModules/);
  assert.match(home, /Crear un Plan anual/);
  assert.match(home, /Ver el negocio completo/);
  assert.match(home, /Rutas principales/);
  assert.match(home, /Estado del negocio en este momento/);
  assert.doesNotMatch(home, /Elige una ruta para empezar/);
  assert.doesNotMatch(home, /Registra compañía, cuenta, año y después/);
  assert.doesNotMatch(home, /Continuar exactamente donde quedó|Aportaciones por función|Demo oficial/);
  assert.doesNotMatch(page, /RevenueLobby|PlansWorkspace/);
});

test("el armazón mantiene una navegación simplificada", async () => {
  const shell = await readFile(new URL("../../app/revenue/Shell.tsx", import.meta.url), "utf8");
  const platform = await readFile(new URL("../../app/revenue/RevenuePlatform.tsx", import.meta.url), "utf8");
  for (const label of ["inicio", "monitoreo", "administracion"]) assert.match(shell, new RegExp(label));
  assert.doesNotMatch(shell, /plan-context/);
  assert.doesNotMatch(platform, /completed=/);
  assert.doesNotMatch(shell, /disabled={!available/);
  assert.match(platform, /APPROVED_FROZEN/);
  assert.match(platform, /unitsReconciled/);
});

test("la información identifica responsables y la versión conserva gobierno", async () => {
  const requirements = await readFile(new URL("../../domain/input-package.ts", import.meta.url), "utf8");
  const modules = await readFile(new URL("../../app/revenue/PlanModules.tsx", import.meta.url), "utf8");
  const platform = await readFile(new URL("../../app/revenue/RevenuePlatform.tsx", import.meta.url), "utf8");
  assert.match(requirements, /suggestedOwner/);
  assert.match(modules, /Prueba no comercial/);
  assert.match(platform, /action: "freezeAndSubmit"/);
  assert.match(platform, /setActive\("monitoreo"\)/);
});
