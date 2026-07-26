import { env } from "cloudflare:workers";
import {
  D1PlanRepository,
  type D1DatabaseLike,
} from "../../../application/d1-repository.ts";
import {
  PlanService,
  type CalculationInput,
  type CommandContext,
} from "../../../application/plan-service.ts";
import type { Approval, Plan } from "../../../domain/types.ts";

export const runtime = "edge";

function service(): PlanService {
  if (!env.DB) throw new Error("Persistencia de Plan no disponible");
  return new PlanService(
    new D1PlanRepository(env.DB as unknown as D1DatabaseLike),
  );
}

function database(): D1DatabaseLike {
  if (!env.DB) throw new Error("Persistencia de Plan no disponible");
  return env.DB as unknown as D1DatabaseLike;
}

function authenticatedEmail(request: Request): string | undefined {
  return request.headers.get("oai-authenticated-user-email") ?? undefined;
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
  if (message === "AUTH_REQUIRED") {
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
      const plans = await service().listPlans(email);
      return Response.json({ ok: true, plans });
    }
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
    const command = (await request.json()) as PlanCommand;
    const plans = service();
    let result: unknown;
    switch (command.action) {
      case "create":
        result = await plans.createPlan(
          command.plan,
          authorizedContext(request, command.context),
        );
        break;
      case "calculate":
        result = await plans.calculate(
          command.planId,
          command.versionId,
          command.input,
          authorizedContext(request, command.context),
        );
        break;
      case "freezeAndSubmit":
        result = await plans.freezeAndSubmit(
          command.planId,
          command.versionId,
          authorizedContext(request, command.context),
        );
        break;
      case "decide":
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
        result = await plans.revise(
          command.planId,
          command.sourceVersionId,
          command.newVersionId,
          authorizedContext(request, command.context),
        );
        break;
      case "makeOfficial":
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
