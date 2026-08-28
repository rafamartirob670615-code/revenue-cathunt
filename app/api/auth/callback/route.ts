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
        const response = Response.redirect(new URL(next, request.url), 302);
        response.headers.set("Set-Cookie", sessionCookie(user));
        return response;
      }
    } catch {
      // No revelamos datos ni capacidades si falla el SSO.
    }
  }

  return Response.redirect(new URL(next, request.url), 302);
}
