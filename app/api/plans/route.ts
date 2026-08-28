import {
  SqlPlanRepository,
} from "../../../application/sql-repository.ts";
import {
  PlanService,
  type CalculationInput,
  type CommandContext,
} from "../../../application/plan-service.ts";
import { readCanonicalBuildingBlockCatalog } from "../../../application/canonical-building-blocks.ts";
import type { Approval, Plan } from "../../../domain/types.ts";
import { authorizePlan, authenticatedEmail } from "../_access.ts";
import { database } from "../_infrastructure.ts";
import { requireAdmin } from "../_session.ts";

export const runtime = "nodejs";

function service(): PlanService {
  const db = database();
  return new PlanService(new SqlPlanRepository(db), () => readCanonicalBuildingBlockCatalog(db));
}

function authorizedContext(
  request: Request,
  context: CommandContext | undefined,
): CommandContext {
  const email = authenticatedEmail(request);
  if (!email) throw new Error("AUTH_REQUIRED");
  if (!context?.commandId || !context.occurredAt) {
    throw new Error("commandId y occurredAt son obligatorios");
  }
  return { ...context, actorId: email };
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Error no identificado";
  if (message === "AUTH_REQUIRED" || /Autenticación/.test(message)) {
    return Response.json({ ok: false, error: "Autenticación requerida" }, { status: 401 });
  }
  const notFound = /no encontrado|no encontrada/.test(message);
  const conflict = /Conflicto|ya existe|ya fue utilizado|inmutable/.test(message);
  return Response.json(
    { ok: false, error: message },
    { status: notFound ? 404 : conflict ? 409 : 422 },
  );
}

export async function GET(request: Request): Promise<Response> {
  try {
    const email = authenticatedEmail(request);
    if (!email) throw new Error("AUTH_REQUIRED");
    const planId = new URL(request.url).searchParams.get("planId");
    if (!planId) {
      const owned = await service().listPlans(email);
      const assignedRows = await database().prepare(
        `SELECT DISTINCT pa.aggregate_json
         FROM plan_aggregates pa
         JOIN access_assignments aa ON aa.scope_type = 'PLAN' AND aa.scope_id = pa.plan_id
         JOIN organization_memberships om ON om.id = aa.membership_id AND om.status = 'ACTIVE'
         JOIN users u ON u.id = om.user_id
         WHERE lower(u.email) = lower(?)
           AND aa.valid_from::timestamptz <= now()
           AND (aa.valid_until IS NULL OR aa.valid_until::timestamptz >= now())`,
      ).bind(email).run<{ aggregate_json: string }>();
      const byId = new Map(owned.map((plan) => [plan.id, plan]));
      for (const row of assignedRows.results ?? []) {
        const plan = JSON.parse(row.aggregate_json) as Plan;
        byId.set(plan.id, plan);
      }
      return Response.json({ ok: true, plans: [...byId.values()] });
    }
    await authorizePlan(request, planId);
    const plan = await service().getPlan(planId);
    return plan
      ? Response.json({ ok: true, plan })
      : Response.json({ ok: false, error: "Plan no encontrado" }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}

type PlanCommand =
  | { action: "create"; plan: Plan; context: CommandContext }
  | {
      action: "calculate";
      planId: string;
      versionId: string;
      input: CalculationInput;
      context: CommandContext;
    }
  | {
      action: "freezeAndSubmit";
      planId: string;
      versionId: string;
      context: CommandContext;
    }
  | {
      action: "decide";
      planId: string;
      versionId: string;
      approval: Approval;
      context: CommandContext;
    }
  | {
      action: "revise";
      planId: string;
      sourceVersionId: string;
      newVersionId: string;
      context: CommandContext;
    }
  | {
      action: "makeOfficial";
      planId: string;
      versionId: string;
      context: CommandContext;
    };

export async function POST(request: Request): Promise<Response> {
  try {
    requireAdmin(request);
    const command = (await request.json()) as PlanCommand;
    const plans = service();
    let result: unknown;
    switch (command.action) {
      case "create":
        command.plan.versions[0].createdBy = authenticatedEmail(request) ?? command.plan.versions[0].createdBy;
        result = await plans.createPlan(
          command.plan,
          authorizedContext(request, command.context),
        );
        break;
      case "calculate":
        await authorizePlan(request, command.planId, ["PLAN_INTEGRATE"]);
        result = await plans.calculate(
          command.planId,
          command.versionId,
          command.input,
          authorizedContext(request, command.context),
        );
        break;
      case "freezeAndSubmit":
        await authorizePlan(request, command.planId, ["PLAN_INTEGRATE"]);
        result = await plans.freezeAndSubmit(
          command.planId,
          command.versionId,
          authorizedContext(request, command.context),
        );
        break;
      case "decide":
        await authorizePlan(request, command.planId, command.approval.decision === "APPROVED" ? ["APPROVE"] : ["REVIEW","APPROVE"]);
        result = await plans.decide(
          command.planId,
          command.versionId,
          {
            ...command.approval,
            actorId: authenticatedEmail(request) ?? command.approval.actorId,
          },
          authorizedContext(request, command.context),
        );
        break;
      case "revise":
        await authorizePlan(request, command.planId, ["PLAN_INTEGRATE"]);
        result = await plans.revise(
          command.planId,
          command.sourceVersionId,
          command.newVersionId,
          authorizedContext(request, command.context),
        );
        break;
      case "makeOfficial":
        await authorizePlan(request, command.planId, ["APPROVE"]);
        {
          const synthetic = await database()
            .prepare(
              "SELECT data_classification FROM baseline_calculations WHERE plan_id = ? AND data_classification = 'SYNTHETIC_NON_COMMERCIAL'",
            )
            .bind(command.planId)
            .first<{ data_classification: string }>();
          if (synthetic) {
            throw new Error("Los Planes con datos sintéticos no pueden convertirse en oficiales");
          }
        }
        result = await plans.makeOfficial(
          command.planId,
          command.versionId,
          authorizedContext(request, command.context),
        );
        break;
      default:
        return Response.json({ ok: false, error: "Acción no soportada" }, { status: 400 });
    }
    return Response.json({ ok: true, result });
  } catch (error) {
    return errorResponse(error);
  }
}
