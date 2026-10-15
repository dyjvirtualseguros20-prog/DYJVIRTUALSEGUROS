/**
 * CUENTAS Y ROLES DEL PANEL /admin (tabla public.staff_users, migración 0008)
 * ───────────────────────────────────────────────────────────────────────────
 *   admin_principal → ve y gestiona todo.
 *   asesor          → solo lo asignado a su advisor_id (solicitudes atribuidas a él y
 *                     conversaciones asignadas a él).
 *
 * La seguridad la impone la base de datos (RLS). Estas reglas solo deciden qué se
 * muestra en el panel y rechazan antes lo que la base de datos rechazaría igual.
 */

export const STAFF_ROLES = {
  admin_principal: "Administrador",
  asesor: "Asesor",
} as const;

export type StaffRole = keyof typeof STAFF_ROLES;

export interface StaffSession {
  userId: string;
  email: string;
  role: StaffRole;
  /** Asesor de la cuenta (obligatorio para el rol asesor). */
  advisorId: string | null;
}

/** Fila de staff_users tal como la devuelve Supabase. */
export interface StaffRow {
  role: string;
  advisor_id: string | null;
  active: boolean;
}

/**
 * Sesión del panel a partir de la cuenta de staff. null = sin acceso:
 * sin cuenta, cuenta desactivada, rol desconocido o asesor sin advisor_id.
 */
export function staffSessionFrom(
  user: { id: string; email?: string | null },
  row: StaffRow | null,
): StaffSession | null {
  if (!row?.active) return null;
  if (row.role !== "admin_principal" && row.role !== "asesor") return null;
  if (row.role === "asesor" && !row.advisor_id) return null;
  return {
    userId: user.id,
    email: user.email ?? "",
    role: row.role,
    advisorId: row.role === "asesor" ? row.advisor_id : null,
  };
}

export const isPrincipal = (session: StaffSession) => session.role === "admin_principal";

/** ¿Puede dejar la conversación asignada a `advisorId`? El asesor solo a sí mismo. */
export function canAssignConversation(session: StaffSession, advisorId: string | null): boolean {
  return isPrincipal(session) || (advisorId !== null && advisorId === session.advisorId);
}
