import "server-only";

/**
 * ⚠️ ALMACENAMIENTO LOCAL — SOLO PARA DESARROLLO ⚠️
 *
 * Guarda las solicitudes en .data/quote-requests.json para poder probar el flujo
 * completo sin Supabase. server/env.ts nunca lo activa en producción.
 * El archivo está en .gitignore porque contiene datos personales.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NO_ADVISOR, type QuoteRequestRecord } from "@/types";
import { DuplicateReferenceError, type QuoteRequestStore } from "./types";

const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "quote-requests.json");

async function readAll(): Promise<QuoteRequestRecord[]> {
  try {
    const rows = JSON.parse(await readFile(FILE, "utf8")) as QuoteRequestRecord[];
    // Registros creados antes de existir el campo `source`.
    return rows.map((r) => ({ ...r, source: r.source ?? "formulario" }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

// Las escrituras se encadenan para no pisarse entre peticiones simultáneas.
let queue: Promise<unknown> = Promise.resolve();

function mutate<T>(fn: (rows: QuoteRequestRecord[]) => T): Promise<T> {
  const run = queue.then(async () => {
    const rows = await readAll();
    const result = fn(rows);
    await mkdir(DIR, { recursive: true });
    const tmp = `${FILE}.tmp`;
    await writeFile(tmp, JSON.stringify(rows, null, 2), "utf8");
    await rename(tmp, FILE);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Inicio del día YYYY-MM-DD en hora de Colombia (UTC-5), en milisegundos. */
const dayStartMs = (date: string) => Date.parse(`${date}T00:00:00-05:00`);

export const localStore: QuoteRequestStore = {
  create(input) {
    return mutate((rows) => {
      if (rows.some((r) => r.reference === input.reference)) throw new DuplicateReferenceError(input.reference);
      const now = new Date().toISOString();
      const record: QuoteRequestRecord = {
        id: randomUUID(),
        reference: input.reference,
        createdAt: now,
        updatedAt: now,
        insuranceType: input.insuranceType,
        fullName: input.fullName,
        identification: input.identification,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        city: input.city,
        status: "nueva_solicitud",
        formData: input.formData,
        advisorNotes: null,
        quoteAmount: null,
        contactedAt: null,
        advisorId: input.advisorId,
        source: input.source,
      };
      rows.push(record);
      return { id: record.id, reference: record.reference, status: record.status, createdAt: record.createdAt };
    });
  },

  async list(filters) {
    const rows = await readAll();
    return rows
      .filter((r) => !filters.insuranceType || r.insuranceType === filters.insuranceType)
      .filter((r) => !filters.status || r.status === filters.status)
      .filter((r) =>
        !filters.advisorId ? true : filters.advisorId === NO_ADVISOR ? !r.advisorId : r.advisorId === filters.advisorId,
      )
      .filter((r) => !filters.from || Date.parse(r.createdAt) >= dayStartMs(filters.from))
      .filter((r) => !filters.to || Date.parse(r.createdAt) < dayStartMs(filters.to) + 86_400_000)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async get(id) {
    return (await readAll()).find((r) => r.id === id) ?? null;
  },

  update(id, patch) {
    return mutate((rows) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return null;
      Object.assign(row, patch, { updatedAt: new Date().toISOString() });
      return { ...row };
    });
  },
};
