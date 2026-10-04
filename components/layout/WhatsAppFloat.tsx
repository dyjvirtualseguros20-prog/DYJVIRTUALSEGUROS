import { whatsappUrl } from "@/lib/whatsapp";
import { getCurrentContact } from "@/server/advisors";
import { WhatsAppIcon } from "@/components/ui/Icon";

/** Botón flotante de WhatsApp visible en todo el sitio (del asesor del enlace, si lo hay). */
export async function WhatsAppFloat() {
  const contact = await getCurrentContact();
  return (
    <a
      href={whatsappUrl(undefined, contact.whatsappNumber)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Escríbenos por WhatsApp al ${contact.whatsappDisplay}${contact.advisor ? ` (${contact.advisor.name})` : ""}`}
      className="group fixed right-4 bottom-4 z-40 flex items-center gap-3 sm:right-6 sm:bottom-6"
    >
      <span className="pointer-events-none hidden translate-x-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink opacity-0 shadow-lift transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 md:block">
        ¿Hablamos por WhatsApp?
      </span>
      <span className="relative flex size-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-[0_10px_30px_-6px_rgb(37_211_102/0.6)] transition-transform duration-200 group-hover:scale-105">
        <span className="absolute inset-0 rounded-full bg-whatsapp animate-pulse-ring" aria-hidden="true" />
        <WhatsAppIcon className="relative size-7" />
      </span>
    </a>
  );
}
