import { consumeSsoToken, sessionCookie } from "../../_session.ts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("cathunt_token");
  const requestedNext = url.searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";

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
