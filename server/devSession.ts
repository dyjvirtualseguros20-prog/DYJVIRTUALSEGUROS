import "server-only";

/**
 * Sesión del acceso de DESARROLLO (solo cuando Supabase no está configurado).
 * Cookie firmada con HMAC: correo + vencimiento. La comparten server/auth.ts y proxy.ts.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const DEV_SESSION_COOKIE = "dev_admin_session";
export const DEV_SESSION_HOURS = 8;

export const devCredentials = () => ({
  email: (process.env.ADMIN_DEV_EMAIL ?? "").trim().toLowerCase(),
  password: process.env.ADMIN_DEV_PASSWORD ?? "",
});

function devSign(payload: string): string {
  // La firma depende de la contraseña: si cambia, las sesiones anteriores dejan de valer.
  return createHmac("sha256", `dev-admin:${devCredentials().password}`).update(payload).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function createDevSessionValue(email: string): string {
  const payload = Buffer.from(`${email}|${Date.now() + DEV_SESSION_HOURS * 3_600_000}`).toString("base64url");
  return `${payload}.${devSign(payload)}`;
}

export function verifyDevSession(value: string | undefined): { email: string } | null {
  const { email, password } = devCredentials();
  if (!value || !email || !password) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, devSign(payload))) return null;
  const [cookieEmail, expires] = Buffer.from(payload, "base64url").toString("utf8").split("|");
  if (cookieEmail !== email || Number(expires) < Date.now()) return null;
  return { email };
}
