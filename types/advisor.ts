/** Asesor comercial (tabla public.advisors). Su `id` es el que va en el enlace: /cristian */
export interface Advisor {
  id: string;
  name: string;
  /** URL pública de la foto; null = se muestran las iniciales. */
  photoUrl: string | null;
  /** WhatsApp con indicativo de país, solo dígitos (p. ej. 573118023725). */
  whatsapp: string;
  /** Teléfono de llamadas, solo dígitos; null = se usa el WhatsApp. */
  phone: string | null;
  active: boolean;
}
