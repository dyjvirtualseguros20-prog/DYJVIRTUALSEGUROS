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
import { getBackend } from "./env";
import { createSessionClient } from "./supabase";

export interface AdminSession {
  email: string;
}

/** Devuelve el asesor de la sesión actual o null. Verifica permisos en el servidor. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const backend = getBackend();

  if (backend === "supabase") {
    const supabase = await createSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    // Solo los usuarios registrados en public.admin_users son asesores.
    const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    return admin ? { email: user.email ?? "" } : null;
  }

  if (backend === "local") {
    const store = await cookies();
    return verifyDevSession(store.get(DEV_SESSION_COOKIE)?.value);
  }

  return null;
}

/** Exige sesión de asesor; si no la hay, redirige al inicio de sesión. */
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
      return { ok: false, error: "Tu usuario no tiene permisos de asesor." };
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
