"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { siteConfig } from "@/config/site";
import {
  CHAT_LIMITS,
  EMPTY_LEAD,
  QUICK_OPTIONS,
  type ChatAction,
  type ChatMessage,
  type ChatResponse,
  type LeadState,
} from "@/lib/chat";
import { cn } from "@/lib/format";
import { whatsappUrl } from "@/lib/whatsapp";
import type { QuoteRequestReceipt } from "@/types";
import { Icon, WhatsAppIcon } from "@/components/ui/Icon";
import { ChatQuoteCard } from "./ChatQuoteCard";

interface UiMessage extends ChatMessage {
  id: number;
  action?: ChatAction;
  /** Mensaje solo de la interfaz (saludo, avisos): no se envía a la IA. */
  local?: boolean;
}

const GREETING = `👋 ¡Hola! Soy el Asesor Virtual de ${siteConfig.name}.\nEstoy aquí para ayudarte a encontrar el seguro que necesitas. ¿En qué puedo ayudarte?`;
const TIP_KEY = "dyj-chat-tip-visto";

let nextId = 1;
const msg = (m: Omit<UiMessage, "id">): UiMessage => ({ ...m, id: nextId++ });
const initialMessages = () => [msg({ role: "assistant", content: GREETING, local: true })];

/**
 * Asesor virtual: botón flotante (encima del de WhatsApp) y ventana de chat.
 * La conversación vive solo en memoria: se pierde al cerrar el chat o recargar la página.
 */
