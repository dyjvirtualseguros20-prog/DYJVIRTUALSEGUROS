import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig, siteUrl } from "@/config/site";
import { QUOTE_DISCLAIMER } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";
import { Container } from "@/components/ui/Container";
import { LEGAL_PROSE, LegalToc, dato, formatLongDate } from "@/components/legal/LegalBits";

export const metadata: Metadata = pageMetadata({
  title: "Términos y condiciones",
  description: `Condiciones de uso del sitio, del cotizador y del asesor virtual de ${siteConfig.name}. Cotizar no significa contratar.`,
  path: "/terminos-y-condiciones",
});

/**
 * TÉRMINOS Y CONDICIONES DE USO
 * Los datos de la empresa se leen de config/site.ts (bloque `legal`). Lo que falte aparece
 * como [POR COMPLETAR]. Recomendación: revisión por un abogado colombiano antes de darlo por definitivo.
 */
const SECTIONS = [
  ["quienes", "Quiénes somos"],
  ["aceptacion", "Aceptación de estos términos"],
  ["uso", "Uso del sitio"],
  ["cotizador", "Cotizador y solicitudes de cotización"],
  ["veracidad", "Tu información debe ser veraz y completa"],
  ["cotizar", "Cotizar no significa contratar"],
  ["comparacion", "Comparación entre aseguradoras"],
  ["asistente", "Asesor virtual con inteligencia artificial"],
  ["whatsapp", "WhatsApp y servicios de terceros"],
  ["asesores", "Enlaces de asesores"],
  ["propiedad", "Propiedad intelectual y marcas"],
  ["limitaciones", "Limitaciones del servicio"],
  ["datos", "Tratamiento de datos personales"],
  ["cambios", "Cambios en el sitio y en estos términos"],
  ["ley", "Ley aplicable"],
  ["contacto", "Contacto"],
] as const;

