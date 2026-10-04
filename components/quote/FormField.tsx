"use client";

import type { FieldDef } from "@/lib/forms/quoteForms";
import { cn, formatThousands } from "@/lib/format";
import { todayISO } from "@/lib/validation/quoteSchemas";
import { Icon } from "@/components/ui/Icon";

const inputBase =
  "block w-full rounded-xl border bg-white px-4 text-base text-ink placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-4";

const inputState = (hasError: boolean) =>
  hasError
    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
    : "border-slate-200 hover:border-slate-300 focus:border-brand-500 focus:ring-brand-100";

export function FormField({
  field,
  value,
  error,
  onChange,
  onBlur,
}: {
  field: FieldDef;
  value: string;
  error?: string;
  onChange: (name: string, value: string) => void;
  onBlur: (name: string) => void;
}) {
  const id = `campo-${field.name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, field.hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name: field.name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    required: true,
    onBlur: () => onBlur(field.name),
  };

  let control: React.ReactNode;

  switch (field.kind) {
    case "select":
      control = (
        <div className="relative">
          <select
            {...common}
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            className={cn(inputBase, inputState(!!error), "h-13 appearance-none pr-11", !value && "text-slate-400")}
          >
            <option value="" disabled>
              Selecciona una opción
            </option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt} className="text-ink">
                {opt}
              </option>
            ))}
          </select>
          <Icon
            name="chevronDown"
            className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-slate-400"
          />
        </div>
      );
      break;

    case "choice":
      control = (
        <div role="radiogroup" aria-labelledby={`${id}-label`} aria-describedby={describedBy} className="flex gap-2">
          {field.options?.map((opt) => {
            const selected = value === opt;
            return (
              <label
                key={opt}
                className={cn(
                  "flex h-13 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-all has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-100",
                  selected
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : error
                      ? "border-red-400 text-slate-600"
                      : "border-slate-200 text-slate-600 hover:border-slate-300",
                )}
              >
                <input
                  type="radio"
                  name={field.name}
                  value={opt}
                  checked={selected}
                  onChange={() => onChange(field.name, opt)}
                  onBlur={() => onBlur(field.name)}
                  className="sr-only"
                />
                {selected && <Icon name="check" className="size-4" strokeWidth={2.5} />}
                {opt}
              </label>
            );
          })}
        </div>
      );
      break;

    case "money":
      control = (
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-semibold text-slate-400">
            $
          </span>
          <input
            {...common}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={field.placeholder}
            value={formatThousands(value)}
            onChange={(e) => onChange(field.name, e.target.value.replace(/\D/g, "").slice(0, 12))}
            className={cn(inputBase, inputState(!!error), "h-13 pl-8")}
          />
        </div>
      );
      break;

    case "date": {
      const today = todayISO();
      control = (
        <input
          {...common}
          type="date"
          autoComplete={field.autoComplete}
          value={value}
          min={field.dateRange === "future" ? today : "1920-01-01"}
          max={field.dateRange === "past" ? today : undefined}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={cn(inputBase, inputState(!!error), "h-13", !value && "text-slate-400")}
        />
      );
      break;
    }

    default:
      control = (
        <input
          {...common}
          // "number" se maneja como texto numérico para evitar flechas y la "e" de los inputs nativos.
          type={field.kind === "number" ? "text" : field.kind}
          inputMode={field.inputMode}
          autoComplete={field.autoComplete}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          value={value}
          onChange={(e) => {
            let v = e.target.value;
            if (field.kind === "number") v = v.replace(/\D/g, "");
            if (field.uppercase) v = v.toUpperCase();
            onChange(field.name, v);
          }}
          className={cn(inputBase, inputState(!!error), "h-13", field.uppercase && "uppercase tracking-wider")}
        />
      );
  }

  return (
    <div className={cn("flex flex-col gap-2", field.half ? "sm:col-span-1" : "sm:col-span-2")}>
      <label
        id={`${id}-label`}
        htmlFor={field.kind === "choice" ? undefined : id}
        className="text-sm font-semibold text-ink"
      >
        {field.label}
      </label>
      {control}
      {field.hint && !error && (
        <p id={hintId} className="text-xs text-slate-500">
          {field.hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-red-600">
          <Icon name="info" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
