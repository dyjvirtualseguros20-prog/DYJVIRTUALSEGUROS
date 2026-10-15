"use client";

import { useEffect } from "react";

/**
 * Google Analytics 4 (etiqueta gtag.js, sin Google Tag Manager) con consentimiento estricto.
 * Se monta junto a CookieYes en components/layout/SiteShell.tsx: solo en el sitio público, nunca en /admin.
 *
 * - Antes de que el visitante acepte la categoría «Analítica» de CookieYes NO se descarga gtag.js
 *   ni se crea ninguna cookie de Google Analytics.
 * - Al aceptar Analítica se carga gtag.js (una sola vez) y se activa la medición.
 * - Al retirar el consentimiento se detiene la medición y se borran las cookies _ga y _ga_<ID>
 *   (CookieYes solo borra las cookies que tiene catalogadas en su categoría, por eso se hace aquí también).
 *
 * Integración oficial de CookieYes (cookieyes.com/documentation): evento "cookieyes_consent_update"
 * (cuando el visitante decide), evento "cookieyes_banner_load" (cuando el banner está listo) y
 * window.getCkyConsent() → categories.analytics. No usa nombres propios.
 * Google guarda solo _ga y _ga_<ID> (2 años por defecto); la publicidad queda denegada.
 */
const GA_MEASUREMENT_ID = "G-TL8SJR9G32";
const GA_SCRIPT_ID = "google-analytics-gtag";
const GA_SCRIPT_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
const GA_DISABLE_FLAG = `ga-disable-${GA_MEASUREMENT_ID}`;
/** Cookies que crea gtag.js con este ID: _ga y _ga_<ID sin «G-»>. */
const GA_COOKIES = ["_ga", `_ga_${GA_MEASUREMENT_ID.slice(2)}`];

type GtagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  getCkyConsent?: () => { categories?: Record<string, boolean> } | undefined;
  [flag: string]: unknown;
};

function getWindow(): GtagWindow {
  return window as unknown as GtagWindow;
}

/** true solo si CookieYes ya cargó y el visitante aceptó «Analítica». */
function analyticsAccepted(): boolean {
  try {
    return getWindow().getCkyConsent?.()?.categories?.analytics === true;
  } catch {
    return false;
  }
}

function ensureGtag() {
  const w = getWindow();
  w.dataLayer = w.dataLayer ?? [];
  if (!w.gtag) {
    w.gtag = function gtag() {
      // gtag.js exige el objeto «arguments», no un arreglo.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    // Denegado por defecto: sin almacenamiento de analítica ni de publicidad.
    w.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  }
  return w.gtag;
}

function enableAnalytics() {
  const w = getWindow();
  w[GA_DISABLE_FLAG] = false;
  const gtag = ensureGtag();
  gtag("consent", "update", { analytics_storage: "granted" });
  if (document.getElementById(GA_SCRIPT_ID)) return;
  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const script = document.createElement("script");
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = GA_SCRIPT_SRC;
  document.head.appendChild(script);
}

function removeGaCookies() {
  const labels = window.location.hostname.split(".");
  const domains: (string | null)[] = [null];
  for (let i = 0; i < labels.length - 1; i++) {
    const domain = labels.slice(i).join(".");
    domains.push(domain, `.${domain}`);
  }
  for (const name of GA_COOKIES) {
    for (const domain of domains) {
      const scope = domain ? `; domain=${domain}` : "";
      document.cookie = `${name}=; Max-Age=0; path=/${scope}; SameSite=Lax`;
    }
  }
}

function disableAnalytics() {
  const w = getWindow();
  // Hasta que CookieYes no cargue no se sabe qué decidió el visitante: no se toca nada.
  if (typeof w.getCkyConsent !== "function") return;
  if (document.getElementById(GA_SCRIPT_ID)) {
    w[GA_DISABLE_FLAG] = true; // Interruptor oficial de Google para detener la medición.
    w.gtag?.("consent", "update", { analytics_storage: "denied" });
  }
  // Sin consentimiento de Analítica no debe quedar ninguna cookie de Google Analytics.
  removeGaCookies();
}

function syncWithConsent() {
  if (analyticsAccepted()) enableAnalytics();
  else disableAnalytics();
}

export function GoogleAnalytics() {
  useEffect(() => {
    syncWithConsent();
    document.addEventListener("cookieyes_banner_load", syncWithConsent);
    document.addEventListener("cookieyes_consent_update", syncWithConsent);
    return () => {
      document.removeEventListener("cookieyes_banner_load", syncWithConsent);
      document.removeEventListener("cookieyes_consent_update", syncWithConsent);
    };
  }, []);

  return null;
}
