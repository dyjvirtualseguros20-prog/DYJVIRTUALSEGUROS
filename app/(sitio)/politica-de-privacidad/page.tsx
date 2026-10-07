import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { CONSENT_TEXT } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";
import { Container } from "@/components/ui/Container";
import { LEGAL_PROSE, LegalToc, dato, formatLongDate } from "@/components/legal/LegalBits";

export const metadata: Metadata = pageMetadata({
  title: "Política de tratamiento de datos personales",
  description: `Cómo ${siteConfig.legalName} recopila, usa, comparte y protege los datos personales de quienes solicitan una cotización de seguros.`,
  path: "/politica-de-privacidad",
});

/**
 * POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES (versión en config/site.ts → legal.privacyPolicyVersion)
 * Marco: Ley 1581 de 2012 y Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015).
 *
 * Los datos de la empresa se leen de config/site.ts (bloques `legal` y `contact`).
 * Lo que falte aparece como [POR COMPLETAR]: nunca se inventa.
 * Recomendación: revisión por un abogado colombiano antes de darla por definitiva.
 */
const SECTIONS = [
  ["responsable", "Responsable del tratamiento"],
  ["datos", "Qué datos recopilamos"],
  ["finalidades", "Para qué usamos tus datos"],
  ["autorizaciones", "Tus autorizaciones"],
  ["aseguradoras", "Cotizaciones y envío de datos a aseguradoras"],
  ["asistente", "Asesor virtual con inteligencia artificial"],
  ["contacto", "Cómo te contactamos (incluido WhatsApp)"],
  ["sensibles", "Datos sensibles y de menores de edad"],
  ["terceros", "Proveedores tecnológicos y transferencias"],
  ["cookies", "Cookies y almacenamiento en tu navegador"],
  ["conservacion", "Cuánto tiempo conservamos tus datos"],
  ["seguridad", "Cómo protegemos tus datos"],
  ["derechos", "Tus derechos"],
  ["ejercer", "Consultas y reclamos: cómo ejercer tus derechos"],
  ["cambios", "Cambios a esta política y vigencia"],
] as const;

