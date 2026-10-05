"use client";

import { useState, type FormEvent } from "react";
import { QUOTE_FORMS, emptyValues } from "@/lib/forms/quoteForms";
import { validateQuoteForm } from "@/lib/validation/quoteSchemas";
import type { InsuranceType } from "@/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ConsentChecks } from "@/components/legal/ConsentChecks";
import { FormField } from "./FormField";

export type FormValues = Record<string, string | boolean>;

/**
 * Formulario de cotización genérico: dibuja los campos de lib/forms/quoteForms.ts
 * y valida con lib/validation/quoteSchemas.ts. No permite enviar datos incompletos.
 */
export function QuoteForm({
  type,
  initialValues,
  serverErrors,
  formError,
  submitting,
  onSubmit,
}: {
  type: InsuranceType;
  initialValues?: FormValues;
  serverErrors?: Record<string, string>;
  formError?: string;
  submitting: boolean;
  onSubmit: (values: FormValues) => void;
}) {
  const [values, setValues] = useState<FormValues>(() => initialValues ?? emptyValues(type));
  const [errors, setErrors] = useState<Record<string, string>>(serverErrors ?? {});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const sections = QUOTE_FORMS[type];

  function revalidate(next: FormValues, onlyField?: string) {
    const result = validateQuoteForm(type, next);
    const all = result.success ? {} : result.errors;
    if (onlyField) {
      setErrors((prev) => {
        const copy = { ...prev };
        if (all[onlyField]) copy[onlyField] = all[onlyField];
        else delete copy[onlyField];
        // La fecha de regreso depende de la de salida.
        if (onlyField === "departureDate" && "returnDate" in prev) {
          if (all.returnDate) copy.returnDate = all.returnDate;
          else delete copy.returnDate;
        }
        return copy;
      });
    } else {
      setErrors(all);
    }
    return result;
  }

  function handleChange(name: string, value: string | boolean) {
    const next = { ...values, [name]: value };
    setValues(next);
    // Corrige el error en vivo solo si el campo ya se había tocado o se intentó enviar.
    if (touched[name] || submitted) revalidate(next, name);
  }

  function handleBlur(name: string) {
    setTouched((t) => ({ ...t, [name]: true }));
    if (values[name] !== "" || submitted) revalidate(values, name);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    const result = revalidate(values);
    if (!result.success) {
      // Lleva al usuario al primer campo con error.
      const firstKey = Object.keys(result.errors)[0];
      const el = document.getElementById(`campo-${firstKey}`) ?? document.querySelector(`[name="${firstKey}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
      }
      return;
    }
    onSubmit(values);
  }

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8" aria-describedby="nota-formulario">
      {sections.map((section, si) => (
        <fieldset key={section.title} className="space-y-5">
          <legend className="mb-5 flex items-center gap-3 text-base font-bold text-ink">
            <span className="flex size-7 items-center justify-center rounded-full bg-brand-600 text-xs text-white">
              {si + 1}
            </span>
            {section.title}
          </legend>
          <div className="grid gap-5 sm:grid-cols-2">
            {section.fields.map((field) => (
              <FormField
                key={field.name}
                field={field}
                value={String(values[field.name] ?? "")}
                error={errors[field.name]}
                onChange={handleChange}
                onBlur={handleBlur}
              />
            ))}
          </div>
        </fieldset>
      ))}

      {/* Autorizaciones de tratamiento de datos (Ley 1581 de 2012): A y B obligatorias, C opcional. */}
      <ConsentChecks
        values={{
          privacyAccepted: values.privacyAccepted === true,
          dataConsent: values.dataConsent === true,
          insurerConsent: values.insurerConsent === true,
        }}
        onChange={handleChange}
        errors={{ privacyAccepted: errors.privacyAccepted, dataConsent: errors.dataConsent }}
      />

      {(formError || (submitted && errorCount > 0)) && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100"
        >
          <Icon name="info" className="mt-0.5 size-5 shrink-0" />
          <p>
            {formError ??
              `Revisa ${errorCount === 1 ? "el campo marcado" : `los ${errorCount} campos marcados`} para continuar.`}
          </p>
        </div>
      )}

      <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:justify-between">
        <p id="nota-formulario" className="flex items-center gap-2 text-xs text-slate-500">
          <Icon name="lock" className="size-4" />
          Tus datos se usan solo para gestionar tu cotización.
        </p>
        <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? "Enviando…" : "Ver mis opciones"}
          {!submitting && <Icon name="arrowRight" className="size-5" />}
        </Button>
      </div>
    </form>
  );
}
