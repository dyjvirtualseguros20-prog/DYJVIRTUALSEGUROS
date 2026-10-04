const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** $1.850.000 */
export function formatCOP(value: number): string {
  return copFormatter.format(value).replace(/\s/g, "");
}

/** Agrega separadores de miles a una cadena de dígitos: "1850000" → "1.850.000". */
export function formatThousands(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

/** Une clases de CSS ignorando valores vacíos. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
