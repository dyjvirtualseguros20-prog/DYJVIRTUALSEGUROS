"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { fromLocalInputValue } from "@/lib/datetime";
import { listAdvisors } from "@/server/advisors";
import { requireAdmin, signIn, signOut } from "@/server/auth";
import { actorFromSession, actualizarGestionSolicitud, gestionarConversacion } from "@/server/tools/staff";
import { getStaffToolRunner, staffToolDeps } from "@/server/tools/staffRunner";
import { CONVERSATION_STATUS_KEYS, REQUEST_STATUS_KEYS, type ConversationStatus, type RequestStatus } from "@/types";

/* ─────────────────────────────── Sesión ─────────────────────────────── */

export interface LoginState {
  error?: string;
  email?: string;
}

/** Solo se permiten redirecciones internas del panel. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Ingresa tu correo y tu contraseña.", email };

  const result = await signIn(email, password);
  if (!result.ok) return { error: result.error, email };
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect("/admin/login");
}

/* ─────────────────────────── Gestión de solicitudes ─────────────────────────── */

const updateSchema = z.object({
  status: z.enum(REQUEST_STATUS_KEYS as [RequestStatus, ...RequestStatus[]], "Selecciona un estado válido."),
  advisorNotes: z.string().trim().max(5000, "Las notas pueden tener máximo 5000 caracteres."),
  quoteAmount: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length <= 14, "El valor es demasiado alto."),
  contactedAt: z
    .string()
    .trim()
    .refine((v) => v === "" || fromLocalInputValue(v) !== null, "Fecha de contacto no válida."),
});

export interface UpdateState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  savedAt?: number;
}

export async function updateRequestAction(id: string, _prev: UpdateState, formData: FormData): Promise<UpdateState> {
  const parsed = updateSchema.safeParse({
    status: formData.get("status") ?? "",
    advisorNotes: formData.get("advisorNotes") ?? "",
    quoteAmount: formData.get("quoteAmount") ?? "",
    contactedAt: formData.get("contactedAt") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Revisa los campos marcados.", fieldErrors };
  }

  const { status, advisorNotes, quoteAmount, contactedAt } = parsed.data;
  // La acción pasa por el ToolRunner (política + auditoría) con la sesión de la persona (RLS).
  const session = await requireAdmin();
  const result = await (
    await getStaffToolRunner()
  ).run(actualizarGestionSolicitud, actorFromSession(session), staffToolDeps, {
    id,
    patch: {
      status,
      advisorNotes: advisorNotes || null,
      quoteAmount: quoteAmount ? Number(quoteAmount) : null,
      contactedAt: contactedAt ? fromLocalInputValue(contactedAt) : null,
    },
  });
  if (result.status === "error") {
    unstable_rethrow(result.error); // deja pasar la redirección a /admin/login si la sesión expiró
    console.error("[admin/update]", result.error);
    return { error: "No se pudieron guardar los cambios. Inténtalo de nuevo." };
  }
  if (result.status !== "ok") return { error: "La solicitud no existe o no tienes permiso para modificarla." };

  revalidatePath("/admin");
  revalidatePath(`/admin/solicitudes/${id}`);
  return { ok: true, savedAt: Date.now() };
}

/* ─────────────────────────── Conversaciones de WhatsApp ─────────────────────────── */

const conversationSchema = z.object({
  status: z.enum(
    CONVERSATION_STATUS_KEYS as [ConversationStatus, ...ConversationStatus[]],
    "Selecciona un estado válido.",
  ),
  assignedAdvisorId: z.string().trim().max(30),
  take: z.enum(["0", "1"]),
});

export async function updateConversationAction(
  id: string,
  _prev: UpdateState,
  formData: FormData,
): Promise<UpdateState> {
  const parsed = conversationSchema.safeParse({
    status: formData.get("status") ?? "",
    assignedAdvisorId: formData.get("assignedAdvisorId") ?? "",
    take: formData.get("take") ?? "0",
  });
  if (!parsed.success) return { error: "Revisa los datos del formulario." };

  const { assignedAdvisorId, take } = parsed.data;
  // "Tomar la conversación" siempre la deja en manos de un asesor.
  const status = take === "1" ? "asesor" : parsed.data.status;
  // El asesor asignado debe existir (la base de datos también lo exige).
  const advisors = await listAdvisors();
  if (assignedAdvisorId && !advisors.some((a) => a.id === assignedAdvisorId)) return { error: "Ese asesor no existe." };
  // ToolRunner (política + auditoría) con la sesión de la persona (RLS).
  const session = await requireAdmin();
  const result = await (
    await getStaffToolRunner()
  ).run(gestionarConversacion, actorFromSession(session), staffToolDeps, {
    id,
    patch: { status, assignedAdvisorId: assignedAdvisorId || null, take: take === "1" },
  });
  if (result.status === "error") {
    unstable_rethrow(result.error);
    console.error("[admin/conversacion]", result.error);
    const error = result.error;
    return {
      error:
        error instanceof Error && error.message.includes("otra conversación abierta")
          ? error.message
          : "No se pudieron guardar los cambios. Inténtalo de nuevo.",
    };
  }
  if (result.status !== "ok") return { error: "La conversación no existe o no tienes permiso para hacer ese cambio." };

  revalidatePath("/admin/whatsapp");
  revalidatePath(`/admin/whatsapp/${id}`);
  return { ok: true, savedAt: Date.now() };
}
