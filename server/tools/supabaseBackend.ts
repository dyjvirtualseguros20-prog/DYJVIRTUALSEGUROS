/**
 * Auditoría y políticas del ToolRunner sobre Supabase con la SESIÓN de la persona (panel /admin):
 *   - auditoría con public.log_staff_action(): la base de datos pone el actor (admin/asesor) a
 *     partir de la sesión; nadie puede registrar acciones a nombre de otro;
 *   - políticas de public.tool_policies (RLS: solo staff activo las lee).
 * Sin dependencias de Next.js: lo usan staffRunner.ts y las pruebas en vivo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditSink } from "./audit";
import type { PolicySource } from "./runner";

export function supabaseAuditSink(supabase: SupabaseClient): AuditSink {
  return {
    async write(e) {
      const { error } = await supabase.rpc("log_staff_action", {
        p_action: e.action,
        p_level: e.level,
        p_resource_type: e.resourceType,
        p_resource_id: e.resourceId,
        p_outcome: e.outcome,
        p_reason: e.reason,
        p_error_message: e.errorMessage,
        p_idempotency_key: e.idempotencyKey,
        p_metadata: e.metadata,
      });
      if (error) throw new Error(`auditoría: ${error.message}`);
    },
  };
}

export function supabasePolicies(supabase: SupabaseClient): PolicySource {
  return {
    async get(action) {
      const { data, error } = await supabase
        .from("tool_policies")
        .select("enabled, requires_human")
        .eq("action", action)
        .maybeSingle<{ enabled: boolean; requires_human: boolean }>();
      if (error) throw new Error(`políticas: ${error.message}`);
      return data ? { enabled: data.enabled, requiresHuman: data.requires_human } : null;
    },
  };
}
