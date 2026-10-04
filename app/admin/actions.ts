"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { fromLocalInputValue } from "@/lib/datetime";
import { signIn, signOut } from "@/server/auth";
import { updateQuoteRequest } from "@/server/quoteRequests";
import { REQUEST_STATUS_KEYS, type RequestStatus } from "@/types";

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
  try {
    // updateQuoteRequest() exige sesión de asesor antes de modificar nada.
    const updated = await updateQuoteRequest(id, {
      status,
      advisorNotes: advisorNotes || null,
      quoteAmount: quoteAmount ? Number(quoteAmount) : null,
      contactedAt: contactedAt ? fromLocalInputValue(contactedAt) : null,
    });
    if (!updated) return { error: "La solicitud no existe o no tienes permiso para modificarla." };
  } catch (error) {
    unstable_rethrow(error); // deja pasar la redirección a /admin/login si la sesión expiró
    console.error("[admin/update]", error);
    return { error: "No se pudieron guardar los cambios. Inténtalo de nuevo." };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/solicitudes/${id}`);
  return { ok: true, savedAt: Date.now() };
}
