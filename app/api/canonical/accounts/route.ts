import { readCanonicalRevenueAccounts } from "../../../../application/canonical-data.ts";
import { accessError, authorizeMonitoring } from "../../_access.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await authorizeMonitoring(request);
    return Response.json({
      ok: true,
      source: "CANONICOS",
      accounts: await readCanonicalRevenueAccounts(),
    });
  } catch (error) {
    return accessError(error, "No pudimos leer el universo canónico de cuentas");
  }
}
