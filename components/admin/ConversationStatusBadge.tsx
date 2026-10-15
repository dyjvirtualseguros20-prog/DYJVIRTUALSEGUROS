import { cn } from "@/lib/format";
import { CONVERSATION_STATUSES, type ConversationStatus } from "@/types";

const STYLES: Record<ConversationStatus, string> = {
  bot: "bg-brand-50 text-brand-700 ring-brand-200",
  esperando_asesor: "bg-amber-50 text-amber-800 ring-amber-200",
  asesor: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cerrada: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function ConversationStatusBadge({ status, className }: { status: ConversationStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        STYLES[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {CONVERSATION_STATUSES[status]}
    </span>
  );
}
