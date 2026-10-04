// Comprueba que la conexión con Supabase esté completa y segura.
// Uso:  npm run verificar-supabase
// Solo usa la clave pública: ve exactamente lo mismo que vería un visitante.
import { checkEnv, fail, info, ok, publicClient } from "./supabase-env.mjs";

let problems = 0;
const step = (title) => console.log(`\n${title}`);

console.log("\n🔎 Verificando la conexión con Supabase");

step("1. Archivo .env.local");
if (!checkEnv()) {
  console.log("\n➡️  Completa .env.local y vuelve a ejecutar: npm run verificar-supabase\n");
  process.exit(1);
}

const pub = publicClient();

step("2. Conexión y registro de solicitudes");
// Se llama a la función con una referencia inválida a propósito: si responde
// "referencia no valida", la función existe y NO se guarda nada.
const probe = await pub.rpc("submit_quote_request", {
  p_reference: "PRUEBA",
  p_insurance_type: "vida",
  p_full_name: "Prueba",
  p_identification: "",
  p_phone: "3000000000",
  p_whatsapp: "573000000000",
  p_email: "prueba@example.com",
  p_city: "",
  p_form_data: {},
});
const msg = probe.error?.message ?? "";
if (/referencia no valida/i.test(msg)) {
  ok("Conectado. La web puede registrar solicitudes.");
} else if (/invalid api key|401/i.test(msg)) {
  problems++;
  fail("Supabase rechazó la clave pública. Vuelve a copiar la Publishable key.");
} else if (/could not find the function|PGRST202|does not exist/i.test(msg)) {
  problems++;
  fail("La conexión funciona, pero falta instalar la base de datos.");
  info("Ejecuta supabase/migrations/0001_quote_requests.sql en el SQL Editor.");
} else if (/fetch failed|ENOTFOUND|getaddrinfo/i.test(msg)) {
  problems++;
  fail("No se pudo llegar a Supabase. Revisa NEXT_PUBLIC_SUPABASE_URL y tu conexión a internet.");
} else {
  problems++;
  fail(`Respuesta inesperada: ${msg || "la prueba se guardó, revisa la función"}`);
}

step("3. Seguridad (lo que vería un visitante)");
const leak = await pub.from("quote_requests").select("id").limit(1);
if (!leak.error && leak.data?.length) {
  problems++;
  fail("¡PELIGRO! Un visitante puede leer solicitudes. Vuelve a ejecutar el SQL completo.");
} else {
  ok("Un visitante NO puede leer las solicitudes.");
}
const write = await pub
  .from("quote_requests")
  .update({ status: "vendido" })
  .eq("status", "nueva_solicitud")
  .select("id");
if (!write.error && write.data?.length) {
  problems++;
  fail("¡PELIGRO! Un visitante puede modificar solicitudes. Vuelve a ejecutar el SQL completo.");
} else {
  ok("Un visitante NO puede modificar solicitudes.");
}

console.log(
  problems === 0
    ? "\n🎉 Conexión lista. Reinicia la web (npm run dev) y prueba el formulario y /admin.\n"
    : `\n⚠️  Hay ${problems} punto(s) por resolver. Sigue las indicaciones de arriba.\n`,
);
process.exit(problems === 0 ? 0 : 1);
