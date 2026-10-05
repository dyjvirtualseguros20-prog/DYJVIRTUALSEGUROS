"use client";

import Link from "next/link";
import { useState } from "react";
import type { QuoteDraft } from "@/lib/chat";
import { getProduct } from "@/lib/insurance";
import type { QuoteRequestReceipt } from "@/types";
import { Icon } from "@/components/ui/Icon";

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
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });
  const product = getProduct(draft.insuranceType);
  const sent = state.status === "sent";

  async function submit() {
    if (!consent || state.status === "sending" || sent) return;
    setState({ status: "sending" });
    try {
      const response = await fetch("/api/quote-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insuranceType: draft.insuranceType,
          form: { ...draft.form, dataConsent: true },
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
          <label className="mt-4 flex items-start gap-2.5 text-xs leading-relaxed text-slate-600">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              aria-label="Acepto la Política de Tratamiento de Datos Personales"
              className="mt-0.5 size-4 shrink-0 accent-brand-600"
            />
            <span>
              He leído y acepto la{" "}
              <Link
                href="/politica-de-privacidad"
                target="_blank"
                className="font-semibold text-brand-700 underline underline-offset-2"
              >
                Política de Tratamiento de Datos Personales
              </Link>{" "}
              y autorizo el uso de mis datos para gestionar mi solicitud de cotización y contactarme por teléfono,
              WhatsApp o correo electrónico. (Obligatorio)
            </span>
          </label>

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
              disabled={!consent || state.status === "sending"}
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
