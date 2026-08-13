// Recibe el token de un solo uso que genera el Hub. REVENUE usa D1 (Cloudflare)
// como base propia, no Supabase — este endpoint valida el token por REST
// directo a Supabase (fetch nativo, sin dependencias nuevas) usando las
// variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (deben agregarse como
// secretos del Worker con `wrangler secret put`, no existen todavía).
// REVENUE ya opera con una identidad pública fija (pilot@revenue.local, ver
// app/api/_access.ts) — esto no cambia esa lógica, solo cierra el ciclo de
// auditoría del SSO. Nunca bloquea el acceso si Supabase falla.
export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("cathunt_token");
  const next = url.searchParams.get("next") || "/";

  if (token) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      try {
        const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
        const r = await fetch(
          `${supabaseUrl}/rest/v1/sso_tokens?token=eq.${token}&select=creado_en,usado`,
          { headers },
        );
        const rows = (await r.json()) as { creado_en: string; usado: boolean }[];
        const fila = rows[0];
        const vigente = fila && !fila.usado && Date.now() - new Date(fila.creado_en).getTime() < 30_000;
        if (vigente) {
          await fetch(`${supabaseUrl}/rest/v1/sso_tokens?token=eq.${token}`, {
            method: "PATCH",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ usado: true }),
          });
        }
      } catch {
        // Si Supabase falla, no bloqueamos el acceso.
      }
    }
  }

  return Response.redirect(new URL(next, request.url), 302);
}
