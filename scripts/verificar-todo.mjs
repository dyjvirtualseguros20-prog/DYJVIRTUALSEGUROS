// VERIFICACIÓN ESTÁNDAR (red de seguridad de la Fase 2)
// ──────────────────────────────────────────────────────
// Comprueba que un cambio no rompió la web ni la Fase 1 de WhatsApp. No usa Workers AI,
// no toca Supabase ni Cloudflare y no publica nada.
//
//   npm run verificar-todo             → todo (incluye los builds de Next y OpenNext)
//   npm run verificar-todo -- --rapido → sin los builds (para iterar)
//   npm run verificar-todo -- --detalle → muestra la salida de cada paso
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const rapido = process.argv.includes("--rapido");
const detalle = process.argv.includes("--detalle");
const bin = (name) => join(root, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);

/** Rutas que deben existir después del build (la web pública, el panel y las APIs). */
const RUTAS = [
  "/",
  "/cotizar",
  "/cotizar/[tipo]",
  "/politica-de-privacidad",
  "/terminos-y-condiciones",
  "/admin",
  "/admin/login",
  "/admin/solicitudes/[id]",
  "/admin/whatsapp",
  "/admin/whatsapp/[id]",
  "/api/chat",
  "/api/quote-requests",
  "/api/quotes",
  "/robots.txt",
  "/sitemap.xml",
];

/** Ejecuta un comando (argumentos fijos de este script, sin datos externos) y captura su salida. */
function run(cmd, args, cwd = root) {
  const linea = [cmd, ...args].map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)).join(" ");
  const r = spawnSync(linea, { cwd, encoding: "utf8", shell: true, env: { ...process.env, FORCE_COLOR: "0" } });
  return { ok: r.status === 0, salida: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/** Rutas del build de Next (manifiesto de rutas de la carpeta app). */
function verificarRutas() {
  const archivo = join(root, ".next", "app-path-routes-manifest.json");
  if (!existsSync(archivo)) return { ok: false, salida: "No existe .next/app-path-routes-manifest.json (¿falló el build?)" };
  const rutas = new Set(Object.values(JSON.parse(readFileSync(archivo, "utf8"))));
  const faltan = RUTAS.filter((r) => !rutas.has(r));
  return {
    ok: faltan.length === 0,
    salida: faltan.length ? `Faltan rutas: ${faltan.join(", ")}` : `${RUTAS.length} rutas presentes (de ${rutas.size} en el build)`,
  };
}

/** Ningún archivo versionado (o por versionar) contiene secretos ni archivos sensibles. */
function verificarSecretos() {
  const listar = (args) =>
    run("git", args)
      .salida.split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  const archivos = [...new Set([...listar(["ls-files"]), ...listar(["ls-files", "--others", "--exclude-standard"])])];
  // .env versionados: solo se permiten si TODAS sus variables son públicas (NEXT_PUBLIC_*),
  // como .env.production (existente desde el despliegue en Cloudflare) y .env.example.
  const envPrivado = (f) => {
    const nombres = readFileSync(join(root, f), "utf8")
      .split("\n")
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(\S*)/))
      .filter((m) => m && m[2] && !m[2].startsWith("PEGA_AQUI"))
      .map((m) => m[1]);
    return nombres.some((n) => !n.startsWith("NEXT_PUBLIC_") && !(f.endsWith(".env.example") && n === "ADMIN_DEV_EMAIL"));
  };
  const sensibles = archivos.filter(
    (f) => /(^|\/)\.dev\.vars$|\.pem$|\.key$/.test(f) || (/(^|\/)\.env(\.|$)/.test(f) && existsSync(join(root, f)) && envPrivado(f)),
  );
  const patrones = [
    ["verificador SCRAM", /SCRAM-SHA-256\$\d+:/],
    ["URL de base de datos con contraseña", /postgres(ql)?:\/\/[^\s:@/"'`$]+:[^\s@/"'`$]+@/i],
    ["clave secreta de Supabase", /sb_secret_[A-Za-z0-9_-]{10,}/],
    ["JWT", /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\./],
    ["token OAuth", /oauth_token\s*=/],
    ["token de Meta", /EAA[A-Za-z0-9]{40,}/],
    ["SIMULATION_KEY con valor", /SIMULATION_KEY\s*=\s*[A-Za-z0-9_-]{16,}/],
  ];
  const hallazgos = [];
  for (const f of archivos) {
    const ruta = join(root, f);
    if (!existsSync(ruta) || /\.(png|jpe?g|gif|ico|webp|woff2?|pdf)$/i.test(f)) continue;
    const texto = readFileSync(ruta, "utf8");
    for (const [tipo, re] of patrones) if (re.test(texto)) hallazgos.push(`${f}: ${tipo}`);
  }
  const problemas = [...sensibles.map((f) => `${f}: archivo sensible incluido`), ...hallazgos];
  return {
    ok: problemas.length === 0,
    salida: problemas.length ? problemas.join("\n") : `${archivos.length} archivos revisados, sin secretos`,
  };
}

const pasos = [
  ["TypeScript (web)", () => run(bin("tsc"), ["--noEmit", "-p", "."])],
  ["TypeScript (Worker WhatsApp)", () => run(bin("tsc"), ["--noEmit", "-p", "."], join(root, "workers", "whatsapp"))],
  ["ESLint", () => run(bin("eslint"), ["."])],
  ["Pruebas Fase 1 (WhatsApp)", () => run("node", ["scripts/run-tests.mjs"], join(root, "workers", "whatsapp"))],
  ["Pruebas web + prompt", () => run("node", ["tests/run-tests.mjs"])],
  ["Secretos y archivos sensibles", verificarSecretos],
  ...(rapido
    ? []
    : [
        ["Next build", () => run(bin("next"), ["build"])],
        ["Rutas de la web y /admin", verificarRutas],
        ["OpenNext (Cloudflare) build", () => run(bin("opennextjs-cloudflare"), ["build"])],
      ]),
];

const resumen = [];
for (const [nombre, fn] of pasos) {
  const t0 = Date.now();
  process.stdout.write(`… ${nombre}\r`);
  const { ok, salida } = fn();
  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  resumen.push({ nombre, ok, seg });
  console.log(`${ok ? "✓" : "✗"} ${nombre} (${seg} s)`);
  // Resúmenes útiles de las pruebas aunque pasen.
  const lineasClave = salida.split("\n").filter((l) => /escenarios ·|prompt \w+_|rutas presentes|archivos revisados/.test(l));
  for (const l of lineasClave) console.log(`    ${l.trim()}`);
  if (!ok || detalle) console.log(salida.split("\n").slice(-40).map((l) => `    | ${l}`).join("\n"));
}

const fallos = resumen.filter((r) => !r.ok);
console.log(`\n${fallos.length ? "✗ FALLÓ" : "✓ TODO PASA"}: ${resumen.length - fallos.length}/${resumen.length} pasos${rapido ? " (modo rápido, sin builds)" : ""}`);
process.exitCode = fallos.length ? 1 : 0;
