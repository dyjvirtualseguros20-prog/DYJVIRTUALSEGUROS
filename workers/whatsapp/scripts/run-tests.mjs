// Empaqueta las pruebas del Worker (con los alias "@/…" y "server-only") y las ejecuta con Node:
//   test/escenarios.ts → Súper Asesor por WhatsApp (Fase 1)
//   test/fila.ts       → fila ordenada por cliente (paso 2.3)
import { build } from "../../../node_modules/esbuild/lib/main.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

for (const name of ["escenarios", "fila"]) {
  const outfile = join(root, ".test-build", `${name}.mjs`);
  await build({
    entryPoints: [join(root, "test", `${name}.ts`)],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    tsconfig: join(root, "tsconfig.json"),
    alias: { "server-only": join(root, "src", "server-only.ts") },
    external: ["postgres", "cloudflare:workers"],
    logLevel: "warning",
  });
  await import(pathToFileURL(outfile).href);
}
