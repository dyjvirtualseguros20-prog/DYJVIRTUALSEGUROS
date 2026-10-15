"use client";

import { useActionState, useState } from "react";
import { updateConversationAction, type UpdateState } from "@/app/admin/actions";
import { CONVERSATION_STATUSES, type Advisor, type ConversationStatus } from "@/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

const control =
  "block h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-ink transition-colors hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none";

interface Props {
  id: string;
  advisors: Advisor[];
  initial: { status: ConversationStatus; assignedAdvisorId: string | null };
  takenBy: string | null;
  /** Solo el administrador reasigna; un asesor ve su asignación fija. */
  canReassign: boolean;
}

/** Tomar la conversación, asignarla a un asesor y cambiar su estado. */
export function ConversationManageForm({ id, advisors, initial, takenBy, canReassign }: Props) {
  const [result, action, pending] = useActionState<UpdateState, FormData>(updateConversationAction.bind(null, id), {});
  const [status, setStatus] = useState<ConversationStatus>(initial.status);
  const [advisorId, setAdvisorId] = useState(initial.assignedAdvisorId ?? "");

  return (
    <form action={action} className="space-y-5 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200">
      <div>
        <h2 className="text-base font-bold text-ink">Gestión de la conversación</h2>
        <p className="mt-1 text-xs text-slate-500">
          {takenBy ? `La tomó ${takenBy}.` : "Nadie ha tomado esta conversación todavía."} Mientras esté con un asesor o
          esperando asesor, la IA no responde.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="assignedAdvisorId" className="text-sm font-semibold text-ink">
          Asesor asignado
        </label>
        <select
          id="assignedAdvisorId"
          name={canReassign ? "assignedAdvisorId" : undefined}
          value={advisorId}
          onChange={(e) => setAdvisorId(e.target.value)}
          disabled={!canReassign}
          className={control}
        >
          <option value="">Sin asesor</option>
          {advisors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.active ? "" : " (inactivo)"}
            </option>
          ))}
        </select>
        {/* Un select deshabilitado no se envía: el asesor envía su asignación actual. */}
        {!canReassign && <input type="hidden" name="assignedAdvisorId" value={advisorId} />}
      </div>

      <div className="space-y-2">
        <label htmlFor="status" className="text-sm font-semibold text-ink">
          Estado
        </label>
        <select
          id="status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ConversationStatus)}
          className={control}
        >
          {Object.entries(CONVERSATION_STATUSES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">«Atendida por la IA» devuelve la conversación al asistente.</p>
      </div>

      {result.error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <Icon name="info" className="mt-0.5 size-4 shrink-0" />
          {result.error}
        </p>
      )}
      {result.ok && !pending && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700"
        >
          <Icon name="check" className="size-4" strokeWidth={2.5} />
          Cambios guardados.
        </p>
      )}

      <div className="grid gap-3">
        <Button
          type="submit"
          name="take"
          value="1"
          size="lg"
          className="w-full"
          disabled={pending}
          onClick={() => setStatus("asesor")}
        >
          {pending ? "Guardando…" : "Tomar conversación"}
        </Button>
        <Button type="submit" name="take" value="0" size="lg" variant="secondary" className="w-full" disabled={pending}>
          Guardar estado y asesor
        </Button>
      </div>
    </form>
  );
}
