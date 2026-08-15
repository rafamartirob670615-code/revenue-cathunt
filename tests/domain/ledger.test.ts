import assert from "node:assert/strict";
import test from "node:test";
import { buildIncrementLedger, calculateNetUnits } from "../../domain/ledger.ts";
import type { Activity, IncrementAllocation, Interaction } from "../../domain/types.ts";
import { testBuildingBlocks } from "../fixtures/building-blocks.ts";

const evidence = [{ id: "ev-1", source: "fixture", observedAt: "2026-07-26T12:00:00Z" }];

function activity(id: string, sourceActivityId = id): Activity {
  return {
    id,
    sourceSystem: "TPM",
    sourceActivityId,
    sourceVersion: "1",
    blockDefinitionId: "bb-trade",
    name: id,
    status: "APPROVED",
    ownerId: "trade",
    evidence,
  };
}

function allocation(id: string, activityId: string): IncrementAllocation {
  return {
    id,
    activityId,
    accountId: "account-1",
    skuId: "sku-1",
    month: "2027-06",
    grossUnits: 100,
    cannibalizationUnits: 20,
    haloUnits: 5,
    pullForwardUnits: 10,
    otherInteractionUnits: -2,
  };
}

test("calcula incremental neto después de canibalización, halo y pull-forward", () => {
  assert.equal(calculateNetUnits(allocation("al-1", "a-1")), 73);
});

test("reconcilia bruto, neto e interacción aprobada", () => {
  const activities = [activity("a-1"), activity("a-2")];
  const allocations = [allocation("al-1", "a-1"), allocation("al-2", "a-2")];
  allocations[1].skuId = "sku-2";
  const interactions: Interaction[] = [{
    id: "i-1",
    versionId: "v-1",
    activityIds: ["a-1", "a-2"],
    accountId: "account-1",
    skuId: "portfolio",
    month: "2027-06",
    netUnits: -6,
    methodId: "joint-effect-v1",
    evidence,
    approvedBy: "revenue",
  }];
  const result = buildIncrementLedger("v-1", activities, allocations, testBuildingBlocks, interactions);
  assert.equal(result.grossUnits, 200);
  assert.equal(result.netActivityUnits, 146);
  assert.equal(result.interactionUnits, -6);
  assert.equal(result.netUnits, 140);
});

test("bloquea una identidad económica duplicada", () => {
  assert.throws(
    () =>
      buildIncrementLedger(
        "v-1",
        [activity("a-1", "campaign-1"), activity("a-2", "campaign-1")],
        [],
        testBuildingBlocks,
      ),
    /Identidad económica duplicada/,
  );
});

test("bloquea dos asignaciones económicas de la misma actividad y grano", () => {
  assert.throws(
    () =>
      buildIncrementLedger(
        "v-1",
        [activity("a-1")],
        [allocation("al-1", "a-1"), allocation("al-2", "a-1")],
        testBuildingBlocks,
      ),
    /Asignación económica duplicada/,
  );
});

test("bloquea una actividad ya incluida en baseline", () => {
  const included = activity("a-1");
  included.baselineInclusionKey = "promo-2027-06";
  assert.throws(
    () =>
      buildIncrementLedger(
        "v-1",
        [included],
        [allocation("al-1", "a-1")],
        testBuildingBlocks,
        [],
        new Set(["promo-2027-06"]),
      ),
    /ya incluida en baseline/,
  );
});

test("bloquea solapamientos sin regla de interacción", () => {
  assert.throws(
    () =>
      buildIncrementLedger(
        "v-1",
        [activity("a-1"), activity("a-2")],
        [allocation("al-1", "a-1"), allocation("al-2", "a-2")],
        testBuildingBlocks,
      ),
    /Solapamiento sin interacción/,
  );
});
