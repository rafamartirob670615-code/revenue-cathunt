import crypto from "node:crypto";
import postgres from "postgres";

const COOKIE = "cathunt_revenue_session";
const SESSION_MS = 8 * 60 * 60 * 1000;

type Session = { usuarioId: string; rol: "admin" | "usuario"; correo: string; nombre: string; exp: number };
export type CanonicalUser = {
  id: string;
  rol: "admin" | "usuario";
  activo: boolean;
  correo: string | null;
  nombre: string | null;
};

const globalConnection = globalThis as typeof globalThis & { revenueSsoDatabase?: ReturnType<typeof postgres> };

function secret() {
  const value = String(process.env.REVENUE_SESSION_SECRET || "").trim();
  if (value.length < 32) throw new Error("REVENUE_SESSION_SECRET debe tener al menos 32 caracteres");
  return value;
}

function signature(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function database() {
  const connectionString = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Persistencia no disponible: falta SUPABASE_DATABASE_URL");
  globalConnection.revenueSsoDatabase ??= postgres(connectionString, { max: 1, prepare: false, connect_timeout: 10, idle_timeout: 20 });
  return globalConnection.revenueSsoDatabase;
}

function parseSession(token: string | undefined): Session | null {
  try {
    if (!token) return null;
    const [payload, candidate] = token.split(".");
    if (!payload || !candidate) return null;
    const expected = signature(payload);
    if (candidate.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(expected))) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    return session.usuarioId && (session.rol === "admin" || session.rol === "usuario") && session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function cookieValue(cookieHeader: string | null | undefined) {
  const cookies = Object.fromEntries(String(cookieHeader || "").split(";").map((item) => item.trim()).filter(Boolean).map((item) => {
    const index = item.indexOf("=");
    return [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))];
  }));
  return cookies[COOKIE] as string | undefined;
}

export function sessionActorFromCookie(cookieHeader: string | null | undefined): Session | null {
  const session = parseSession(cookieValue(cookieHeader));
  return session?.correo ? session : null;
}

export function sessionActor(request: Request): Session | null {
  return sessionActorFromCookie(request.headers.get("cookie"));
}

export function requireAdmin(request: Request) {
  const session = sessionActor(request);
  if (session?.rol === "admin") return session;
  throw new Error("Autenticación de administrador requerida");
}

export function sessionCookie(user: CanonicalUser) {
  const correo = String(user.correo || "").trim().toLowerCase();
  if (!correo) throw new Error("El usuario autorizado no tiene correo en CANÓNICOS");
  const payload = Buffer.from(JSON.stringify({
    usuarioId: user.id,
    rol: user.rol,
    correo,
    nombre: String(user.nombre || "").trim(),
    exp: Date.now() + SESSION_MS,
  })).toString("base64url");
  return `${COOKIE}=${payload}.${signature(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MS / 1000}`;
}

export async function consumeSsoToken(token: string, destination: string): Promise<CanonicalUser | null> {
  const sql = database();
  const rows = await sql<{ usuario_id: string; destino: string; creado_en: string; usado: boolean }[]>`
    SELECT usuario_id, destino, creado_en, usado FROM public.sso_tokens WHERE token = ${token} LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.destino !== destination || row.usado || Date.now() - new Date(row.creado_en).getTime() >= 30_000) return null;
  const consumed = await sql`UPDATE public.sso_tokens SET usado = true WHERE token = ${token} AND usado = false RETURNING token`;
  if (!consumed.length) return null;
  const users = await sql<CanonicalUser[]>`SELECT id, rol, activo, correo, nombre FROM public.usuarios WHERE id = ${row.usuario_id} LIMIT 1`;
  const user = users[0];
  return user?.activo && user.correo && (user.rol === "admin" || user.rol === "usuario") ? user : null;
}
