import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/**
 * Cliente con la sesión del asesor (cookies). Respeta Row Level Security:
 * solo devuelve datos si el usuario está en public.admin_users.
 * Usar en Server Components, Server Actions y Route Handlers del panel.
 */
export async function createSessionClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // En Server Components no se pueden escribir cookies; proxy.ts renueva la sesión.
        }
      },
    },
  });
}

let publicClient: SupabaseClient | null = null;

/**
 * Cliente con la clave PÚBLICA y sin sesión. Solo puede hacer lo que RLS permite
 * a un visitante: llamar a public.submit_quote_request() para registrar una
 * solicitud nueva. No puede leer ni modificar solicitudes existentes.
 */
export function createPublicClient(): SupabaseClient {
  publicClient ??= createClient(supabaseEnv.url, supabaseEnv.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return publicClient;
}
