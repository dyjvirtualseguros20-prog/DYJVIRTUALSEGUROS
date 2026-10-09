/** Mini arnés de pruebas (sin dependencias): escenarios con comprobaciones y un informe final. */

export type Check = (cond: boolean, label: string) => void;

const results: Array<{ nombre: string; ok: boolean; detalle: string[] }> = [];

export async function prueba(nombre: string, fn: (check: Check) => Promise<void>) {
  const detalle: string[] = [];
  let ok = true;
  const check: Check = (cond, label) => {
    if (!cond) ok = false;
    detalle.push(`${cond ? "✓" : "✗"} ${label}`);
  };
  try {
    await fn(check);
  } catch (error) {
    ok = false;
    detalle.push(`✗ excepción: ${error instanceof Error ? error.message : String(error)}`);
  }
  results.push({ nombre, ok, detalle });
}

/** Imprime el informe y devuelve true si todo pasó. */
export function informe(): boolean {
  for (const r of results) {
    console.log(`${r.ok ? "PASA " : "FALLA"}  ${r.nombre}`);
    for (const d of r.detalle) if (!r.ok || process.env.DETALLE) console.log(`         ${d}`);
  }
  const checks = results.flatMap((r) => r.detalle);
  const fallos = checks.filter((d) => d.startsWith("✗")).length;
  console.log(
    `\n${results.filter((r) => r.ok).length}/${results.length} escenarios · ${checks.length - fallos}/${checks.length} comprobaciones`,
  );
  return fallos === 0;
}
