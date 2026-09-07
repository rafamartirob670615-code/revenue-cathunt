import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Crear plan y los módulos viven en una sola maquinaria", async () => {
  const page = await readFile(new URL("../../app/page.tsx", import.meta.url), "utf8");
  const shell = await readFile(new URL("../../app/revenue/Shell.tsx", import.meta.url), "utf8");
  const platform = await readFile(new URL("../../app/revenue/RevenuePlatform.tsx", import.meta.url), "utf8");
  assert.match(page, /RevenuePlatform/);
  assert.match(shell, /REVENUE_MODULES\.filter/);
  assert.match(shell, /sidebarModules/);
  assert.match(shell, /\["monitoreo", "contexto", "administracion"\]/);
  assert.match(platform, /initialModule = "monitoreo"/);
  assert.match(platform, /module === "contexto"/);
  assert.match(platform, /startCreate\(\)/);
  assert.doesNotMatch(platform, /HomeModule/);
  assert.doesNotMatch(page, /RevenueLobby|PlansWorkspace/);
});

test("el armazón mantiene una navegación simplificada", async () => {
  const shell = await readFile(new URL("../../app/revenue/Shell.tsx", import.meta.url), "utf8");
  const platform = await readFile(new URL("../../app/revenue/RevenuePlatform.tsx", import.meta.url), "utf8");
  for (const label of ["contexto", "monitoreo", "administracion"]) assert.match(shell, new RegExp(label));
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
