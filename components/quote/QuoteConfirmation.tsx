"use client";

import { getProduct } from "@/lib/insurance";
import { QUOTE_DISCLAIMER } from "@/lib/legal";
import { whatsappUrl } from "@/lib/whatsapp";
import { REQUEST_STATUSES, type InsuranceType, type QuoteRequestReceipt } from "@/types";
import { Button, ExternalButton } from "@/components/ui/Button";
import { Icon, WhatsAppIcon } from "@/components/ui/Icon";

const NEXT_STEPS = [
  { title: "Revisamos tu solicitud", text: "Un asesor verifica los datos que nos enviaste." },
  { title: "Preparamos tu cotización", text: "Buscamos alternativas que se ajusten a lo que necesitas." },
  { title: "Te contactamos", text: "Te compartimos las opciones y resolvemos tus dudas." },
];

/** Pantalla de confirmación tras registrar la solicitud. */
export function QuoteConfirmation({
  receipt,
  type,
  whatsappNumber,
  onRestart,
}: {
  receipt: QuoteRequestReceipt;
  type: InsuranceType;
  /** WhatsApp del asesor de la visita (o el de la empresa). */
  whatsappNumber: string;
  onRestart: () => void;
}) {
  const productName = getProduct(type).name.toLowerCase();
  const advisorMessage = `Hola, acabo de solicitar una cotización de ${productName} en la página web (referencia ${receipt.requestId}). Quiero hablar con un asesor.`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 rounded-2xl bg-brand-50 p-5 ring-1 ring-brand-100 sm:flex-row sm:items-center sm:p-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
          <Icon name="check" className="size-6" strokeWidth={2.5} />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-ink">¡Recibimos tu solicitud!</h2>
          <p className="text-sm text-slate-600">
            Referencia <strong className="font-mono text-ink">{receipt.requestId}</strong> · Estado:{" "}
            {REQUEST_STATUSES[receipt.status]}. Guarda esta referencia por si necesitas consultarnos.
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-extrabold text-ink">¿Qué sigue?</h3>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {NEXT_STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl bg-slate-50 p-5">
              <span className="flex size-8 items-center justify-center rounded-full bg-white text-sm font-extrabold text-brand-600 ring-1 ring-brand-100">
                {i + 1}
              </span>
              <p className="mt-3 font-bold text-ink">{step.title}</p>
              <p className="mt-1 text-sm text-slate-600">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">{QUOTE_DISCLAIMER}</p>
      </div>

      <div className="flex flex-col items-center gap-5 rounded-3xl bg-brand-900 p-6 text-center sm:p-10">
        <div>
          <h3 className="text-xl font-extrabold text-white sm:text-2xl">¿Quieres agilizar tu cotización?</h3>
          <p className="mt-2 text-brand-100/80">Escríbenos por WhatsApp con tu referencia y un asesor te atenderá.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <ExternalButton href={whatsappUrl(advisorMessage, whatsappNumber)} variant="whatsapp" size="lg">
            <WhatsAppIcon className="size-5" />
            Hablar con un asesor
          </ExternalButton>
          <Button variant="light" size="lg" onClick={onRestart}>
            Hacer otra solicitud
          </Button>
        </div>
      </div>
    </div>
  );
}
