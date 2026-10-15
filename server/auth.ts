import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createDevSessionValue,
  DEV_SESSION_COOKIE,
  DEV_SESSION_HOURS,
  devCredentials,
  safeEqual,
  verifyDevSession,
} from "./devSession";
import { staffSessionFrom, type StaffRow, type StaffSession } from "@/lib/staff";
import { getBackend } from "./env";
import { createSessionClient } from "./supabase";

/** Sesión del panel: quién es y con qué rol (admin_principal o asesor). */
export type AdminSession = StaffSession;

/** Devuelve la sesión del panel o null. Verifica la cuenta y el rol en el servidor. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const backend = getBackend();

  if (backend === "supabase") {
    const supabase = await createSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    // Solo las cuentas ACTIVAS de public.staff_users entran al panel (RLS: cada uno ve la suya).
    const { data: row } = await supabase
      .from("staff_users")
      .select("role, advisor_id, active")
      .eq("user_id", user.id)
      .maybeSingle<StaffRow>();
    return staffSessionFrom(user, row);
  }

  if (backend === "local") {
    // Acceso de desarrollo (sin Supabase): un único administrador.
    const store = await cookies();
    const dev = verifyDevSession(store.get(DEV_SESSION_COOKIE)?.value);
    return dev ? { userId: "local", email: dev.email, role: "admin_principal", advisorId: null } : null;
  }

  return null;
}

/** Exige sesión del panel; si no la hay, redirige al inicio de sesión. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

export type SignInResult = { ok: true } | { ok: false; error: string };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const backend = getBackend();
  const invalid: SignInResult = { ok: false, error: "Correo o contraseña incorrectos." };

  if (backend === "supabase") {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return invalid;
    if (!(await getAdminSession())) {
      await supabase.auth.signOut();
      return { ok: false, error: "Tu usuario no tiene acceso al panel o está desactivado." };
    }
    return { ok: true };
  }

  if (backend === "local") {
    const creds = devCredentials();
    if (!creds.email || !creds.password) {
      return { ok: false, error: "Configura ADMIN_DEV_EMAIL y ADMIN_DEV_PASSWORD en .env.local." };
    }
    if (!safeEqual(email.trim().toLowerCase(), creds.email) || !safeEqual(password, creds.password)) return invalid;
    const store = await cookies();
    store.set(DEV_SESSION_COOKIE, createDevSessionValue(creds.email), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DEV_SESSION_HOURS * 3600,
    });
    return { ok: true };
  }

  return { ok: false, error: "El panel no está configurado. Faltan las variables de Supabase." };
}

export async function signOut(): Promise<void> {
  const backend = getBackend();
  if (backend === "supabase") {
    const supabase = await createSessionClient();
    await supabase.auth.signOut();
  }
  const store = await cookies();
  store.delete(DEV_SESSION_COOKIE);
}
