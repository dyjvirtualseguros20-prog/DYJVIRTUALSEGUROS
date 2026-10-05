"use client";

import Link from "next/link";
import { CONSENT_TEXT } from "@/lib/legal";
import { cn } from "@/lib/format";

export type ConsentName = "privacyAccepted" | "dataConsent" | "insurerConsent";
export type ConsentValues = Record<ConsentName, boolean>;

/**
 * Casillas de autorización (Ley 1581 de 2012), separadas para que el cliente sepa qué acepta.
 * Se usan en los formularios de cotización y en la tarjeta del asesor virtual.
 */
export function ConsentChecks({
  values,
  onChange,
  errors = {},
  compact = false,
}: {
  values: ConsentValues;
  onChange: (name: ConsentName, checked: boolean) => void;
  errors?: Partial<Record<ConsentName, string>>;
  /** Versión reducida para la ventana del chat. */
  compact?: boolean;
}) {
  const box = compact
    ? "flex items-start gap-2.5 text-xs leading-relaxed text-slate-600"
    : "flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600";
  const input = cn("mt-0.5 shrink-0 cursor-pointer rounded accent-brand-600", compact ? "size-4" : "size-5");
  const link = "font-semibold text-brand-700 underline underline-offset-2";
  const required = <span className="font-semibold text-ink">(Obligatorio)</span>;

  const item = (name: ConsentName, label: React.ReactNode, ariaLabel: string) => (
    <div key={name}>
      <label className={box}>
        <input
          id={`campo-${name}`}
          type="checkbox"
          name={name}
          checked={values[name]}
          onChange={(e) => onChange(name, e.target.checked)}
          aria-label={ariaLabel}
          aria-invalid={errors[name] ? true : undefined}
          aria-describedby={errors[name] ? `campo-${name}-error` : undefined}
          className={input}
        />
        <span>{label}</span>
      </label>
      {errors[name] && (
        <p id={`campo-${name}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-600 sm:text-sm">
          {errors[name]}
        </p>
      )}
    </div>
  );

  const t = CONSENT_TEXT;
  return (
    <fieldset className={compact ? "space-y-2.5" : "space-y-3"}>
      <legend className="sr-only">Autorizaciones de tratamiento de datos</legend>
      {item(
        "privacyAccepted",
        <>
          {t.privacyAccepted.before}{" "}
          <Link href="/politica-de-privacidad" target="_blank" className={link}>
            {t.privacyAccepted.policy}
          </Link>{" "}
          {t.privacyAccepted.middle}{" "}
          <Link href="/terminos-y-condiciones" target="_blank" className={link}>
            {t.privacyAccepted.terms}
          </Link>
          {t.privacyAccepted.after} {required}
        </>,
        "He leído la Política de Tratamiento de Datos y los Términos y Condiciones",
      )}
      {item(
        "dataConsent",
        <>
          {t.dataConsent.text} {required}
        </>,
        "Autorizo el uso de mis datos para gestionar mi cotización",
      )}
      {item(
        "insurerConsent",
        <>
          {t.insurerConsent.text}{" "}
          <span className="block pt-0.5 text-[0.92em] text-slate-500">{t.insurerConsent.note}</span>
        </>,
        "Autorizo compartir los datos indispensables con aseguradoras (opcional)",
      )}
    </fieldset>
  );
}
