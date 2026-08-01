import { env } from "cloudflare:workers";
import type { D1DatabaseLike } from "../../../application/d1-repository.ts";
import type { Plan, PlanStatus } from "../../../domain/types.ts";
import { authenticatedEmail as resolveAuthenticatedEmail } from "../_access.ts";

export const runtime = "edge";

type DashboardStage =
  | "PREPARE_INFORMATION"
  | "COMPLETE_INFORMATION"
  | "REVIEW_PACKAGE"
  | "BUILD_BASELINE"
  | "BUILD_PLAN"
  | "REVIEW_APPROVAL"
  | "OFFICIAL";

interface DashboardPlan {
  id: string;
  company: string;
  account: string;
  year: number;
  currency: string;
  version: number;
  status: PlanStatus;
  stage: DashboardStage;
  nextAction: string;
  readyFiles: number;
  packageAccepted: boolean;
  updatedAt: string;
}

function database(): D1DatabaseLike {
  if (!env.DB) throw new Error("Persistencia no disponible");
  return env.DB as unknown as D1DatabaseLike;
}

function authenticatedEmail(request: Request) {
  // Production identity is supplied by oai-authenticated-user-email; localhost uses the demo account.
  return resolveAuthenticatedEmail(request);
}

function displayName(request: Request) {
  const value = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  if (!value || encoding !== "percent-encoded-utf-8") return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function deriveStage(
  plan: Plan,
  readyFiles: number,
  packageAccepted: boolean,
  baselineCalculated: boolean,
  baselineApproved: boolean,
  growthReady: boolean,
  resultReady: boolean,
  profitabilityReady: boolean,
): Pick<DashboardPlan, "stage" | "nextAction"> {
  const version = plan.versions.at(-1);
  const status = version?.status ?? "DRAFT";
  if (status === "OFFICIAL") return { stage: "OFFICIAL", nextAction: "Abrir Plan oficial" };
  if (["SUBMITTED", "COMMERCIAL_APPROVED", "RETURNED"].includes(status)) {
    return { stage: "REVIEW_APPROVAL", nextAction: status === "RETURNED" ? "Revisar devolución" : "Revisar aprobación" };
  }
  if (version?.lines?.length) return { stage: "BUILD_PLAN", nextAction: "Continuar construcción" };
  if (profitabilityReady) return { stage: "BUILD_PLAN", nextAction: "Preparar versión" };
  if (resultReady) return { stage: "BUILD_PLAN", nextAction: "Revisar rentabilidad" };
  if (growthReady) return { stage: "BUILD_PLAN", nextAction: "Consolidar unidades y valor" };
  if (baselineApproved) return { stage: "BUILD_PLAN", nextAction: "Preparar Marketing y Trade" };
  if (baselineCalculated) return { stage: "BUILD_PLAN", nextAction: "Revisar cálculo técnico" };
  if (packageAccepted) return { stage: "BUILD_BASELINE", nextAction: "Calcular Volumen base" };
  if (readyFiles >= 4) return { stage: "REVIEW_PACKAGE", nextAction: "Confirmar información" };
  if (readyFiles > 0) return { stage: "COMPLETE_INFORMATION", nextAction: "Completar información" };
  return { stage: "PREPARE_INFORMATION", nextAction: "Preparar información" };
}

export async function GET(request: Request) {
  try {
    const ownerId = authenticatedEmail(request);
    if (!ownerId) {
      return Response.json({ ok: false, error: "Autenticación requerida" }, { status: 401 });
    }
    const result = await database()
      .prepare(
        `SELECT
          pa.aggregate_json,
          pa.updated_at,
          COALESCE((
            SELECT COUNT(*)
            FROM input_package_files ipf
            WHERE ipf.plan_id = pa.plan_id
              AND ipf.status = 'READY'
          ), 0) AS ready_files,
          COALESCE((
            SELECT status
            FROM input_package_reviews ipr
            WHERE ipr.plan_id = pa.plan_id
          ), '') AS package_status
          ,COALESCE((
            SELECT COUNT(*)
            FROM baseline_calculations bc
            WHERE bc.plan_id = pa.plan_id
          ), 0) AS baseline_count
          ,COALESCE((
            SELECT COUNT(*)
            FROM baseline_reviews br
            WHERE br.plan_id = pa.plan_id
              AND br.status = 'APPROVED_FROZEN'
          ), 0) AS baseline_approved_count
          ,COALESCE((
            SELECT COUNT(*)
            FROM growth_plans gp
            WHERE gp.plan_id = pa.plan_id
          ), 0) AS growth_count
          ,COALESCE((
            SELECT COUNT(*)
            FROM plan_results pr
            WHERE pr.plan_id = pa.plan_id
          ), 0) AS result_count
          ,COALESCE((
            SELECT COUNT(*)
            FROM financial_results fr
            WHERE fr.plan_id = pa.plan_id
          ), 0) AS profitability_count
        FROM plan_aggregates pa
        WHERE json_extract(pa.aggregate_json, '$.versions[0].createdBy') = ?
           OR EXISTS (
             SELECT 1 FROM access_assignments aa
             JOIN organization_memberships om ON om.id = aa.membership_id AND om.status = 'ACTIVE'
             JOIN users u ON u.id = om.user_id
             WHERE aa.scope_type = 'PLAN' AND aa.scope_id = pa.plan_id AND lower(u.email) = lower(?)
               AND datetime(aa.valid_from) <= datetime('now')
               AND (aa.valid_until IS NULL OR datetime(aa.valid_until) >= datetime('now'))
           )
        ORDER BY pa.updated_at DESC`,
      )
      .bind(ownerId, ownerId)
      .run<{
        aggregate_json: string;
        updated_at: string;
        ready_files: number;
        package_status: string;
        baseline_count: number;
        baseline_approved_count: number;
        growth_count: number;
        result_count: number;
        profitability_count: number;
      }>();
    const plans: DashboardPlan[] = (result.results ?? []).map((row) => {
      const plan = JSON.parse(row.aggregate_json) as Plan;
      const version = plan.versions.at(-1);
      const packageAccepted = row.package_status === "ACCEPTED";
      const derived = deriveStage(
        plan,
        row.ready_files,
        packageAccepted,
        row.baseline_count > 0,
        row.baseline_approved_count > 0,
        row.growth_count > 0,
        row.result_count > 0,
        row.profitability_count > 0,
      );
      return {
        id: plan.id,
        company: plan.companyName ?? plan.companyId,
        account: plan.accountName ?? plan.accountId,
        year: plan.year,
        currency: plan.currency,
        version: version?.number ?? 1,
        status: version?.status ?? "DRAFT",
        stage: derived.stage,
        nextAction: derived.nextAction,
        readyFiles: row.ready_files,
        packageAccepted,
        updatedAt: row.updated_at,
      };
    });
    const counts = {
      total: plans.length,
      informationPending: plans.filter((plan) =>
        ["PREPARE_INFORMATION", "COMPLETE_INFORMATION", "REVIEW_PACKAGE"].includes(plan.stage),
      ).length,
      packagesAccepted: plans.filter((plan) => plan.packageAccepted).length,
      inReview: plans.filter((plan) => plan.stage === "REVIEW_APPROVAL").length,
      official: plans.filter((plan) => plan.stage === "OFFICIAL").length,
    };
    return Response.json({
      ok: true,
      owner: { email: ownerId, name: displayName(request) },
      counts,
      plans,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos preparar el Inicio";
    return Response.json({ ok: false, error: message }, { status: 422 });
  }
}
