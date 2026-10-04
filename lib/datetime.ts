/** Fechas del panel en hora de Colombia, sin depender de la zona horaria del servidor. */
export const TIME_ZONE = "America/Bogota";
/** Colombia no tiene horario de verano: UTC-5 todo el año. */
const OFFSET = "-05:00";

const dateTimeFmt = new Intl.DateTimeFormat("es-CO", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** 02 oct 2026, 9:30 a. m. */
export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

/** 02 oct 2026 */
export function formatShortDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** "1990-05-17" → "17 may 1990" (fechas sin hora, como la de nacimiento). */
export function formatPlainDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return formatShortDate(`${value}T12:00:00${OFFSET}`);
}

/** ISO → valor para <input type="datetime-local"> en hora de Colombia ("2026-10-02T09:30"). */
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Valor de <input type="datetime-local"> (hora de Colombia) → ISO UTC. */
export function fromLocalInputValue(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}:00${OFFSET}`);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}
