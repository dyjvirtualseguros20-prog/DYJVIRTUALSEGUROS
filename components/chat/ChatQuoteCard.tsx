"use client";

import { useState } from "react";
import type { QuoteDraft } from "@/lib/chat";
import { QUOTE_DISCLAIMER } from "@/lib/legal";
import { getProduct } from "@/lib/insurance";
import type { QuoteRequestReceipt } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { ConsentChecks, type ConsentValues } from "@/components/legal/ConsentChecks";

type State =
  | { status: "idle" | "sending" }
  | { status: "error"; message: string; fields?: string[] }
  | { status: "sent"; receipt: QuoteRequestReceipt };

/**
 * Tarjeta de confirmación de la solicitud preparada por el asistente.
 * El cliente revisa los datos, acepta la política y la envía al MISMO endpoint de los
 * formularios (/api/quote-requests), que valida todo de nuevo y asigna el asesor del enlace.
 */
export function ChatQuoteCard({
  draft,
  onSent,
  onCorrect,
}: {
  draft: QuoteDraft;
  onSent: (receipt: QuoteRequestReceipt) => void;
  onCorrect: () => void;
}) {
  const [consent, setConsent] = useState<ConsentValues>({
    privacyAccepted: false,
    dataConsent: false,
    insurerConsent: false,
  });
  // A y B son obligatorias; C (aseguradoras) es opcional.
  const canSend = consent.privacyAccepted && consent.dataConsent;
  const [state, setState] = useState<State>({ status: "idle" });
  const product = getProduct(draft.insuranceType);
  const sent = state.status === "sent";

  async function submit() {
    if (!canSend || state.status === "sending" || sent) return;
    setState({ status: "sending" });
    try {
      const response = await fetch("/api/quote-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insuranceType: draft.insuranceType,
          form: { ...draft.form, ...consent },
          source: "asistente_ia",
          notes: draft.notes,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        receipt?: QuoteRequestReceipt;
        error?: string;
        fieldErrors?: Record<string, string>;
      } | null;
      if (!response.ok || !payload?.receipt) {
        setState({
          status: "error",
          message: payload?.error ?? "No pudimos registrar tu solicitud. Inténtalo de nuevo o escríbenos por WhatsApp.",
          fields: payload?.fieldErrors ? Object.values(payload.fieldErrors) : undefined,
        });
        return;
      }
      setState({ status: "sent", receipt: payload.receipt });
      onSent(payload.receipt);
    } catch {
      setState({ status: "error", message: "No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo." });
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-brand-200">
      <p className="flex items-center gap-2 font-bold text-ink">
        <Icon name="shield" className="size-4 text-brand-600" />
        Solicitud de cotización · {product.name}
      </p>
      <dl className="mt-3 space-y-1.5">
        {draft.summary.map((item) => (
          <div key={item.label} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-2 text-xs">
            <dt className="text-slate-500">{item.label}</dt>
            <dd className="font-semibold wrap-anywhere text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>

      {sent ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
          <Icon name="check" className="size-4" strokeWidth={2.5} />
          Solicitud enviada · {state.receipt.requestId}
        </p>
      ) : (
        <>
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
            {QUOTE_DISCLAIMER}
          </p>
          <div className="mt-3">
            <ConsentChecks
              compact
              values={consent}
              onChange={(name, checked) => setConsent((c) => ({ ...c, [name]: checked }))}
            />
          </div>

          {state.status === "error" && (
            <div role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-800 ring-1 ring-red-200">
              <p className="font-semibold">{state.message}</p>
              {state.fields && (
                <ul className="mt-1 list-disc pl-4">
                  {state.fields.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={!canSend || state.status === "sending"}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state.status === "sending" ? "Enviando…" : "Enviar solicitud"}
            </button>
            <button
              type="button"
              onClick={onCorrect}
              className="rounded-full px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
            >
              Corregir datos
            </button>
          </div>
        </>
      )}
    </div>
  );
}
