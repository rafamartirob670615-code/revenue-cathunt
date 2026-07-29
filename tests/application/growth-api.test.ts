import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("../../app/api/growth/route.ts", import.meta.url);

test("crecimiento exige baseline congelado y acepta datasets empresariales canónicos", async () => {
  const source = await readFile(routeUrl, "utf8");
  assert.match(source, /APPROVED_FROZEN/);
  assert.match(source, /SYNTHETIC_NON_COMMERCIAL/);
  assert.match(source, /USER_PROVIDED/);
  assert.match(source, /marketing-plan/);
  assert.match(source, /trade-marketing-plan/);
  assert.match(source, /canonical_object_key/);
});

test("building blocks separan familias y reconciliación neta", async () => {
  const source = await readFile(routeUrl, "utf8");
  assert.match(source, /family:"MARKETING"/);
  assert.match(source, /family:"TRADE_MARKETING"/);
  assert.match(source, /grossUnits - activity\.cannibalizationUnits/);
  assert.match(source, /\+ activity\.haloUnits - activity\.pullForwardUnits/);
  assert.match(source, /duplicateEconomicIdentities/);
  assert.match(source, /unresolvedOverlaps/);
});
