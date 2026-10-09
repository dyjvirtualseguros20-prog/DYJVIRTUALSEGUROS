// Empaqueta las pruebas (con los alias "@/…" y "server-only" del Worker) y las ejecuta con Node.
import { build } from "../../../node_modules/esbuild/lib/main.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outfile = join(root, ".test-build", "escenarios.mjs");

await build({
  entryPoints: [join(root, "test", "escenarios.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  tsconfig: join(root, "tsconfig.json"),
  alias: { "server-only": join(root, "src", "server-only.ts") },
  external: ["postgres"],
  logLevel: "warning",
});

await import(`file://${outfile.replace(/\\/g, "/")}`);
