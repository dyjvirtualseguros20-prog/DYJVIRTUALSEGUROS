// Lectura de las variables de Supabase para los scripts de la terminal.
// Mismos nombres (y alternativas antiguas) que server/env.ts.
import { createClient } from "@supabase/supabase-js";

const read = (...names) => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    // "PEGA_AQUI..." es el marcador de .env.local: cuenta como vacío.
    if (value && !value.startsWith("PEGA_AQUI")) return value;
  }
  return "";
};

export const env = {
  url: read("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, ""),
  publicKey: read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
};

function legacyRole(key) {
  try {
    return JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
}
export const isSecretKey = (k) => k.startsWith("sb_secret_") || legacyRole(k) === "service_role";

export const ok = (msg) => console.log(`  ✅ ${msg}`);
export const fail = (msg) => console.log(`  ❌ ${msg}`);
export const info = (msg) => console.log(`     ${msg}`);

/** Comprueba que las 2 variables existan y estén en su lugar. Devuelve true si todo está bien. */
export function checkEnv() {
  let good = true;
  if (!env.url) {
    fail("Falta NEXT_PUBLIC_SUPABASE_URL en .env.local");
    good = false;
  } else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(env.url)) {
    fail(`NEXT_PUBLIC_SUPABASE_URL no parece válida: ${env.url}`);
    info("Debe verse así: https://abcdefgh.supabase.co");
    good = false;
  } else ok(`Dirección del proyecto: ${env.url}`);

  if (!env.publicKey) {
    fail("Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (clave pública) en .env.local");
    good = false;
  } else if (isSecretKey(env.publicKey)) {
    fail("En NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY hay una clave SECRETA. Cámbiala por la Publishable key.");
    good = false;
  } else ok("Clave pública presente");

  return good;
}

export const publicClient = () =>
  createClient(env.url, env.publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