export default function TermsPage() {
  const { legalName, name, legal, contact } = siteConfig;
  // Los dos números oficiales de los asesores (llamadas y WhatsApp).
  const phones = siteConfig.advisorLines.map((l) => l.display).join(" y ");

  return (
    <section className="pt-28 pb-24 sm:pt-36">
      <Container className="max-w-3xl">
        <p className="text-xs font-bold tracking-[0.18em] text-brand-500 uppercase">Documento legal</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Términos y condiciones</h1>
        <p className="mt-3 text-sm text-slate-500">
          Versión {legal.termsVersion} · Última actualización: {formatLongDate(legal.termsUpdated)}
        </p>

        <div className="mt-8 rounded-2xl bg-brand-50 p-6 ring-1 ring-brand-100">
          <h2 className="text-base font-bold text-ink">En resumen</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-700">
            <li>Somos una agencia de seguros: te ayudamos a cotizar y comparar. No somos una aseguradora.</li>
            <li>
              <strong>Cotizar no significa contratar.</strong> La póliza solo existe cuando la aseguradora la aprueba y
              la emite.
            </li>
            <li>Los datos que nos des deben ser veraces y completos: de eso depende tu cotización y tu póliza.</li>
            <li>El asesor virtual es automático, puede equivocarse y no reemplaza a un asesor humano.</li>
          </ul>
        </div>

        <LegalToc sections={SECTIONS} />

        <div className={LEGAL_PROSE}>
          <h2 id="quienes">1. Quiénes somos</h2>
          <p>
            Este sitio web pertenece a <strong>{legalName}</strong> («{name}», «la agencia», «nosotros»), identificada
            con NIT {legal.nit}
            {legal.nitCheckDigit ? `-${legal.nitCheckDigit}` : <>-{dato("", "dígito de verificación")}</>}, con
            domicilio en {legal.city}, Colombia. Representante legal:{" "}
            {dato(legal.legalRepresentative, "nombre del representante legal")}.
          </p>
          <p>
            Somos una <strong>agencia e intermediario de seguros</strong>: te asesoramos, te ayudamos a solicitar
            cotizaciones y a comparar alternativas de distintas compañías aseguradoras.{" "}
            <strong>No somos una aseguradora</strong>: no emitimos pólizas ni pagamos siniestros; eso lo hace la
            compañía aseguradora que elijas.
          </p>

          <h2 id="aceptacion">2. Aceptación de estos términos</h2>
          <p>
            Al usar este sitio, el cotizador o el asesor virtual aceptas estos términos. Si no estás de acuerdo, por
            favor no uses el sitio y escríbenos por WhatsApp si necesitas ayuda. Para enviar una solicitud debes ser
            mayor de 18 años.
          </p>

          <h2 id="uso">3. Uso del sitio</h2>
          <p>Te comprometes a usar el sitio de forma lícita y respetuosa. No está permitido:</p>
          <ul>
            <li>Enviar información falsa o datos de otra persona sin su autorización.</li>
            <li>Enviar solicitudes de forma automatizada o masiva, o intentar saturar el sitio o el asesor virtual.</li>
            <li>Intentar acceder sin autorización al panel de asesores, a la base de datos o a otros sistemas.</li>
            <li>Usar el asesor virtual para fines distintos a informarte o solicitar una cotización de seguros.</li>
          </ul>
          <p>Podemos limitar o bloquear el uso del sitio cuando detectemos un uso indebido.</p>

          <h2 id="cotizador">4. Cotizador y solicitudes de cotización</h2>
          <p>
            Con el cotizador (formularios o asesor virtual) nos envías una <strong>solicitud de cotización</strong>. Te
            asignamos un número de referencia (por ejemplo, «SOL-XXXXXX») y un asesor revisa tu caso, consulta
            alternativas con las aseguradoras y te contacta.
          </p>
          <ul>
            <li>Enviar una solicitud no te obliga a contratar ningún seguro ni tiene costo.</li>
            <li>
              Los tiempos de respuesta dependen del tipo de seguro y de cada aseguradora; no garantizamos un plazo
              exacto.
            </li>
            <li>
              Podemos pedirte información o documentos adicionales cuando la aseguradora los requiera para cotizar.
            </li>
          </ul>

          <h2 id="veracidad">5. Tu información debe ser veraz y completa</h2>
          <p>
            Eres responsable de que la información que nos das sea <strong>verdadera, exacta y completa</strong>. Las
            aseguradoras calculan el precio y las condiciones con base en esa información. Según la ley colombiana, la
            información inexacta, incompleta u omitida sobre el riesgo puede afectar la cotización, la validez de la
            póliza o el pago de una reclamación. Si cometiste un error, avísanos lo antes posible para corregirlo.
          </p>

          <h2 id="cotizar">6. Cotizar no significa contratar</h2>
          <p>{QUOTE_DISCLAIMER}</p>
          <ul>
            <li>
              <strong>Una cotización no es una póliza.</strong> No te da cobertura. El seguro solo existe cuando la
              aseguradora lo aprueba, lo emite y se cumplen sus condiciones (por ejemplo, el pago de la prima).
            </li>
            <li>
              <strong>Suscripción y evaluación del riesgo:</strong> la aseguradora puede aceptar, condicionar o rechazar
              la solicitud según su análisis.
            </li>
            <li>
              <strong>Inspecciones:</strong> en algunos seguros (por ejemplo, vehículos u hogar) la aseguradora puede
              exigir una inspección antes de emitir.
            </li>
            <li>
              <strong>Vigencia de la cotización:</strong> cada cotización tiene la vigencia que indique la aseguradora;
              después de ese plazo el precio o las condiciones pueden cambiar.
            </li>
            <li>
              <strong>Coberturas, exclusiones y deducibles:</strong> las condiciones completas están en la póliza y en
              su clausulado. Te recomendamos leerlos antes de contratar; un asesor puede explicártelos.
            </li>
          </ul>

          <h2 id="comparacion">7. Comparación entre aseguradoras</h2>
          <p>
            Trabajamos con diferentes compañías aseguradoras y te presentamos alternativas para que compares. Las
            comparaciones se basan en la información que entregan las aseguradoras: no alteramos sus precios ni sus
            condiciones, no inventamos coberturas y no afirmamos que una compañía sea «la mejor» sin una base objetiva.
            La elección final es tuya, con la asesoría que necesites.
          </p>

          <h2 id="asistente">8. Asesor virtual con inteligencia artificial</h2>
          <ul>
            <li>
              El asesor virtual es un <strong>asistente automático con inteligencia artificial</strong>, no una persona.
            </li>
            <li>
              Da orientación general y te ayuda a preparar tu solicitud. <strong>Puede equivocarse</strong>: un asesor
              de la agencia revisa cada solicitud y confirma la información.
            </li>
            <li>
              No da precios, no confirma aprobaciones ni emisiones de pólizas, no es una aseguradora, no presta asesoría
              legal ni médica y <strong>no es un servicio de emergencias</strong>. Ante un accidente con personas
              lesionadas, llama a la línea de emergencias 123.
            </li>
            <li>
              Ninguna solicitud se envía sin que tú la revises y la confirmes. El asesor virtual nunca envía tus datos a
              una aseguradora.
            </li>
            <li>No escribas en el chat datos de salud, contraseñas ni datos bancarios o de tarjetas.</li>
          </ul>

          <h2 id="whatsapp">9. WhatsApp y servicios de terceros</h2>
          <p>
            Puedes llamarnos o escribirnos por WhatsApp a los números de nuestros asesores ({phones}); ambos atienden
            información y cotizaciones. Al hacerlo usas un servicio de Meta, sujeto a sus propios términos y políticas.
            El sitio también usa servicios de terceros para funcionar (por ejemplo, alojamiento, base de datos e
            inteligencia artificial); los detallamos en la{" "}
            <Link href="/politica-de-privacidad#terceros">Política de Tratamiento de Datos</Link>. No somos responsables
            de las fallas o cambios de esos servicios, aunque trabajamos para que el sitio funcione correctamente.
          </p>

          <h2 id="asesores">10. Enlaces de asesores</h2>
          <p>
            Si entras por el enlace personal de un asesor (por ejemplo, {new URL(siteUrl).host}/nombre), tu solicitud
            queda asignada a ese asesor y verás su contacto. Esa asignación la hace el sistema y se recuerda durante 30
            días en tu navegador. Siempre puedes pedir que te atienda otra persona del equipo.
          </p>

          <h2 id="propiedad">11. Propiedad intelectual y marcas</h2>
          <p>
            Los textos, el diseño, el logo y el nombre {name} pertenecen a {legalName} o se usan con autorización. No
            puedes copiarlos ni usarlos con fines comerciales sin nuestro permiso. Los nombres y logos de las compañías
            aseguradoras pertenecen a sus respectivos titulares y se mencionan solo para identificarlas.
          </p>

          <h2 id="limitaciones">12. Limitaciones del servicio</h2>
          <ul>
            <li>
              Hacemos lo posible para que el sitio esté disponible y la información sea correcta, pero puede haber
              interrupciones, errores o información desactualizada.
            </li>
            <li>
              La información del sitio y del asesor virtual es general y orientativa; no reemplaza el contenido de la
              póliza ni la asesoría personalizada.
            </li>
            <li>
              Nada en estos términos limita los derechos que te reconoce la ley colombiana como consumidor, incluido el
              Estatuto del Consumidor (Ley 1480 de 2011) y las normas de protección al consumidor financiero.
            </li>
          </ul>

          <h2 id="datos">13. Tratamiento de datos personales</h2>
          <p>
            Tratamos tus datos según nuestra{" "}
            <Link href="/politica-de-privacidad">Política de Tratamiento de Datos Personales</Link>. Antes de enviar una
            solicitud te pedimos autorizaciones separadas: leer la política y estos términos, usar tus datos para
            gestionar tu cotización y —de forma opcional— compartir los datos indispensables con aseguradoras.
          </p>

          <h2 id="cambios">14. Cambios en el sitio y en estos términos</h2>
          <p>
            Podemos actualizar el sitio y estos términos. Publicaremos la nueva versión en esta página con su fecha. Las
            solicitudes ya enviadas se rigen por la versión vigente cuando las enviaste, que registramos junto con tu
            solicitud.
          </p>

          <h2 id="ley">15. Ley aplicable</h2>
          <p>
            Estos términos se rigen por las leyes de la República de Colombia. Si tienes una inquietud o un reclamo,
            escríbenos primero para buscar una solución; también puedes acudir a las autoridades competentes.
          </p>

          <h2 id="contacto">16. Contacto</h2>
          <ul>
            <li>
              <strong>Teléfono o WhatsApp:</strong> {phones}
            </li>
            <li>
              <strong>Correo electrónico:</strong> {contact.email}
            </li>
            <li>
              <strong>Ubicación:</strong> {contact.serviceArea}
            </li>
          </ul>
        </div>
      </Container>
    </section>
  );
}
