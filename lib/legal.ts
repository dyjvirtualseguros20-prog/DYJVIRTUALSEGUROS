import { siteConfig } from "@/config/site";

/**
 * AUTORIZACIONES DEL CLIENTE (Ley 1581 de 2012)
 * ──────────────────────────────────────────────
 * Tres autorizaciones separadas, para que el cliente sepa exactamente qué acepta:
 *   A. privacyAccepted  → leyó la Política de Tratamiento de Datos y los Términos (obligatoria).
 *   B. dataConsent      → autoriza usar sus datos para gestionar la cotización y contactarlo (obligatoria).
 *   C. insurerConsent   → autoriza compartir los datos indispensables con aseguradoras (opcional).
 *      Si no la da, un asesor le pide autorización antes de compartir cualquier dato.
 *
 * El registro (fecha, versiones, tipo y origen) lo arma el SERVIDOR al guardar la solicitud
 * (quote_requests.consent). El navegador solo envía las casillas marcadas.
 */

export const LEGAL_VERSIONS = {
  privacyPolicy: siteConfig.legal.privacyPolicyVersion,
  terms: siteConfig.legal.termsVersion,
} as const;

/** Textos de las casillas (los mismos en el formulario y en el asesor virtual). */
export const CONSENT_TEXT = {
  privacyAccepted: {
    before: "He leído y entiendo la",
    policy: "Política de Tratamiento de Datos Personales",
    middle: "y los",
    terms: "Términos y Condiciones",
    after: ".",
    required: true,
  },
  dataConsent: {
    text: `Autorizo a ${siteConfig.legalName} a tratar mis datos para gestionar mi solicitud de cotización y contactarme sobre ella por teléfono, WhatsApp o correo electrónico.`,
    required: true,
  },
  insurerConsent: {
    text: "Autorizo que se compartan únicamente los datos indispensables de mi solicitud con las compañías aseguradoras consultadas para cotizar.",
    note: "Opcional: si no lo marcas, un asesor te pedirá autorización antes de compartir tus datos con cualquier aseguradora.",
    required: false,
  },
} as const;

/** Registro de autorizaciones que se guarda con cada solicitud. */
export interface ConsentRecord {
  privacy_policy_version: string;
  terms_version: string;
  /** Fecha y hora (servidor, UTC) en que el cliente envió la solicitud con las autorizaciones. */
  accepted_at: string;
  source: "formulario" | "asistente_ia";
  /** A. Leyó la política y los términos. */
  privacy_policy_read: boolean;
  /** B. Tratamiento para gestionar la cotización y contactarlo. */
  data_processing: boolean;
  /** C. Transmisión de los datos indispensables a aseguradoras. */
  insurer_transfer: boolean;
}

export function buildConsentRecord(
  form: { privacyAccepted?: unknown; dataConsent?: unknown; insurerConsent?: unknown },
  source: ConsentRecord["source"],
): ConsentRecord {
  return {
    privacy_policy_version: LEGAL_VERSIONS.privacyPolicy,
    terms_version: LEGAL_VERSIONS.terms,
    accepted_at: new Date().toISOString(),
    source,
    privacy_policy_read: form.privacyAccepted === true,
    data_processing: form.dataConsent === true,
    insurer_transfer: form.insurerConsent === true,
  };
}

/** Frase corta que se repite donde corresponde: cotizar no es contratar. */
export const QUOTE_DISCLAIMER =
  "Cotizar no significa contratar. Toda cotización está sujeta a la validación, evaluación del riesgo, inspección (cuando aplique), documentación y aprobación de la aseguradora.";
