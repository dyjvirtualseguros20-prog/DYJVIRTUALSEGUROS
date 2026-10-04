import "server-only";

import { createPublicClient, createSessionClient } from "@/server/supabase";
import type { QuoteRequestRecord } from "@/types";
import { DuplicateReferenceError, type QuoteRequestStore } from "./types";

const TABLE = "quote_requests";

const COLUMNS =
  "id, reference, created_at, updated_at, insurance_type, full_name, identification, phone, whatsapp, email, city, status, form_data, advisor_notes, quote_amount, contacted_at";

interface Row {
  id: string;
  reference: string;
  created_at: string;
  updated_at: string;
  insurance_type: QuoteRequestRecord["insuranceType"];
  full_name: string;
  identification: string | null;
  phone: string;
  whatsapp: string;
  email: string;
  city: string | null;
  status: QuoteRequestRecord["status"];
  form_data: Record<string, unknown> | null;
  advisor_notes: string | null;
  quote_amount: number | string | null;
  contacted_at: string | null;
}

function toRecord(row: Row): QuoteRequestRecord {
  return {
    id: row.id,
    reference: row.reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    insuranceType: row.insurance_type,
    fullName: row.full_name,
    identification: row.identification,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    city: row.city,
    status: row.status,
    formData: row.form_data ?? {},
    advisorNotes: row.advisor_notes,
    // numeric llega como texto desde PostgREST.
    quoteAmount: row.quote_amount === null ? null : Number(row.quote_amount),
    contactedAt: row.contacted_at,
  };
}

/** Fin del día (exclusivo) para filtros por fecha, en hora de Colombia. */
const dayStart = (date: string) => `${date}T00:00:00-05:00`;
const nextDayStart = (date: string) => {
  const d = new Date(`${date}T00:00:00-05:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const supabaseStore: QuoteRequestStore = {
  /**
   * Registra la solicitud con la clave pública mediante la función
   * public.submit_quote_request(): solo puede INSERTAR (estado fijo
   * "nueva_solicitud"). El público no tiene ningún otro permiso sobre la tabla.
   */
  async create(input) {
    const { data, error } = await createPublicClient()
      .rpc("submit_quote_request", {
        p_reference: input.reference,
        p_insurance_type: input.insuranceType,
        p_full_name: input.fullName,
        p_identification: input.identification ?? "",
        p_phone: input.phone,
        p_whatsapp: input.whatsapp,
        p_email: input.email,
        p_city: input.city ?? "",
        p_form_data: input.formData,
      })
      .single<{ id: string; reference: string; status: QuoteRequestRecord["status"]; created_at: string }>();

    if (error) {
      if (error.code === "23505") throw new DuplicateReferenceError(error.message);
      throw new Error(`Supabase submit_quote_request: ${error.message}`);
    }
    return { id: data.id, reference: data.reference, status: data.status, createdAt: data.created_at };
  },

  /** Lectura con la sesión del asesor: RLS garantiza que solo un administrador vea filas. */
  async list(filters) {
    const supabase = await createSessionClient();
    let query = supabase.from(TABLE).select(COLUMNS).order("created_at", { ascending: false }).limit(500);
    if (filters.insuranceType) query = query.eq("insurance_type", filters.insuranceType);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.from) query = query.gte("created_at", dayStart(filters.from));
    if (filters.to) query = query.lt("created_at", nextDayStart(filters.to));
    const { data, error } = await query;
    if (error) throw new Error(`Supabase list: ${error.message}`);
    return (data as Row[]).map(toRecord);
  },

  async get(id) {
    if (!UUID.test(id)) return null;
    const supabase = await createSessionClient();
    const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase get: ${error.message}`);
    return data ? toRecord(data as Row) : null;
  },

  async update(id, patch) {
    if (!UUID.test(id)) return null;
    const supabase = await createSessionClient();
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        status: patch.status,
        advisor_notes: patch.advisorNotes,
        quote_amount: patch.quoteAmount,
        contacted_at: patch.contactedAt,
      })
      .eq("id", id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw new Error(`Supabase update: ${error.message}`);
    return data ? toRecord(data as Row) : null;
  },
};
