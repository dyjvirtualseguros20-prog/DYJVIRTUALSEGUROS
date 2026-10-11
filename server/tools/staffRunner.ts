import "server-only";

/**
 * ToolRunner del panel /admin con la SESIÓN de la persona (RLS del paso 2.4): auditoría con
 * log_staff_action() y políticas de tool_policies (supabaseBackend.ts). En modo desarrollo sin
 * Supabase, la auditoría va al registro del servidor.
 */
import type { AuditSink } from "./audit";
import { createToolRunner } from "./runner";
import type { StaffToolDeps } from "./staff";
import { supabaseAuditSink, supabasePolicies } from "./supabaseBackend";
import { updateConversation } from "../conversations";
import { getBackend } from "../env";
import { updateQuoteRequest } from "../quoteRequests";
import { createSessionClient } from "../supabase";

/** Operaciones reales de las herramientas del panel (todas exigen sesión y respetan RLS). */
export const staffToolDeps: StaffToolDeps = { updateQuoteRequest, updateConversation };

export async function getStaffToolRunner() {
  if (getBackend() !== "supabase") {
    const audit: AuditSink = {
      async write(e) {
        console.info("[auditoria:local]", e.action, e.outcome, e.reason ?? "");
      },
    };
    return createToolRunner({ audit });
  }
  const supabase = await createSessionClient();
  return createToolRunner({ audit: supabaseAuditSink(supabase), policies: supabasePolicies(supabase) });
}
