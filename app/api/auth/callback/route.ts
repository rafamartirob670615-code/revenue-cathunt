import { consumeSsoToken, sessionCookie } from "../../_session.ts";

export const runtime = "nodejs";

// Solo se acepta una ruta relativa al propio origen — nunca una URL
// externa. No basta con bloquear "//" al inicio del texto: el parser de
// URL que usan los navegadores (WHATWG) normaliza backslashes a "/" y
// descarta TAB/CR/LF antes de resolver un Location, así que un valor
// como "/\evil.com" (o con esos caracteres de control) pasa un chequeo
// de texto ingenuo y aun así termina navegando a "https://evil.com" —
// confirmado en vivo el 2026-09-11 con `new URL(...)`, el mismo parser
// que usa el navegador. La única forma robusta es resolver el valor con
// ese mismo parser contra el origen real de la solicitud y comparar el
// origen resultante, no adivinar patrones de texto prohibidos.
function safeNext(value: string | null, origin: string): string {
  if (!value) return "/";
  try {
    const resolved = new URL(value, origin);
    if (resolved.origin !== origin) return "/";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("cathunt_token");
  const next = safeNext(url.searchParams.get("next"), url.origin);

  if (token) {
    try {
      const user = await consumeSsoToken(token, url.origin);
      if (user) {
        const headers = new Headers({ Location: new URL(next, request.url).toString() });
        headers.set("Set-Cookie", sessionCookie(user));
        return new Response(null, { status: 302, headers });
      }
    } catch (error) {
      // No revelamos datos ni capacidades si falla el SSO, pero dejamos una
      // causa operativa sin token ni datos de usuario para poder corregirlo.
      console.error("Revenue SSO callback failed", error instanceof Error ? error.message : "unknown error");
    }
  }

  return Response.redirect(new URL(next, request.url), 302);
}
