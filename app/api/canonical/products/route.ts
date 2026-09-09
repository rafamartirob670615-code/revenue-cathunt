import { readCanonicalCategories, readCanonicalProducts } from "../../../../application/canonical-data.ts";
import { accessError, authorizeMonitoring } from "../../_access.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await authorizeMonitoring(request);
    const [products, categories] = await Promise.all([readCanonicalProducts(), readCanonicalCategories()]);
    return Response.json({ ok: true, source: "CANONICOS", products, categories });
  } catch (error) {
    return accessError(error, "No pudimos leer el catálogo canónico de productos");
  }
}
