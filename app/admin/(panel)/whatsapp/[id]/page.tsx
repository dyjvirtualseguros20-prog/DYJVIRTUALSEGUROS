import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/format";
import { getProduct } from "@/lib/insurance";
import { isPrincipal } from "@/lib/staff";
import { listAdvisors } from "@/server/advisors";
import { requireAdmin } from "@/server/auth";
import { getConversation } from "@/server/conversations";
import { CONVERSATION_INTENTS, ESCALATION_REASONS, isInsuranceType } from "@/types";
import { ConversationManageForm } from "@/components/admin/ConversationManageForm";
import { ConversationStatusBadge } from "@/components/admin/ConversationStatusBadge";
import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Conversación de WhatsApp" };

type Props = { params: Promise<{ id: string }> };

const AUTHOR = { cliente: "Cliente", ia: "Asesor IA", asesor: "Asesor", sistema: "Sistema" } as const;

const CONSENT_TYPES: Record<string, string> = {
  politica_terminos: "A · Política y términos",
  tratamiento_datos: "B · Uso de datos para la cotización",
  envio_aseguradoras: "C · Compartir con aseguradoras",
};

const formatNumber = (n: string) => (/^57\d{10}$/.test(n) ? `+57 ${n.slice(2, 5)} ${n.slice(5, 8)} ${n.slice(8)}` : `+${n}`);

export default async function ConversationDetailPage({ params }: Props) {
  const { id } = await params;
  const [session, conversation, advisors] = await Promise.all([requireAdmin(), getConversation(id), listAdvisors()]);
  if (!conversation) notFound();

  const lead = conversation.leadState as { insuranceType?: string; fields?: Record<string, string> };
  const known = Object.entries(lead.fields ?? {});
  const advisor = advisors.find((a) => a.id === conversation.assignedAdvisorId);

  return (
    <Container className="max-w-6xl pt-6">
      <Link
        href="/admin/whatsapp"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700"
      >
        <Icon name="arrowLeft" className="size-4" />
        Volver a las conversaciones
      </Link>

      <div className="mt-4 flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{conversation.contactName ?? "Cliente sin nombre"}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          {formatNumber(conversation.contactNumber)} · Intención:{" "}
          <strong className="font-semibold text-ink">
            {conversation.intent ? CONVERSATION_INTENTS[conversation.intent] : "—"}
          </strong>{" "}
          · Asesor: <strong className="font-semibold text-ink">{advisor?.name ?? "Sin asesor"}</strong>
          <ConversationStatusBadge status={conversation.status} />
        </p>
        {conversation.escalationReason && conversation.status !== "bot" && (
          <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
            <Icon name="info" className="size-4 shrink-0" />
            Pasó a un asesor: {ESCALATION_REASONS[conversation.escalationReason]}.
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="mensajes" className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
          <h2 id="mensajes" className="text-base font-bold text-ink">
            Mensajes
          </h2>
          <ol className="mt-4 space-y-3">
            {conversation.messages.map((m) => {
              const fromClient = m.direction === "entrante";
              return (
                <li key={m.id} className={cn("flex", fromClient ? "justify-start" : "justify-end")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line",
                      fromClient ? "bg-slate-100 text-ink" : "bg-brand-50 text-ink ring-1 ring-brand-100",
                    )}
                  >
                    <p className="mb-1 text-[11px] font-semibold text-slate-500">
                      {AUTHOR[m.author]} · {formatDateTime(m.createdAt)}
                      {m.isSimulated ? " · simulado" : ""}
                      {m.intent && fromClient === false ? ` · ${CONVERSATION_INTENTS[m.intent]}` : ""}
                    </p>
                    {m.body ?? <em className="text-slate-400">({m.messageType})</em>}
                    {m.healthRedacted && (
                      <p className="mt-1 text-[11px] text-amber-700">Se ocultó información de salud de este mensaje.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <ConversationManageForm
            id={conversation.id}
            advisors={advisors}
            canReassign={isPrincipal(session)}
            takenBy={conversation.takenBy}
            initial={{ status: conversation.status, assignedAdvisorId: conversation.assignedAdvisorId }}
          />

          <section className="rounded-3xl bg-white p-6 text-sm ring-1 ring-slate-200">
            <h2 className="text-base font-bold text-ink">Solicitud</h2>
            {conversation.quoteRequestId ? (
              <Link
                href={`/admin/solicitudes/${conversation.quoteRequestId}`}
                className="mt-2 inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline"
              >
                {conversation.quoteReference ?? "Ver solicitud"}
                <Icon name="arrowRight" className="size-4" />
              </Link>
            ) : (
              <p className="mt-2 text-slate-500">Todavía no hay una solicitud registrada.</p>
            )}

            <h3 className="mt-5 text-sm font-bold text-ink">Lo que la IA ya sabe</h3>
            <p className="mt-1 text-slate-600">
              {lead.insuranceType && isInsuranceType(lead.insuranceType)
                ? getProduct(lead.insuranceType).name
                : "Tipo de seguro sin definir"}
            </p>
            {known.length > 0 && (
              <dl className="mt-2 space-y-1 text-xs text-slate-600">
                {known.map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="text-slate-400">{k}:</dt>
                    <dd className="font-semibold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            )}

            <h3 className="mt-5 text-sm font-bold text-ink">Autorizaciones</h3>
            {conversation.consents.length ? (
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {conversation.consents.map((c, i) => (
                  <li key={i}>
                    {CONSENT_TYPES[c.type] ?? c.type}: <strong>{c.granted ? "Sí" : "No"}</strong> · política v
                    {c.policyVersion}, términos v{c.termsVersion} · texto {c.textVersion} · {formatDateTime(c.createdAt)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Sin autorizaciones registradas.</p>
            )}
          </section>
        </aside>
      </div>
    </Container>
  );
}