export default function PrivacyPage() {
  const { contact, legalName, legal } = siteConfig;
  // Los dos números oficiales de los asesores (llamadas y WhatsApp).
  const phones = siteConfig.advisorLines.map((l) => l.display).join(" y ");
  const privacyEmail = legal.privacyEmail || contact.email;

  return (
    <section className="pt-28 pb-24 sm:pt-36">
      <Container className="max-w-3xl">
        <p className="text-xs font-bold tracking-[0.18em] text-brand-500 uppercase">Documento legal</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Política de tratamiento de datos personales
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Versión {legal.privacyPolicyVersion} · Última actualización: {formatLongDate(legal.privacyPolicyUpdated)}
        </p>

        <div className="mt-8 rounded-2xl bg-brand-50 p-6 ring-1 ring-brand-100">
          <h2 className="text-base font-bold text-ink">En resumen</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-700">
            <li>Usamos tus datos para gestionar tu solicitud de cotización y contactarte sobre ella.</li>
            <li>Solo pedimos lo necesario para cotizar el seguro que elegiste. No pedimos datos de salud.</li>
            <li>
              Compartimos con aseguradoras solo los datos indispensables, y únicamente con tu autorización. No vendemos
              tus datos.
            </li>
            <li>Si usas el asesor virtual, no guardamos la conversación: solo la solicitud que decidas enviar.</li>
            <li>Puedes consultar, corregir o pedir que eliminemos tus datos cuando quieras.</li>
          </ul>
        </div>

        <LegalToc sections={SECTIONS} />

        <div className={LEGAL_PROSE}>
          <p>
            En {legalName} (en adelante, «la agencia», «nosotros») respetamos tu privacidad. Esta política explica qué
            datos personales recopilamos a través de este sitio web, para qué los usamos, con quién los compartimos y
            cómo puedes ejercer tus derechos, de acuerdo con la Ley 1581 de 2012 y sus normas reglamentarias.
            Complementa los <Link href="/terminos-y-condiciones">Términos y Condiciones</Link> del sitio.
          </p>

          <h2 id="responsable">1. Responsable del tratamiento</h2>
          <ul>
            <li>
              <strong>Responsable:</strong> {legalName}
            </li>
            <li>
              <strong>NIT:</strong> {dato(legal.nit, "NIT")}
              {legal.nitCheckDigit ? `-${legal.nitCheckDigit}` : <>-{dato("", "dígito de verificación")}</>}
            </li>
            <li>
              <strong>Representante legal:</strong> {dato(legal.legalRepresentative, "nombre del representante legal")}
            </li>
            <li>
              <strong>Domicilio:</strong> {dato(legal.address, "dirección")}, {dato(legal.city, "ciudad")}, Colombia (no
              es una oficina abierta al público)
            </li>
            <li>
              <strong>Teléfonos y WhatsApp de los asesores:</strong> {phones}
            </li>
            <li>
              <strong>Correo para temas de datos personales:</strong>{" "}
              {dato(privacyEmail, "correo para datos personales")}
            </li>
          </ul>
          <p>
            Somos una agencia e intermediario de seguros: te ayudamos a encontrar y comparar opciones de distintas
            aseguradoras. No somos una aseguradora.
          </p>

          <h2 id="datos">2. Qué datos recopilamos</h2>
          <p>
            Solo recopilamos los datos que tú nos das al enviar una solicitud de cotización (formulario o asesor
            virtual) o al escribirnos:
          </p>
          <h3>Identificación y contacto</h3>
          <ul>
            <li>Nombre completo y número de identificación (cédula) o NIT, cuando aplica.</li>
            <li>Celular / WhatsApp, correo electrónico (opcional en el asesor virtual) y ciudad.</li>
            <li>Fecha de nacimiento, en los seguros de vida y salud.</li>
          </ul>
          <h3>Datos del seguro que quieres cotizar</h3>
          <ul>
            <li>
              <strong>Vehículos:</strong> placa, marca, línea, año, tipo de vehículo, uso (particular o comercial) y
              cobertura de interés.
            </li>
            <li>
              <strong>Vida:</strong> valor aproximado de cobertura deseada.
            </li>
            <li>
              <strong>Hogar:</strong> tipo de vivienda, si eres propietario o arrendatario y valor aproximado del
              inmueble.
            </li>
            <li>
              <strong>Salud:</strong> tipo de plan (individual o familiar) y número de personas.
            </li>
            <li>
              <strong>Viajes:</strong> destino, fechas y número de viajeros.
            </li>
            <li>
              <strong>Empresas:</strong> razón social, NIT, número de empleados y seguro de interés, además de los datos
              de la persona de contacto.
            </li>
          </ul>
          <h3>Datos de gestión de tu solicitud</h3>
          <p>
            Número de referencia, fecha, estado, asesor asignado, origen (formulario o asesor virtual), notas internas,
            valor de la cotización, fecha de contacto y el registro de tus autorizaciones (punto 4).
          </p>
          <h3>Datos técnicos</h3>
          <p>
            Para que el sitio funcione y sea seguro, nuestros proveedores generan registros técnicos (por ejemplo,
            dirección IP, fecha y página visitada) y usamos una cookie para recordar el asesor asignado (punto 10). No
            usamos estos datos para crear perfiles publicitarios.
          </p>

          <h2 id="finalidades">3. Para qué usamos tus datos</h2>
          <ul>
            <li>Recibir, registrar y dar seguimiento a tu solicitud de cotización.</li>
            <li>Analizar tu necesidad y preparar una o varias alternativas de seguro.</li>
            <li>
              Solicitar cotizaciones a las aseguradoras, compartiendo solo los datos indispensables y con tu
              autorización (punto 5).
            </li>
            <li>Contactarte para resolver dudas, completar información y presentarte las alternativas.</li>
            <li>Acompañarte en la contratación, si decides contratar, y después de ella.</li>
            <li>Atender tus consultas, reclamos y solicitudes sobre tus datos.</li>
            <li>Proteger el sitio contra usos indebidos y cumplir obligaciones legales.</li>
          </ul>
          <p>
            No usaremos tus datos para fines distintos sin informarte y, cuando la ley lo exija, sin tu autorización.
          </p>

          <h2 id="autorizaciones">4. Tus autorizaciones</h2>
          <p>Antes de enviar una solicitud te pedimos tres autorizaciones separadas, para que sepas qué aceptas:</p>
          <ul>
            <li>
              <strong>A. Política y términos (obligatoria):</strong> «{CONSENT_TEXT.privacyAccepted.before}{" "}
              {CONSENT_TEXT.privacyAccepted.policy} {CONSENT_TEXT.privacyAccepted.middle}{" "}
              {CONSENT_TEXT.privacyAccepted.terms}».
            </li>
            <li>
              <strong>B. Gestión de tu cotización (obligatoria):</strong> «{CONSENT_TEXT.dataConsent.text}» Sin esta
              autorización no podemos atender tu solicitud.
            </li>
            <li>
              <strong>C. Envío a aseguradoras (opcional):</strong> «{CONSENT_TEXT.insurerConsent.text}» Si no la marcas,
              un asesor te pedirá autorización antes de compartir cualquier dato con una aseguradora.
            </li>
          </ul>
          <p>
            Guardamos con tu solicitud un <strong>registro de tus autorizaciones</strong>: cuáles diste, la fecha y la
            hora, la versión de esta política y de los términos, y el origen de la solicitud. Ese registro sirve como
            prueba de tu autorización. Dar tus autorizaciones es voluntario y puedes revocarlas en cualquier momento
            (punto 14).
          </p>

          <h2 id="aseguradoras">5. Cotizaciones y envío de datos a aseguradoras</h2>
          <ul>
            <li>
              Para cotizar, un asesor consulta a una o varias aseguradoras. Solo compartimos los{" "}
              <strong>datos indispensables</strong> para el seguro solicitado (por ejemplo, identificación, ciudad,
              contacto y datos del vehículo) y solo si diste la autorización C o la das después a tu asesor.
            </li>
            <li>
              En el futuro algunas cotizaciones podrán hacerse automáticamente mediante conexiones (API) con las
              aseguradoras. Se aplicarán las mismas reglas: tu autorización previa, solo los datos necesarios, envío
              desde nuestros servidores y un registro de qué tipo de datos se enviaron, a qué aseguradora y cuándo. El
              asesor virtual nunca decide por sí solo enviar tus datos a una aseguradora.
            </li>
            <li>
              Cada aseguradora trata los datos que recibe como responsable independiente, según su propia política de
              tratamiento de datos.
            </li>
            <li>
              Enviar una solicitud no te obliga a contratar. Cotizar no significa contratar: la emisión de una póliza
              depende de la aseguradora.
            </li>
          </ul>

          <h2 id="asistente">6. Asesor virtual con inteligencia artificial</h2>
          <ul>
            <li>
              El asesor virtual es un chat automático con inteligencia artificial (no una persona) que responde
              preguntas generales, te orienta y, si quieres, prepara tu solicitud.
            </li>
            <li>
              Tus mensajes se procesan con <strong>Cloudflare Workers AI</strong> (Cloudflare, Inc., Estados Unidos),
              que actúa como encargado del tratamiento. Los modelos se ejecutan en su red de servidores, que puede estar
              fuera de Colombia, solo para generar las respuestas y según las políticas de Cloudflare.
            </li>
            <li>
              <strong>No guardamos las conversaciones</strong> en nuestra base de datos ni en tu navegador.
            </li>
            <li>
              Solo si confirmas el resumen y das tus autorizaciones, guardamos los datos de la solicitud (punto 2) y una
              marca de que llegó por el asesor virtual.
            </li>
            <li>
              El asesor virtual puede equivocarse, no da precios ni confirma aprobaciones: un asesor de la agencia
              revisa cada solicitud.
            </li>
          </ul>

          <h2 id="contacto">7. Cómo te contactamos (incluido WhatsApp)</h2>
          <p>
            Usaremos tus datos de contacto <strong>únicamente</strong> para comunicarnos sobre tu solicitud y el seguro
            relacionado: por llamada, por WhatsApp (desde los números de nuestros asesores, {phones}) o por correo
            electrónico. WhatsApp es un servicio de Meta, sujeto a sus propias políticas. Si prefieres que no te
            contactemos por algún medio, o que dejemos de hacerlo, solo tienes que decírnoslo.
          </p>

          <h2 id="sensibles">8. Datos sensibles y de menores de edad</h2>
          <ul>
            <li>
              En este sitio <strong>no pedimos datos sensibles</strong> (como información de salud, origen étnico,
              creencias o datos biométricos). La fecha de nacimiento que pedimos en vida y salud no es un dato sensible.
            </li>
            <li>
              Si escribes datos de salud en el chat, el sistema está diseñado para no guardarlos en tu solicitud. Por
              favor, no los compartas por ese medio.
            </li>
            <li>
              Si una aseguradora llegara a requerir información sensible (por ejemplo, una declaración de salud para un
              seguro de vida), te la pediremos por separado, te explicaremos para qué se usará y solo la trataremos con
              tu autorización expresa. Responder preguntas sobre datos sensibles es facultativo.
            </li>
            <li>
              Este sitio no está dirigido a menores de edad. Para enviar una solicitud debes ser mayor de 18 años. Si en
              un seguro familiar se incluyen menores, sus datos se tratarán en su interés superior y con la autorización
              de su representante legal.
            </li>
          </ul>

          <h2 id="terceros">9. Proveedores tecnológicos y transferencias</h2>
          <p>
            <strong>No vendemos ni alquilamos tus datos.</strong> Para operar usamos proveedores que tratan los datos
            por cuenta nuestra (encargados), con medidas de seguridad y confidencialidad:
          </p>
          <ul>
            <li>
              <strong>Supabase:</strong> base de datos de solicitudes y acceso de los asesores. Servidores en São Paulo,
              Brasil.
            </li>
            <li>
              <strong>{legal.hostingProvider || "Proveedor de alojamiento"}:</strong> alojamiento y publicación del
              sitio, protección contra ataques y asesor virtual (Workers AI). Red global de servidores, con sede en
              Estados Unidos.
            </li>
            <li>
              <strong>Vercel Inc.:</strong> copia de respaldo del sitio. Estados Unidos.
            </li>
            <li>
              <strong>Meta (WhatsApp):</strong> cuando nos escribes o te escribimos por ese medio.
            </li>
          </ul>
          <p>
            Por esto, tus datos pueden almacenarse o procesarse fuera de Colombia. Al darnos tus autorizaciones aceptas
            esta transmisión para las finalidades de esta política. También compartimos datos con{" "}
            <strong>aseguradoras</strong> (punto 5) y con <strong>autoridades</strong> cuando la ley o una orden
            competente lo exijan.
          </p>

          <h2 id="cookies">10. Cookies y almacenamiento en tu navegador</h2>
          <ul>
            <li>
              <strong>Cookie «asesor»:</strong> si entras por el enlace de un asesor, recuerda durante 30 días a qué
              asesor se asigna tu solicitud. Es necesaria para esa función.
            </li>
            <li>
              <strong>Aviso del asesor virtual:</strong> tu navegador recuerda que ya viste el mensaje de bienvenida,
              para no repetirlo.
            </li>
            <li>
              <strong>Sesión de asesores:</strong> el panel interno usa cookies de inicio de sesión, solo para los
              asesores autorizados.
            </li>
          </ul>
          <p>No usamos cookies de publicidad. Puedes borrar las cookies desde la configuración de tu navegador.</p>

          <h2 id="conservacion">11. Cuánto tiempo conservamos tus datos</h2>
          <ul>
            <li>
              <strong>Si no contratas un seguro:</strong>{" "}
              {legal.retentionPeriod
                ? `conservamos tu solicitud durante ${legal.retentionPeriod} desde su última actualización. Después la eliminamos o la anonimizamos.`
                : "conservamos tu solicitud solo mientras sea útil para atender tus consultas o retomar la cotización. Cuando deja de serlo, o cuando nos pidas eliminarla, la eliminamos o la anonimizamos."}
            </li>
            <li>
              <strong>Si contratas un seguro:</strong> mientras dure la relación y por el tiempo adicional que exijan
              las normas aplicables a la intermediación de seguros.
            </li>
            <li>
              <strong>Registro de autorizaciones:</strong> mientras sea necesario para demostrar que nos diste tu
              autorización.
            </li>
            <li>
              <strong>Si pides eliminar tus datos:</strong> lo haremos, salvo que exista un deber legal o contractual de
              conservarlos.
            </li>
          </ul>

          <h2 id="seguridad">12. Cómo protegemos tus datos</h2>
          <ul>
            <li>Acceso al panel de solicitudes solo para asesores autorizados, con usuario y contraseña personales.</li>
            <li>Reglas en la base de datos que impiden ver o modificar solicitudes sin autorización.</li>
            <li>Conexiones cifradas (HTTPS) entre tu navegador, el sitio y la base de datos.</li>
            <li>Las claves y credenciales de los sistemas están solo en los servidores, nunca en tu navegador.</li>
            <li>Los datos de los formularios y las conversaciones del asesor virtual no se guardan en tu navegador.</li>
            <li>Límites contra envíos masivos o automatizados de formularios y de mensajes al asesor virtual.</li>
          </ul>
          <p>
            Ningún sistema es infalible. Si detectamos un incidente que afecte tus datos, tomaremos las medidas
            necesarias y te informaremos, y a la autoridad, cuando la ley lo exija.
          </p>

          <h2 id="derechos">13. Tus derechos</h2>
          <p>Como titular de tus datos tienes derecho a:</p>
          <ul>
            <li>
              <strong>Conocer, actualizar y corregir</strong> tus datos.
            </li>
            <li>
              <strong>Pedir prueba</strong> de la autorización que nos diste.
            </li>
            <li>
              <strong>Ser informado</strong> sobre el uso que les damos a tus datos.
            </li>
            <li>
              <strong>Revocar la autorización y pedir la supresión</strong> de tus datos, cuando no exista un deber
              legal o contractual de conservarlos.
            </li>
            <li>
              <strong>Acceder gratuitamente</strong> a tus datos.
            </li>
            <li>
              <strong>Presentar quejas</strong> ante la Superintendencia de Industria y Comercio (SIC), después de
              agotar la consulta o el reclamo ante nosotros.
            </li>
          </ul>

          <h2 id="ejercer">14. Consultas y reclamos: cómo ejercer tus derechos</h2>
          <ul>
            <li>
              <strong>Correo electrónico:</strong> {dato(privacyEmail, "correo para datos personales")}
            </li>
            <li>
              <strong>Teléfono o WhatsApp:</strong> {phones}
            </li>
            <li>
              <strong>Responsable de atender tu solicitud:</strong>{" "}
              {dato(legal.privacyContact, "persona o área responsable")}
            </li>
          </ul>
          <p>
            Incluye tu nombre completo e identificación, la referencia de tu solicitud si la tienes («SOL-XXXXXX»), lo
            que quieres hacer y un medio para responderte. Podremos pedirte información adicional para verificar tu
            identidad.
          </p>
          <ul>
            <li>
              <strong>Consultas:</strong> respondemos en máximo 10 días hábiles. Si no es posible, te avisaremos el
              motivo y responderemos a más tardar 5 días hábiles después.
            </li>
            <li>
              <strong>Reclamos</strong> (corrección, actualización, supresión o revocatoria): respondemos en máximo 15
              días hábiles. Si el reclamo está incompleto, te pediremos completarlo dentro de los 5 días siguientes; si
              no lo haces en 2 meses, se entenderá desistido. Si no podemos responder a tiempo, te avisaremos el motivo
              y responderemos a más tardar 8 días hábiles después.
            </li>
          </ul>

          <h2 id="cambios">15. Cambios a esta política y vigencia</h2>
          <p>
            Podemos actualizar esta política. Publicaremos la nueva versión en esta página con su número y fecha y, si
            el cambio es importante o la ley lo exige, te pediremos una nueva autorización. Cada solicitud guarda la
            versión de la política vigente cuando la enviaste.
          </p>
          <p>
            <strong>Versión {legal.privacyPolicyVersion}</strong>, vigente desde el{" "}
            {formatLongDate(legal.privacyPolicyUpdated)}.
          </p>
        </div>
      </Container>
    </section>
  );
}
