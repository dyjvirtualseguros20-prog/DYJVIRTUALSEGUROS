import "server-only";

/**
 * ¿Dónde se guardan las solicitudes y cómo se autentica el asesor?
 *
 *   "supabase" → Supabase (PostgreSQL + Auth). Requiere la URL y la clave PÚBLICA.
 *                No se necesita clave secreta: las solicitudes se registran con la
 *                función public.submit_quote_request() y RLS protege todo lo demás.
 *   "local"    → SOLO DESARROLLO y SOLO si no hay ninguna variable de Supabase:
 *                archivo .data/quote-requests.json y acceso con ADMIN_DEV_EMAIL / ADMIN_DEV_PASSWORD.
 *   "none"     → Configuración incompleta o incorrecta (o producción sin Supabase):
 *                no se aceptan solicitudes y /admin muestra qué falta.
 */
export type Backend = "supabase" | "local" | "none";

const read = (...names: string[]) => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    // "PEGA_AQUI..." es el marcador de .env.local: cuenta como vacío.
    if (value && !value.startsWith("PEGA_AQUI")) return value;
  }
  return "";
};

export const supabaseEnv = {
  url: read("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, ""),
  /** Clave PÚBLICA ("Publishable key"; antes "anon"). Puede llegar al navegador: RLS la limita. */
  anonKey: read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
};

/** Rol dentro de una clave antigua en formato JWT ("anon" o "service_role"). */
function legacyRole(key: string): string | null {
  const payload = key.split(".")[1];
  if (!payload) return null;
  try {
    return (JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

const isSecretKey = (key: string) => key.startsWith("sb_secret_") || legacyRole(key) === "service_role";

/** Problemas de configuración explicados en lenguaje sencillo (vacío = todo bien). */
export function supabaseConfigProblems(): string[] {
  const { url, anonKey } = supabaseEnv;
  if (!url && !anonKey) return [];

  const problems: string[] = [];
  if (!url) problems.push("Falta NEXT_PUBLIC_SUPABASE_URL (la dirección del proyecto).");
  else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url) && !url.startsWith("http://"))
    problems.push("NEXT_PUBLIC_SUPABASE_URL no parece válida. Debe verse así: https://abcdefgh.supabase.co");
  if (!anonKey) problems.push("Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (la clave pública).");
  if (anonKey && isSecretKey(anonKey))
    problems.push(
      "¡Cuidado! Pusiste una clave SECRETA en NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Esa variable es pública: usa ahí la Publishable key.",
    );
  return problems;
}

export function getBackend(): Backend {
  const { url, anonKey } = supabaseEnv;
  if (url || anonKey) return supabaseConfigProblems().length === 0 ? "supabase" : "none";
  if (process.env.NODE_ENV !== "production") return "local";
  return "none";
}