export function ChatWidget({ whatsappNumber, advisorName }: { whatsappNumber: string; advisorName: string | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages);
  // Datos de la solicitud que el asistente ya reunió (los valida el servidor en cada mensaje).
  const [lead, setLead] = useState<LeadState>(EMPTY_LEAD);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelId = useId();

  // Mensaje de bienvenida discreto, una sola vez por navegador.
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(TIP_KEY) === "1";
    } catch {
      /* almacenamiento no disponible */
    }
    if (seen) return;
    const timer = setTimeout(() => setShowTip(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function hideTip() {
    setShowTip(false);
    try {
      localStorage.setItem(TIP_KEY, "1");
    } catch {
      /* almacenamiento no disponible */
    }
  }

  function openChat() {
    hideTip();
    setOpen(true);
  }

  function closeChat() {
    setOpen(false);
    setMessages(initialMessages());
    setLead(EMPTY_LEAD);
    setInput("");
  }

  /** Historial que se envía a la IA: sin mensajes locales; alterna visitante/asistente. */
  const history = (list: UiMessage[]): ChatMessage[] =>
    list.filter((m) => !m.local).map(({ role, content }) => ({ role, content }));

  async function send(text: string) {
    const content = text.trim().slice(0, CHAT_LIMITS.maxUserChars);
    if (!content || loading) return;

    const userMessage = msg({ role: "user", content });
    const next = [...messages, userMessage];
    const payload = history(next);
    if (payload.length > CHAT_LIMITS.maxMessages) {
      setMessages([
        ...messages,
        msg({
          role: "assistant",
          local: true,
          content:
            "Esta conversación llegó a su límite. Cierra el chat para empezar de nuevo o escríbenos por WhatsApp.",
          action: { type: "whatsapp", message: siteConfig.whatsapp.defaultMessage },
        }),
      ]);
      return;
    }

    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload, lead }),
      });
      const data = (await response.json().catch(() => null)) as (ChatResponse & { error?: string }) | null;
      if (!response.ok || !data?.reply) throw new Error(data?.error ?? "");
      if (data.lead) setLead(data.lead);
      setMessages((list) => [...list, msg({ role: "assistant", content: data.reply, action: data.action })]);
    } catch (error) {
      // El mensaje que falló sale del historial para no romper el orden de la conversación.
      setMessages((list) => [
        ...list.map((m) => (m.id === userMessage.id ? { ...m, local: true } : m)),
        msg({
          role: "assistant",
          local: true,
          content:
            (error instanceof Error && error.message) ||
            "No pude responder en este momento. Inténtalo de nuevo o escríbenos por WhatsApp.",
          action: { type: "whatsapp", message: siteConfig.whatsapp.defaultMessage },
        }),
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onQuickOption(option: (typeof QUICK_OPTIONS)[number]) {
    if (option.prompt) {
      void send(option.prompt);
      return;
    }
    setMessages((list) => [
      ...list,
      msg({ role: "assistant", local: true, content: "¡Claro! Escribe tu pregunta y con gusto te ayudo. 😊" }),
    ]);
    inputRef.current?.focus();
  }

  function onSent(receipt: QuoteRequestReceipt) {
    // Solicitud registrada: una nueva cotización empieza de cero.
    setLead(EMPTY_LEAD);
    setMessages((list) => [
      ...list,
      msg({
        role: "assistant",
        local: true,
        content: `✅ ¡Gracias! Registramos tu solicitud ${receipt.requestId}. ${
          advisorName ? `${advisorName}` : "Un asesor"
        } revisará tus datos, comparará opciones y te contactará pronto.`,
      }),
    ]);
  }

  function onCorrect() {
    setInput("Quiero corregir ");
    inputRef.current?.focus();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  }

  const showQuickOptions = !messages.some((m) => m.role === "user");

  return (
    <>
      {/* Botón flotante: encima del botón de WhatsApp, sin taparlo. */}
      <div
        className={cn(
          "fixed right-4 bottom-[5.25rem] z-40 flex items-center gap-3 sm:right-6 sm:bottom-24",
          open && "max-sm:hidden",
        )}
      >
        {showTip && !open && (
          <div className="relative flex animate-fade-up items-center gap-2 rounded-2xl bg-white py-2 pr-2 pl-4 text-sm font-semibold text-ink shadow-lift ring-1 ring-slate-100">
            <button type="button" onClick={openChat} className="text-left">
              ¿Te ayudo a elegir tu seguro?
            </button>
            <button
              type="button"
              onClick={hideTip}
              aria-label="Cerrar mensaje"
              className="flex size-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <Icon name="close" className="size-3.5" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openChat())}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Minimizar el asesor virtual" : "Abrir el asesor virtual con IA"}
          className="group relative flex size-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_10px_30px_-6px_rgb(30_63_148/0.55)] ring-4 ring-white transition-transform duration-200 hover:scale-105 hover:bg-brand-700"
        >
          <Icon name={open ? "chevronDown" : "chat"} className="size-6" />
          {!open && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-white text-brand-600 shadow-soft">
              <Icon name="sparkle" className="size-3" strokeWidth={2.4} />
            </span>
          )}
          <span className="pointer-events-none absolute right-full mr-3 hidden rounded-full bg-white px-4 py-2 text-sm font-semibold whitespace-nowrap text-ink opacity-0 shadow-lift transition-opacity group-hover:opacity-100 md:block">
            {open ? "Minimizar" : "Asesor virtual"}
          </span>
        </button>
      </div>

      {/* Ventana del chat */}
      <section
        id={panelId}
        role="dialog"
        aria-label="Asesor virtual con IA"
        hidden={!open}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className={cn(
          "fixed inset-0 z-50 flex flex-col bg-slate-50 sm:inset-auto sm:right-24 sm:bottom-6 sm:h-[600px] sm:max-h-[calc(100dvh-3rem)] sm:w-[380px] sm:overflow-hidden sm:rounded-3xl sm:shadow-lift sm:ring-1 sm:ring-slate-200",
          !open && "hidden",
        )}
      >
        <header className="flex items-center gap-3 bg-brand-600 px-4 py-3 text-white">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
            <Icon name="sparkle" className="size-5" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-bold">Asesor Virtual</p>
            <p className="truncate text-xs text-brand-100">
              {advisorName ? `Con IA · Tu asesor: ${advisorName.split(/\s+/)[0]}` : `${siteConfig.name} · Con IA`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Minimizar el chat"
            className="flex size-9 items-center justify-center rounded-full hover:bg-white/15"
          >
            <Icon name="chevronDown" className="size-5" />
          </button>
          <button
            type="button"
            onClick={closeChat}
            aria-label="Cerrar el chat y borrar la conversación"
            className="flex size-9 items-center justify-center rounded-full hover:bg-white/15"
          >
            <Icon name="close" className="size-5" />
          </button>
        </header>

        <div ref={listRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
              <p
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line wrap-anywhere",
                  m.role === "user"
                    ? "rounded-br-md bg-brand-600 text-white"
                    : "rounded-bl-md bg-white text-ink shadow-soft ring-1 ring-slate-100",
                )}
              >
                {m.content}
              </p>
              {m.action?.type === "whatsapp" && (
                <a
                  href={whatsappUrl(m.action.message, whatsappNumber)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-whatsapp px-4 py-2 text-xs font-bold text-white hover:brightness-95"
                >
                  <WhatsAppIcon className="size-4" />
                  Escribir por WhatsApp{advisorName ? ` a ${advisorName}` : ""}
                </a>
              )}
              {m.action?.type === "quote_draft" && (
                <div className="w-full max-w-[95%]">
                  <ChatQuoteCard draft={m.action.draft} onSent={onSent} onCorrect={onCorrect} />
                </div>
              )}
            </div>
          ))}

          {showQuickOptions && (
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => onQuickOption(option)}
                  disabled={loading}
                  className="rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-50 disabled:opacity-50"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <p className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-soft ring-1 ring-slate-100">
              <span className="sr-only">El asesor virtual está escribiendo…</span>
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="size-1.5 animate-bounce rounded-full bg-brand-500"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </p>
          )}
        </div>

        <form
          onSubmit={onSubmit}
          className="border-t border-slate-200 bg-white px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-end gap-2">
            <label htmlFor={`${panelId}-input`} className="sr-only">
              Escribe tu mensaje
            </label>
            <textarea
              id={`${panelId}-input`}
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={CHAT_LIMITS.maxUserChars}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Escribe tu mensaje…"
              className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Enviar mensaje"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
            >
              <Icon name="arrowRight" className="size-5" />
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-400">
            Asistente con IA: puede equivocarse y no da precios. No compartas datos sensibles.{" "}
            <Link href="/politica-de-privacidad" className="underline underline-offset-2 hover:text-slate-600">
              Política de datos
            </Link>
            {input.length > CHAT_LIMITS.maxUserChars - 200 && (
              <span className="ml-1 font-semibold text-slate-500">
                {input.length}/{CHAT_LIMITS.maxUserChars}
              </span>
            )}
          </p>
        </form>
      </section>
    </>
  );
}
