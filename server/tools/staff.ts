/**
 * ACCIONES DEL PANEL /admin (paso 2.5)
 * ────────────────────────────────────
 * Lo que un administrador o un asesor cambia desde el panel pasa por el ToolRunner: validación,
 * política (tool_policies) y un evento de auditoría con su identidad, también cuando se le niega.
 *
 * Se ejecutan con la SESIÓN de la persona (RLS del paso 2.4): el ToolRunner no da permisos.
 * Si RLS no deja ver o cambiar el recurso, la base devuelve 0 filas y la acción queda DENEGADA.
 */
import { z } from "zod";
import { canAssignConversation, type StaffSession } from "@/lib/staff";
import {
  CONVERSATION_STATUS_KEYS,
  REQUEST_STATUS_KEYS,
  type ConversationStatus,
  type ConversationUpdate,
  type QuoteRequestUpdate,
  type RequestStatus,
} from "@/types";
import type { Actor, ToolDefinition } from "./runner";

/** Operaciones reales que usan las herramientas (con la sesión de la persona). */
export interface StaffToolDeps {
  updateQuoteRequest(id: string, patch: QuoteRequestUpdate): Promise<unknown | null>;
  updateConversation(id: string, patch: ConversationUpdate): Promise<boolean>;
}

/** La persona de la sesión como actor de la auditoría. */
export function actorFromSession(session: StaffSession): Actor {
  return {
    type: session.role === "admin_principal" ? "admin" : "asesor",
    id: session.userId,
    channel: "admin",
    // getAdminSession() solo devuelve cuentas activas; la base de datos lo vuelve a exigir.
    active: true,
    advisorId: session.advisorId,
  };
}

const id = z.string().min(1).max(64);

/* ───────────────────────────── Gestión de una solicitud ───────────────────────────── */

const requestInput = z.object({
  id,
  patch: z.object({
    status: z.enum(REQUEST_STATUS_KEYS as [RequestStatus, ...RequestStatus[]]),
    advisorNotes: z.string().max(5000).nullable(),
    quoteAmount: z.number().int().min(0).nullable(),
    contactedAt: z.string().max(40).nullable(),
  }),
});

export const actualizarGestionSolicitud: ToolDefinition<z.infer<typeof requestInput>, true, StaffToolDeps> = {
  name: "solicitud.actualizar_gestion",
  level: "ejecutar",
  actors: ["admin", "asesor"],
  input: requestInput,
  resource: (i) => ({ type: "quote_request", id: i.id }),
  async execute({ deps }, i) {
    const updated = await deps.updateQuoteRequest(i.id, i.patch);
    return updated ? true : { denied: "sin_acceso_o_no_existe" };
  },
  // Solo QUÉ se cambió, nunca el contenido de las notas.
  summarize: (i) => ({
    status: i.patch.status,
    anotado: Boolean(i.patch.advisorNotes),
    valorCotizado: i.patch.quoteAmount !== null,
    fechaContacto: Boolean(i.patch.contactedAt),
  }),
};

/* ─────────────────────────── Gestión de una conversación ─────────────────────────── */

const conversationInput = z.object({
  id,
  patch: z.object({
    status: z.enum(CONVERSATION_STATUS_KEYS as [ConversationStatus, ...ConversationStatus[]]),
    assignedAdvisorId: z
      .string()
      .regex(/^[a-z0-9-]{1,30}$/)
      .nullable(),
    take: z.boolean(),
  }),
});

export const gestionarConversacion: ToolDefinition<z.infer<typeof conversationInput>, true, StaffToolDeps> = {
  name: "conversacion.gestionar",
  level: "ejecutar",
  actors: ["admin", "asesor"],
  input: conversationInput,
  resource: (i) => ({ type: "chat_conversation", id: i.id }),
  // Un asesor no puede pasar la conversación a otro ni soltarla (RLS también lo impide).
  authorize: ({ actor }, i) =>
    canAssignConversation(
      {
        userId: actor.id,
        email: "",
        role: actor.type === "admin" ? "admin_principal" : "asesor",
        advisorId: actor.advisorId ?? null,
      },
      i.patch.assignedAdvisorId,
    )
      ? null
      : "reasignacion_no_permitida",
  async execute({ deps }, i) {
    return (await deps.updateConversation(i.id, i.patch)) ? true : { denied: "sin_acceso_o_no_existe" };
  },
  summarize: (i) => ({ status: i.patch.status, assignedAdvisorId: i.patch.assignedAdvisorId, take: i.patch.take }),
};
