import { accessError, authorizeMonitoring } from "../../_access.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROMOCION_ORIGIN = "https://promocion-marsal1.vercel.app";
const READY_STATUSES = new Set(["APPROVED", "IN_EXECUTION", "ACTUALS_PENDING", "CLOSED"]);

type PromotionEvent = {
  eventId: string;
  eventCode: string;
  eventType: "FAP" | "FAM";
  title: string;
  status: string;
  accountId?: string;
  scopeType: string;
  scopeLabel: string;
  productRefs: string[];
  mechanic: string;
  objective: string;
  startDate: string;
  endDate: string;
  plannedInvestment: number;
  planOrigin?: "ANNUAL" | "ADHOC";
  planYear?: number;
};

export async function GET(request: Request) {
  try {
    await authorizeMonitoring(request);
    const accountId = new URL(request.url).searchParams.get("accountId") ?? "";
    if (!accountId) throw new Error("accountId es obligatorio");
    const response = await fetch(`${PROMOCION_ORIGIN}/api/data`, { cache: "no-store" });
    if (!response.ok) throw new Error("Promoción no respondió correctamente");
    const body = await response.json() as { events?: PromotionEvent[] };
    const suggestions = (body.events ?? [])
      .filter((event) => READY_STATUSES.has(event.status))
      .filter((event) => event.scopeType === "ACCOUNT" && event.accountId === accountId)
      .map((event) => ({
        id: event.eventId,
        family: event.eventType === "FAM" ? "MARKETING" : "TRADE_MARKETING",
        title: event.title,
        productScope: event.productRefs?.length ? event.productRefs.join(", ") : event.scopeLabel,
        periodStart: (event.startDate || "").slice(0, 7),
        periodEnd: (event.endDate || "").slice(0, 7),
        investmentAmount: event.plannedInvestment ?? 0,
        evidence: `Importado de Promoción · ${event.eventType} ${event.eventCode} · ${event.mechanic}${event.objective ? ` · ${event.objective}` : ""}`,
        planOrigin: event.planOrigin === "ANNUAL" ? "ANNUAL" : "ADHOC",
        planYear: event.planYear,
      }));
    return Response.json({ ok: true, suggestions });
  } catch (error) {
    return accessError(error, "No pudimos leer actividades de Promoción");
  }
}
