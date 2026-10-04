"use client";

import { useRef, useState } from "react";
import { submitQuoteRequest } from "@/services/clients";
import { ServiceError } from "@/services/config";
import type { InsuranceType, QuoteRequestReceipt } from "@/types";
import { QuoteForm, type FormValues } from "./QuoteForm";
import { QuoteConfirmation } from "./QuoteConfirmation";
import { QuoteLoading } from "./QuoteLoading";

type Step =
  | { name: "form"; values?: FormValues; fieldErrors?: Record<string, string>; error?: string }
  | { name: "loading"; values: FormValues }
  | { name: "done"; receipt: QuoteRequestReceipt };

/**
 * Flujo del cotizador: FORMULARIO → ENVIANDO → CONFIRMACIÓN.
 * La solicitud se registra a través de services/clients.ts (POST /api/quote-requests).
 * La cotización la hace un asesor desde /admin. Cuando exista cotización automática,
 * services/quotes.ts → getQuotes() y QuoteResults.tsx ya están listos para mostrar opciones.
 * Los datos del formulario solo viven en memoria (no se guardan en el navegador).
 */
export function QuoteWizard({ type }: { type: InsuranceType }) {
  const [step, setStep] = useState<Step>({ name: "form" });
  const [formKey, setFormKey] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  async function handleSubmit(values: FormValues) {
    setStep({ name: "loading", values });
    scrollTop();
    try {
      const receipt = await submitQuoteRequest(type, values);
      setStep({ name: "done", receipt });
    } catch (err) {
      const message =
        err instanceof ServiceError
          ? err.message
          : "Ocurrió un error inesperado. Inténtalo de nuevo o escríbenos por WhatsApp.";
      setStep({
        name: "form",
        values,
        fieldErrors: err instanceof ServiceError ? err.fieldErrors : undefined,
        error: message,
      });
      setFormKey((k) => k + 1);
    }
    scrollTop();
  }

  function restart() {
    setStep({ name: "form" });
    setFormKey((k) => k + 1);
    scrollTop();
  }

  return (
    <div ref={topRef} className="scroll-mt-28">
      {step.name === "form" && (
        <QuoteForm
          key={`${type}-${formKey}`}
          type={type}
          initialValues={step.values}
          serverErrors={step.fieldErrors}
          formError={step.error}
          submitting={false}
          onSubmit={handleSubmit}
        />
      )}
      {step.name === "loading" && <QuoteLoading />}
      {step.name === "done" && <QuoteConfirmation receipt={step.receipt} type={type} onRestart={restart} />}
    </div>
  );
}
