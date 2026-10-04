import { cn } from "@/lib/format";
import { REQUEST_STATUSES, type RequestStatus } from "@/types";

const STYLES: Record<RequestStatus, string> = {
  nueva_solicitud: "bg-brand-50 text-brand-700 ring-brand-200",
  en_revision: "bg-amber-50 text-amber-800 ring-amber-200",
  cotizando: "bg-violet-50 text-violet-700 ring-violet-200",
  cotizado: "bg-sky-50 text-sky-700 ring-sky-200",
  contactado: "bg-teal-50 text-teal-700 ring-teal-200",
  vendido: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelado: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        STYLES[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {REQUEST_STATUSES[status]}
    </span>
  );
}
