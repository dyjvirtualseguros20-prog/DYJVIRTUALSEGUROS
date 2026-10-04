/**
 * Origen de datos de la capa de servicios.
 *
 *   "mock" → el navegador usa los datos simulados de lib/mock (por defecto).
 *   "api"  → el navegador llama a POST /api/quotes (ruta del servidor de esta app),
 *            que a su vez hablará con TU API propia (ver server/quoteProvider.ts).
 *
 * Se cambia con la variable NEXT_PUBLIC_QUOTES_SOURCE en .env.local.
 */
export type DataSource = "mock" | "api";

export const DATA_SOURCE: DataSource = process.env.NEXT_PUBLIC_QUOTES_SOURCE === "api" ? "api" : "mock";

/** Error con un mensaje apto para mostrar al usuario. */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
