import assert from "node:assert/strict";
import test from "node:test";
import { PlanService } from "../../application/plan-service.ts";
import { InMemoryPlanRepository } from "../../application/repository.ts";
import {
  annualActivities,
  annualAllocations,
  annualInteractions,
  annualPlanFixture,
  expectedAnnualPlanUnits,
} from "../fixtures/annual-plan.ts";

const context = (commandId: string, actorId = "kam-1", hour = 12) => ({
  commandId,
  actorId,
  occurredAt: `2026-07-26T${hour}:00:00Z`,
});

test("recorrido anual es idempotente, reconciliable y reproducible", async () => {
  const repository = new InMemoryPlanRepository();
  const service = new PlanService(repository);

  const created = await service.createPlan(annualPlanFixture, context("create-1"));
  const repeated = await service.createPlan(annualPlanFixture, context("create-1"));
  assert.deepEqual(repeated, created);

  const calculated = await service.calculate(
    annualPlanFixture.id,
    "version-1",
    {
      activities: annualActivities,
      allocations: annualAllocations,
      interactions: annualInteractions,
    },
    context("calculate-1", "kam-1", 13),
  );
  assert.equal(calculated.lines.length, 12);
  assert.equal(
    calculated.lines.reduce((total, line) => total + (line.planUnits ?? 0), 0),
    expectedAnnualPlanUnits,
  );

  const submitted = await service.freezeAndSubmit(
    annualPlanFixture.id,
    "version-1",
    context("submit-1", "kam-1", 14),
  );
  assert.equal(submitted.version.status, "SUBMITTED");
  assert.equal(await service.verifySnapshot("version-1"), true);

  const returned = await service.decide(
    annualPlanFixture.id,
    "version-1",
    {
      id: "approval-return",
      stage: "COMMERCIAL",
      decision: "RETURNED",
      actorId: "director-1",
      decidedAt: "2026-07-26T15:00:00Z",
      comment: "Ajustar evidencia",
    },
    context("return-1", "director-1", 15),
  );
  assert.equal(returned.status, "RETURNED");

  const revision = await service.revise(
    annualPlanFixture.id,
    "version-1",
    "version-2",
    context("revise-1", "kam-1", 16),
  );
  assert.equal(revision.parentVersionId, "version-1");
  assert.equal(revision.status, "DRAFT");

  const resubmitted = await service.freezeAndSubmit(
    annualPlanFixture.id,
    "version-2",
    context("submit-2", "kam-1", 17),
  );
  assert.equal(resubmitted.version.status, "SUBMITTED");

  await service.decide(
    annualPlanFixture.id,
    "version-2",
    {
      id: "approval-commercial",
      stage: "COMMERCIAL",
      decision: "APPROVED",
      actorId: "director-1",
      decidedAt: "2026-07-26T18:00:00Z",
    },
    context("approve-commercial", "director-1", 18),
  );
  const official = await service.makeOfficial(
    annualPlanFixture.id,
    "version-2",
    context("official-1", "revenue-1", 19),
  );
  assert.equal(official.officialVersionId, "version-2");

  const reopened = await service.getPlan(annualPlanFixture.id);
  const reopenedVersion = reopened?.versions.find((item) => item.id === "version-2");
  assert.equal(reopenedVersion?.status, "OFFICIAL");
  assert.equal(
    reopenedVersion?.lines.reduce((total, line) => total + (line.planUnits ?? 0), 0),
    expectedAnnualPlanUnits,
  );
  assert.equal(await service.verifySnapshot("version-2"), true);
});

test("un commandId no puede reutilizarse para otra operación", async () => {
  const service = new PlanService(new InMemoryPlanRepository());
  await service.createPlan(annualPlanFixture, context("same-id"));
  await assert.rejects(
    service.calculate(
      annualPlanFixture.id,
      "version-1",
      { activities: [], allocations: [] },
      context("same-id"),
    ),
    /otra operación/,
  );
});

test("un Plan vacío se guarda, aparece en Mis Planes y conserva al autor autenticado", async () => {
  const service = new PlanService(new InMemoryPlanRepository());
  const emptyPlan = structuredClone(annualPlanFixture);
  emptyPlan.id = "empty-plan";
  emptyPlan.accountName = "Cuenta controlada";
  emptyPlan.versions[0].id = "empty-version";
  emptyPlan.versions[0].planId = "empty-plan";
  emptyPlan.versions[0].lines = [];
  emptyPlan.versions[0].createdBy = "valor-del-cliente";

  const created = await service.createPlan(
    emptyPlan,
    context("create-empty", "owner@example.com"),
  );
  assert.equal(created.versions[0].lines.length, 0);
  assert.equal(created.versions[0].createdBy, "owner@example.com");

  const listed = await service.listPlans("owner@example.com");
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, "empty-plan");

  const reopened = await service.getPlan("empty-plan");
  assert.deepEqual(reopened, created);
});
