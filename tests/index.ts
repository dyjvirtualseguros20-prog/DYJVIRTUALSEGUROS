/** Pruebas de la web (red de seguridad de la Fase 2). Se ejecutan con: node tests/run-tests.mjs */
import { pruebasRouter } from "./ai/router.test";
import { informe } from "./harness";
import { pruebaLineaBase } from "./prompt/linea-base";
import { pruebasAdaptadorWeb } from "./web/adaptador-web.test";

const archivoLineaBase = process.env.LINEA_BASE_PROMPT ?? "tests/linea-base-prompt.json";

await pruebasAdaptadorWeb();
await pruebasRouter();
await pruebaLineaBase(archivoLineaBase, process.argv.includes("--registrar-linea-base"));

if (!informe()) process.exitCode = 1;
