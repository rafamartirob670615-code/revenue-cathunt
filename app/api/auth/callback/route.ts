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
        response.headers.set("Set-Cookie", sessionCookie(user.id, user.rol));
        return response;
      }
    } catch {
      // La lectura pública sigue disponible si el SSO falla; las escrituras
      // permanecen cerradas porque exigen una sesión firmada de administrador.
    }
  }

  return Response.redirect(new URL(next, request.url), 302);
}
