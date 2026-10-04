import type { SVGProps } from "react";

/** Iconos de línea (estilo uniforme, 24×24). */
const PATHS = {
  car: "M5 17h14M5 17a2 2 0 1 1-4 0v-4l2.2-5.5A2 2 0 0 1 5.06 6h13.88a2 2 0 0 1 1.86 1.5L23 13v4a2 2 0 1 1-4 0M5 17a2 2 0 1 0 4 0m6 0a2 2 0 1 0 4 0M1 13h22",
  heart:
    "M12 20.5s-7.5-4.6-9.6-9.3C.9 7.8 3.1 4 6.8 4c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.7 0 5.9 3.8 4.4 7.2-2.1 4.7-9.6 9.3-9.6 9.3Z",
  home: "M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9",
  health: "M12 21s-8-4.5-8-11V5l8-3 8 3v5c0 6.5-8 11-8 11Zm0-13v6m-3-3h6",
  plane:
    "M2.5 13.5 21 6.2a1.3 1.3 0 0 1 1.6 1.7l-.1.2-6.9 12.4a.8.8 0 0 1-1.4-.1l-2.4-5.9-5.9-2.4a.8.8 0 0 1 0-1.5ZM11.8 14.5l4.3-4.3",
  building: "M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16m0-10h3a1 1 0 0 1 1 1v9M2 21h20M8 7h4M8 11h4M8 15h4",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3.5-10 2.5 2.5 4.5-5",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  layers: "m12 2 10 5-10 5L2 7l10-5Zm-10 10 10 5 10-5M2 17l10 5 10-5",
  compass: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm4.2-14.2-2.1 6.3-6.3 2.1 2.1-6.3 6.3-2.1Z",
  handshake:
    "m11 17 2 2a1.4 1.4 0 0 0 2-2m-2-2 2.5 2.5a1.4 1.4 0 0 0 2-2L14 12m-1-1 3.5 3.5a1.4 1.4 0 0 0 2-2L15 9l-2-1.5L9.5 10a1.5 1.5 0 0 1-2-2L11 4.5 13 3l2 1 4-1 3 6-2 2M2 9l3-6 4 1M5 13l4 4",
  chat: "M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5Z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  arrowRight: "M5 12h14m-6-6 6 6-6 6",
  arrowLeft: "M19 12H5m6 6-6-6 6-6",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  chevronDown: "m6 9 6 6 6-6",
  mail: "M3 6h18v12H3V6Zm0 0 9 7 9-7",
  phone:
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z",
  pin: "M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v5l3 2",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-6v-5m0-3h.01",
  lock: "M6 11h12v10H6V11Zm2 0V7a4 4 0 1 1 8 0v4",
  sparkle: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Logotipo oficial de WhatsApp (relleno). */
export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.44 9.43m8.03-17.46A11.27 11.27 0 0 0 12.05.7C5.8.7.7 5.8.7 12.06c0 2 .52 3.95 1.52 5.67L.6 23.3l5.7-1.5a11.3 11.3 0 0 0 5.75 1.47c6.26 0 11.35-5.1 11.36-11.36 0-3.03-1.18-5.89-3.33-8.03" />
    </svg>
  );
}

/** Icono que representa cada tipo de seguro. */
export const INSURANCE_ICONS = {
  vehiculos: "car",
  vida: "heart",
  hogar: "home",
  salud: "health",
  viajes: "plane",
  empresas: "building",
} as const satisfies Record<string, IconName>;
