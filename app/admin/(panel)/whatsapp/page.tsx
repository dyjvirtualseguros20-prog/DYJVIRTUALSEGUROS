import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";
import { isPrincipal } from "@/lib/staff";
import { listAdvisors } from "@/server/advisors";
import { requireAdmin } from "@/server/auth";
import { listConversations } from "@/server/conversations";
import { CONVERSATION_INTENTS, CONVERSATION_STATUSES, isConversationStatus } from "@/types";
import { ConversationStatusBadge } from "@/components/admin/ConversationStatusBadge";
import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "WhatsApp" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** +57 300 123 4567 */
const formatNumber = (n: string) => (/^57\d{10}$/.test(n) ? `+57 ${n.slice(2, 5)} ${n.slice(5, 8)} ${n.slice(8)}` : `+${n}`);

export default async function WhatsAppConversationsPage({ searchParams }: Props) {
  const estado = one((await searchParams).estado);
  const status = isConversationStatus(estado) ? estado : undefined;
  const [session, conversations, advisors] = await Promise.all([
    requireAdmin(),
    listConversations({ status }),
    listAdvisors(),
  ]);
  const advisorName = new Map(advisors.map((a) => [a.id, a.name]));

  const filterClass = (active: boolean) =>
    active
      ? "rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
      : "rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50";

  return (
    <Container className="pt-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Conversaciones de WhatsApp</h1>
      <p className="mt-1 text-sm text-slate-500">
        {conversations.length === 1 ? "1 conversación" : `${conversations.length} conversaciones`}
        {status ? ` · ${CONVERSATION_STATUSES[status]}` : ""}
        {isPrincipal(session) ? "" : " · Solo ves las conversaciones asignadas a ti."}
      </p>

      <nav aria-label="Filtrar por estado" className="mt-5 flex flex-wrap gap-2">
        <Link href="/admin/whatsapp" className={filterClass(!status)}>
          Todas
        </Link>
        {Object.entries(CONVERSATION_STATUSES).map(([key, label]) => (
          <Link key={key} href={`/admin/whatsapp?estado=${key}`} className={filterClass(status === key)}>
            {label}
          </Link>
        ))}
      </nav>

      {conversations.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-3xl bg-white px-6 py-16 text-center ring-1 ring-slate-200">
          <Icon name="chat" className="size-10 text-slate-300" />
          <p className="mt-4 font-bold text-ink">Aún no hay conversaciones</p>
          <p className="mt-1 text-sm text-slate-500">
            Cuando un cliente escriba por WhatsApp (o en las pruebas de simulación) aparecerá aquí.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/whatsapp/${c.id}`}
                className="grid gap-2 px-5 py-4 transition-colors hover:bg-brand-50/50 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{c.contactName ?? "Sin nombre"}</p>
                  <p className="text-xs text-slate-500">{formatNumber(c.contactNumber)}</p>
                </div>
                <div className="text-sm text-slate-600">
                  {c.intent ? CONVERSATION_INTENTS[c.intent] : "—"}
                  {c.quoteRequestId && (
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                      Con solicitud
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-600">
                  <span className={c.assignedAdvisorId ? "font-semibold text-ink" : "text-slate-400"}>
                    {c.assignedAdvisorId ? (advisorName.get(c.assignedAdvisorId) ?? c.assignedAdvisorId) : "Sin asesor"}
                  </span>
                  <span className="block text-xs text-slate-400">{formatDateTime(c.lastMessageAt)}</span>
                </div>
                <ConversationStatusBadge status={c.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
