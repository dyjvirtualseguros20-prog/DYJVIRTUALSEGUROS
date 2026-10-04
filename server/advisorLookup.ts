import "server-only";

/**
 * Comprobación ligera "¿existe este asesor y está activo?" para proxy.ts.
 * (proxy.ts no puede usar next/headers, por eso no reutiliza server/advisors.ts).
 * Caché en memoria de 60 s, también para identificadores que no existen.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBackend, supabaseEnv } from "./env";

const TTL_MS = 60_000;
const memo = new Map<string, { active: boolean; expires: number }>();
let client: SupabaseClient | null = null;

export async function isActiveAdvisor(id: string): Promise<boolean> {
  if (getBackend() !== "supabase") return false;

  const hit = memo.get(id);
  if (hit && hit.expires > Date.now()) return hit.active;

  client ??= createClient(supabaseEnv.url, supabaseEnv.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.from("advisors").select("id").eq("id", id).eq("active", true).maybeSingle();
  if (error) {
    console.error("[advisorLookup]", error.message);
    return false; // sin caché: se reintenta en la siguiente visita
  }
  const active = Boolean(data);
  if (memo.size > 500) memo.clear();
  memo.set(id, { active, expires: Date.now() + TTL_MS });
  return active;
}
