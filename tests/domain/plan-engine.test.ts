import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePlanLines,
  decideVersion,
  freezeVersion,
  submitVersion,
} from "../../domain/plan-engine.ts";
import type { LedgerEntry, PlanVersion } from "../../domain/types.ts";

const version: PlanVersion = {
  id: "v-1",
  planId: "plan-1",
  number: 1,
  kind: "PLAN",
  status: "DRAFT",
  createdBy: "kam-1",
  createdAt: "2026-07-26T12:00:00Z",
  lines: [{
    accountId: "account-1",
    skuId: "sku-1",
    month: "2027-01",
    baseline: {
      calculationId: "base-1",
      state: "APPROVED",
      methodId: "seasonal-naive",
      methodVersion: "1",
      calculatedUnits: 1000,
      adjustedUnits: 1010,
      approvedUnits: 1010,
      evidence: [],
    },
    authorizedAdjustmentUnits: 5,
  }],
  overrides: [],
  validations: [],
  approvals: [],
};

const ledgerEntry = {
  id: "ledger-1",
  versionId: "v-1",
  activity: { id: "a-1" },
  allocation: {
    accountId: "account-1",
    skuId: "sku-1",
    month: "2027-01",
  },
  netUnits: 85,
} as LedgerEntry;

test("reconcilia Plan = baseline aprobado + incremental neto + ajuste autorizado", () => {
  const calculated = calculatePlanLines(version, [ledgerEntry], []);
  assert.equal(calculated.lines[0].planUnits, 1100);
});

test("congela y envía una versión calculada sin bloqueos", () => {
  const calculated = calculatePlanLines(version, [ledgerEntry], []);
  const frozen = freezeVersion(calculated, "2026-07-26T13:00:00Z");
  assert.equal(frozen.status, "FROZEN");
  assert.equal(submitVersion(frozen).status, "SUBMITTED");
});

test("bloquea congelamiento con validaciones abiertas", () => {
  const calculated = calculatePlanLines(
    {
      ...version,
      validations: [{
        id: "validation-1",
        code: "MISSING_UOM",
        severity: "BLOCKING",
        status: "OPEN",
        message: "Falta unidad homologada",
      }],
    },
    [ledgerEntry],
    [],
  );
  assert.throws(() => freezeVersion(calculated, "2026-07-26T13:00:00Z"), /bloqueante/);
});

test("una versión congelada es inmutable", () => {
  const calculated = calculatePlanLines(version, [ledgerEntry], []);
  const frozen = freezeVersion(calculated, "2026-07-26T13:00:00Z");
  assert.throws(() => calculatePlanLines(frozen, [ledgerEntry], []), /inmutable/);
});

test("la aprobación comercial habilita la oficialización sin intervención de Finanzas", () => {
  const submitted = submitVersion(
    freezeVersion(
      calculatePlanLines(version, [ledgerEntry], []),
      "2026-07-26T13:00:00Z",
    ),
  );
  const commercial = decideVersion(submitted, {
    id: "approval-1",
    stage: "COMMERCIAL",
    decision: "APPROVED",
    actorId: "director-1",
    decidedAt: "2026-07-26T14:00:00Z",
  });
  assert.equal(commercial.status, "COMMERCIAL_APPROVED");
  assert.equal(commercial.approvals.length, 1);
});
