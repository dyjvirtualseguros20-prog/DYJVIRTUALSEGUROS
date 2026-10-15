// Empaqueta las pruebas de la web y las ejecuta con Node.
// - "@/server/ai/workersAi" se reemplaza por tests/fakes/workersAi.ts (sin Cloudflare ni Workers AI).
// - "server-only" se reemplaza por un módulo vacío (las pruebas se ejecutan en el servidor).
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outfile = join(root, "tests", ".test-build", "pruebas-web.mjs");

const sustituirIA = {
  name: "sustituir-workers-ai",
  setup(b) {
    b.onResolve({ filter: /^@\/server\/ai\/workersAi$/ }, () => ({ path: join(root, "tests", "fakes", "workersAi.ts") }));
  },
};

await build({
  entryPoints: [join(root, "tests", "index.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  tsconfig: join(root, "tsconfig.json"),
  alias: { "server-only": join(root, "workers", "whatsapp", "src", "server-only.ts") },
  plugins: [sustituirIA],
  logLevel: "warning",
});

process.chdir(root);
await import(pathToFileURL(outfile).href);
