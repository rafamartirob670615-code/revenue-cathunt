import { accessError, resolveRevenueIdentity } from "../_access.ts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    return Response.json({ ok: true, identity: await resolveRevenueIdentity(request) });
  } catch (error) {
    return accessError(error, "No pudimos recuperar tus asignaciones");
  }
}
