import { siteConfig } from "@/config/site";

/**
 * Construye el enlace de WhatsApp con el número de config/site.ts.
 * Si no se pasa mensaje, usa el mensaje predeterminado.
 */
export function whatsappUrl(message: string = siteConfig.whatsapp.defaultMessage): string {
  return `https://wa.me/${siteConfig.whatsapp.number}?text=${encodeURIComponent(message)}`;
}
