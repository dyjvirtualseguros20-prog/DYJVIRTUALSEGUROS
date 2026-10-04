import "server-only";

/**
 * ASESORES (tabla public.advisors en Supabase)
 * ─────────────────────────────────────────────
 * - getAdvisor(id): datos públicos de un asesor ACTIVO (con caché de 60 s).
 * - getCurrentAdvisor(): asesor de la visita actual, según la cookie que fija proxy.ts.
 * - listAdvisors(): todos los asesores (incluidos inactivos) para el panel /admin.
 *
 * Para agregar un asesor no hace falta tocar el código: basta con insertar una fila
 * en la tabla `advisors` de Supabase. Aparece en la web en menos de un minuto.
 */
import { cookies } from "next/headers";
import { cache } from "react";
import { ADVISOR_COOKIE, normalizeAdvisorId } from "@/lib/advisorLink";
import { contactInfo, type ContactInfo } from "@/lib/whatsapp";
import type { Advisor } from "@/types";
import { getBackend } from "./env";
import { createPublicClient, createSessionClient } from "./supabase";

const COLUMNS = "id, name, photo_url, whatsapp, phone, active";
const TTL_MS = 60_000;

interface Row {
  id: string;
  name: string;
  photo_url: string | null;
  whatsapp: string;
  phone: string | null;
  active: boolean;
}

const toAdvisor = (r: Row): Advisor => ({
  id: r.id,
  name: r.name,
  photoUrl: r.photo_url,
  whatsapp: r.whatsapp,
  phone: r.phone,
  active: r.active,
});

// Caché en memoria (por instancia del servidor), también para ids que no existen.
const memo = new Map<string, { advisor: Advisor | null; expires: number }>();

/** Asesor ACTIVO con ese id, o null. */
export async function getAdvisor(rawId: string | null | undefined): Promise<Advisor | null> {
  const id = normalizeAdvisorId(rawId);
  if (!id || getBackend() !== "supabase") return null;

  const hit = memo.get(id);
  if (hit && hit.expires > Date.now()) return hit.advisor;

  const { data, error } = await createPublicClient()
    .from("advisors")
    .select(COLUMNS)
    .eq("id", id)
    .eq("active", true)
    .maybeSingle<Row>();

  if (error) {
    // Ante un error de red no se cachea: se reintenta en la siguiente visita.
    console.error("[advisors] getAdvisor", error.message);
    return null;
  }
  const advisor = data ? toAdvisor(data) : null;
  if (memo.size > 500) memo.clear();
  memo.set(id, { advisor, expires: Date.now() + TTL_MS });
  return advisor;
}

/** Asesor de la visita actual (cookie "asesor"). Se calcula una sola vez por petición. */
export const getCurrentAdvisor = cache(async (): Promise<Advisor | null> => {
  const store = await cookies();
  return getAdvisor(store.get(ADVISOR_COOKIE)?.value);
});

/** Todos los asesores (activos e inactivos) para el panel. Requiere sesión de asesor. */
export async function listAdvisors(): Promise<Advisor[]> {
  if (getBackend() !== "supabase") return [];
  const supabase = await createSessionClient();
  const { data, error } = await supabase.from("advisors").select(COLUMNS).order("name");
  if (error) {
    console.error("[advisors] listAdvisors", error.message);
    return [];
  }
  return (data as Row[]).map(toAdvisor);
}

/** Datos de contacto de la visita actual: los del asesor del enlace o los de la empresa. */
export async function getCurrentContact(): Promise<ContactInfo> {
  return contactInfo(await getCurrentAdvisor());
}
