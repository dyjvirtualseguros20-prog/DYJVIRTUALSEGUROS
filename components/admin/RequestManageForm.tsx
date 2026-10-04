"use client";

import { useActionState, useState } from "react";
import { updateRequestAction, type UpdateState } from "@/app/admin/actions";
import { toLocalInputValue } from "@/lib/datetime";
import { cn, formatThousands } from "@/lib/format";
import { REQUEST_STATUSES, type RequestStatus } from "@/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

const control =
  "block w-full rounded-xl border bg-white px-4 text-base text-ink transition-colors focus:outline-none focus:ring-4";
const state = (error?: string) =>
  error
    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
    : "border-slate-200 hover:border-slate-300 focus:border-brand-500 focus:ring-brand-100";

interface Values {
  status: RequestStatus;
  advisorNotes: string;
  quoteAmount: string;
  contactedAt: string;
}

/** Gestión manual de la solicitud: estado, cotización, fecha de contacto y notas. */
export function RequestManageForm({ id, initial }: { id: string; initial: Values }) {
  const [result, action, pending] = useActionState<UpdateState, FormData>(updateRequestAction.bind(null, id), {});
  // Campos controlados: React 19 reinicia los no controlados después de cada envío.
  const [status, setStatus] = useState<RequestStatus>(initial.status);
  const [advisorNotes, setAdvisorNotes] = useState(initial.advisorNotes);
  const [quoteAmount, setQuoteAmount] = useState(initial.quoteAmount);
  const [contactedAt, setContactedAt] = useState(initial.contactedAt);
  const errors = result.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200">
      <div>
        <h2 className="text-base font-bold text-ink">Gestión de la solicitud</h2>
        <p className="mt-1 text-xs text-slate-500">La cotización se registra manualmente.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="status" className="text-sm font-semibold text-ink">
          Estado
        </label>
        <select
          id="status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as RequestStatus)}
          className={cn(control, state(errors.status), "h-12")}
        >
          {Object.entries(REQUEST_STATUSES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="quoteAmount" className="text-sm font-semibold text-ink">
          Valor de la cotización
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-semibold text-slate-400">
            $
          </span>
          <input
            id="quoteAmount"
            name="quoteAmount"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={formatThousands(quoteAmount)}
            onChange={(e) => setQuoteAmount(e.target.value.replace(/\D/g, "").slice(0, 14))}
            aria-invalid={errors.quoteAmount ? true : undefined}
            className={cn(control, state(errors.quoteAmount), "h-12 pl-8")}
          />
        </div>
        <p className="text-xs text-slate-500">En pesos colombianos (COP). Déjalo vacío si aún no hay cotización.</p>
        {errors.quoteAmount && <p className="text-sm text-red-600">{errors.quoteAmount}</p>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="contactedAt" className="text-sm font-semibold text-ink">
            Fecha de contacto
          </label>
          <button
            type="button"
            onClick={() => setContactedAt(toLocalInputValue(new Date().toISOString()))}
            className="text-xs font-semibold text-brand-700 hover:underline"
          >
            Usar fecha y hora actual
          </button>
        </div>
        <input
          id="contactedAt"
          name="contactedAt"
          type="datetime-local"
          value={contactedAt}
          onChange={(e) => setContactedAt(e.target.value)}
          aria-invalid={errors.contactedAt ? true : undefined}
          className={cn(control, state(errors.contactedAt), "h-12")}
        />
        {errors.contactedAt && <p className="text-sm text-red-600">{errors.contactedAt}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="advisorNotes" className="text-sm font-semibold text-ink">
          Notas del asesor
        </label>
        <textarea
          id="advisorNotes"
          name="advisorNotes"
          rows={6}
          maxLength={5000}
          value={advisorNotes}
          onChange={(e) => setAdvisorNotes(e.target.value)}
          placeholder="Ej.: Cliente prefiere cobertura completa. Enviar opciones el viernes."
          aria-invalid={errors.advisorNotes ? true : undefined}
          className={cn(control, state(errors.advisorNotes), "resize-y py-3 leading-relaxed")}
        />
        {errors.advisorNotes && <p className="text-sm text-red-600">{errors.advisorNotes}</p>}
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

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
