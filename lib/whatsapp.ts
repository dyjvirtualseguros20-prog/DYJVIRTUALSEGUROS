import { siteConfig } from "@/config/site";
import type { Advisor } from "@/types";

/**
 * Construye el enlace de WhatsApp. Si no se pasa número, usa el de config/site.ts.
 * Si no se pasa mensaje, usa el mensaje predeterminado.
 */
export function whatsappUrl(
  message: string = siteConfig.whatsapp.defaultMessage,
  number: string = siteConfig.whatsapp.number,
): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** "573118023725" → "+57 311 802 3725" (formato colombiano; otros países se muestran con "+"). */
export function formatWhatsappNumber(number: string): string {
  const co = number.match(/^57(\d{3})(\d{3})(\d{4})$/);
  return co ? `+57 ${co[1]} ${co[2]} ${co[3]}` : `+${number}`;
}

/** Datos de contacto que se muestran en la web: los del asesor del enlace o los de la empresa. */
export interface ContactInfo {
  /** Asesor de la visita, o null si llegó sin enlace de asesor. */
  advisor: Advisor | null;
  whatsappNumber: string;
  whatsappDisplay: string;
  phoneDisplay: string;
  phoneHref: string;
}

export function contactInfo(advisor: Advisor | null): ContactInfo {
  if (!advisor) {
    return {
      advisor: null,
      whatsappNumber: siteConfig.whatsapp.number,
      whatsappDisplay: siteConfig.whatsapp.display,
      phoneDisplay: siteConfig.contact.phone,
      phoneHref: siteConfig.contact.phoneHref,
    };
  }
  // Teléfono: el propio del asesor si lo tiene; si no, su WhatsApp.
  const phone = advisor.phone ?? advisor.whatsapp;
  const phoneIntl = phone.length === 10 ? `57${phone}` : phone;
  return {
    advisor,
    whatsappNumber: advisor.whatsapp,
    whatsappDisplay: formatWhatsappNumber(advisor.whatsapp),
    phoneDisplay: formatWhatsappNumber(phoneIntl),
    phoneHref: `+${phoneIntl}`,
  };
}
