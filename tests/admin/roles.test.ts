/**
 * PRUEBAS DE CUENTAS Y ROLES DEL PANEL (paso 2.4)
 * Reglas del panel en lib/staff.ts. La seguridad real la impone RLS en Supabase; esas
 * pruebas están en supabase/tests/0008_permisos.sql.
 */
import { canAssignConversation, isPrincipal, staffSessionFrom, type StaffRow } from "@/lib/staff";
import { prueba } from "../harness";

const USER = { id: "00000000-0000-4000-8000-000000000001", email: "prueba@example.com" };
const fila = (role: string, advisor_id: string | null, active = true): StaffRow => ({ role, advisor_id, active });

export async function pruebasRoles() {
  await prueba("Roles: sesión del panel según la cuenta de staff", async (check) => {
    const admin = staffSessionFrom(USER, fila("admin_principal", null));
    check(admin?.role === "admin_principal" && isPrincipal(admin), "admin_principal activo → administrador");
    check(
      staffSessionFrom(USER, fila("admin_principal", "cristian"))?.advisorId === null,
      "el administrador no queda atado a un asesor",
    );

    const asesor = staffSessionFrom(USER, fila("asesor", "prueba-a"));
    check(
      asesor?.role === "asesor" && asesor.advisorId === "prueba-a" && !isPrincipal(asesor),
      "asesor activo → asesor con su advisor_id",
    );
    check(asesor?.email === "prueba@example.com" && asesor.userId === USER.id, "conserva usuario y correo");

    check(staffSessionFrom(USER, null) === null, "sin cuenta de staff (registro público) → sin acceso");
    check(staffSessionFrom(USER, fila("asesor", "prueba-a", false)) === null, "asesor desactivado → sin acceso");
    check(
      staffSessionFrom(USER, fila("admin_principal", null, false)) === null,
      "administrador desactivado → sin acceso",
    );
    check(staffSessionFrom(USER, fila("asesor", null)) === null, "asesor sin advisor_id → sin acceso");
    check(staffSessionFrom(USER, fila("superadmin", null)) === null, "rol desconocido → sin acceso");
  });

  await prueba("Roles: asignación de conversaciones", async (check) => {
    const admin = staffSessionFrom(USER, fila("admin_principal", null))!;
    const asesor = staffSessionFrom(USER, fila("asesor", "prueba-a"))!;
    check(
      canAssignConversation(admin, "prueba-b") && canAssignConversation(admin, null),
      "el administrador asigna a cualquiera o a nadie",
    );
    check(canAssignConversation(asesor, "prueba-a"), "el asesor conserva su propia asignación");
    check(!canAssignConversation(asesor, "prueba-b"), "el asesor no puede pasarla a otro asesor");
    check(!canAssignConversation(asesor, null), "el asesor no puede soltarla (sin asesor)");
  });
}
