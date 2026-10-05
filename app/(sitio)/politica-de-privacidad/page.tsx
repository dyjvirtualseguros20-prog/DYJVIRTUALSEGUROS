import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/seo";
import { Container } from "@/components/ui/Container";

export const metadata: Metadata = pageMetadata({
  title: "Política de tratamiento de datos personales",
  description: `Cómo ${siteConfig.legalName} recopila, usa y protege los datos personales de quienes solicitan una cotización de seguros.`,
  path: "/politica-de-privacidad",
});

/**
 * POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES
 * Marco: Ley 1581 de 2012 y Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015).
 *
 * Los datos de la empresa se leen de config/site.ts (bloques `legal` y `contact`).
 * Mientras un dato esté vacío, la página lo muestra como "PENDIENTE DE COMPLETAR".
 * Recomendación: hacer revisar el texto final por un asesor legal antes de publicar.
 */

/** Marcador visible para datos que la empresa aún debe suministrar. */
function Pendiente({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900 ring-1 ring-amber-300">
      PENDIENTE DE COMPLETAR: {children}
    </mark>
  );
}

/** Muestra el valor configurado o el marcador de pendiente. */
const dato = (value: string, label: string) => (value ? value : <Pendiente>{label}</Pendiente>);

function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

const SECTIONS = [
  ["responsable", "Quién es el responsable de tus datos"],
  ["datos", "Qué datos recopilamos"],
  ["finalidades", "Para qué usamos tus datos"],
  ["formularios", "Cómo usamos los datos de los formularios de cotización"],
  ["asistente", "Asesor virtual con inteligencia artificial"],
  ["contacto", "Cómo te contactamos"],
  ["seguimiento", "Gestión y seguimiento de tu solicitud"],
  ["terceros", "Con quién compartimos tus datos"],
  ["conservacion", "Cuánto tiempo conservamos tus datos"],
  ["seguridad", "Cómo protegemos tus datos"],
  ["derechos", "Tus derechos"],
  ["ejercer", "Cómo ejercer tus derechos"],
  ["autorizacion", "Tu autorización"],
  ["cambios", "Cambios a esta política"],
] as const;

export default function PrivacyPage() {
  const { contact, whatsapp, legalName, legal } = siteConfig;
  const privacyEmail = legal.privacyEmail || contact.email;

  // Datos obligatorios de la empresa que aún faltan (se listan en el recuadro amarillo).
  const required: Array<[string, string]> = [
    [legal.nit, "NIT"],
    [legal.address, "Dirección del domicilio principal"],
    [legal.city, "Ciudad del domicilio"],
    [privacyEmail, "Correo electrónico para temas de datos personales"],
    [legal.privacyContact, "Persona o área responsable de atender solicitudes"],
  ];
  const pending = required.filter(([value]) => !value).map(([, label]) => label);

  return (
    <section className="pt-28 pb-24 sm:pt-36">
      <Container className="max-w-3xl">
        <p className="text-xs font-bold tracking-[0.18em] text-brand-500 uppercase">Documento legal</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Política de tratamiento de datos personales
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Última actualización: {formatLongDate(legal.privacyPolicyUpdated)}
        </p>

        {pending.length > 0 && (
          <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
            <p className="font-bold">Documento en preparación. Faltan estos datos de la empresa:</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {pending.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Resumen en lenguaje sencillo */}
        <div className="mt-8 rounded-2xl bg-brand-50 p-6 ring-1 ring-brand-100">
          <h2 className="text-base font-bold text-ink">En resumen</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-700">
            <li>Usamos tus datos para preparar tu cotización de seguro y contactarte sobre ella.</li>
            <li>Solo te pedimos la información necesaria para cotizar el seguro que elegiste.</li>
            <li>
              No vendemos tus datos. Solo los compartimos con quien es necesario para cotizar o contratar tu seguro.
            </li>
            <li>Puedes consultar, corregir o pedir que eliminemos tus datos cuando quieras, escribiéndonos.</li>
            <li>
              Si usas el asesor virtual con IA, no guardamos la conversación: solo la solicitud que decidas enviar.
            </li>
          </ul>
        </div>

        <nav aria-label="Contenido" className="mt-8">
          <p className="text-sm font-bold text-ink">Contenido</p>
          <ol className="mt-2 grid list-decimal gap-x-8 gap-y-1 pl-5 text-sm text-brand-700 sm:grid-cols-2">
            {SECTIONS.map(([id, title]) => (
              <li key={id}>
                <a href={`#${id}`} className="hover:underline">
                  {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-12 [&_h2]:scroll-mt-28 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-bold [&_h3]:text-ink [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
          <p>
            En {legalName} (en adelante, «la agencia», «nosotros») respetamos tu privacidad. Esta política explica, de
            forma clara, qué datos personales recopilamos a través de este sitio web, para qué los usamos, con quién los
            compartimos y cómo puedes ejercer tus derechos, de acuerdo con la Ley 1581 de 2012 y sus normas
            reglamentarias.
          </p>

          <h2 id="responsable">1. Quién es el responsable de tus datos</h2>
          <ul>
            <li>
              <strong>Responsable:</strong> {legalName}
            </li>
            <li>
              <strong>NIT:</strong> {dato(legal.nit, "NIT")}
            </li>
            <li>
              <strong>Domicilio:</strong> {dato(legal.address, "dirección")}, {dato(legal.city, "ciudad")}, Colombia
            </li>
            <li>
              <strong>Teléfono y WhatsApp:</strong> {whatsapp.display}
            </li>
            <li>
              <strong>Correo electrónico:</strong> {dato(privacyEmail, "correo para datos personales")}
            </li>
          </ul>
          <p>
            Somos una agencia e intermediario de seguros: te ayudamos a encontrar y comparar opciones de distintas
            aseguradoras. No somos una aseguradora.
          </p>

          <h2 id="datos">2. Qué datos recopilamos</h2>
          <p>
            Solo recopilamos los datos que tú mismo nos das al llenar un formulario de cotización o al enviar una
            solicitud a través del asesor virtual (punto 5):
          </p>
          <h3>Datos de identificación y contacto</h3>
          <ul>
            <li>Nombre completo.</li>
            <li>Número de identificación (cédula) o NIT, cuando el seguro lo requiere.</li>
            <li>Teléfono / WhatsApp y correo electrónico.</li>
            <li>Ciudad.</li>
            <li>Fecha de nacimiento, en los seguros de vida y salud.</li>
          </ul>
          <h3>Datos del seguro que quieres cotizar</h3>
          <ul>
            <li>
              <strong>Vehículos:</strong> placa, marca, modelo o línea, año y tipo de vehículo.
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
              <strong>Viajes:</strong> destino, fechas de salida y regreso y número de viajeros.
            </li>
            <li>
              <strong>Empresas:</strong> razón social, NIT, número de empleados y tipo de seguro de interés, además de
              los datos de la persona de contacto.
            </li>
          </ul>
          <h3>Datos de gestión de tu solicitud</h3>
          <p>
            Fecha de la solicitud, número de referencia, estado (por ejemplo, «En revisión» o «Cotizado»), notas
            internas del asesor, valor de la cotización y fecha en que te contactamos.
          </p>
          <h3>Datos que no pedimos</h3>
          <p>
            En este sitio <strong>no solicitamos datos sensibles</strong>, como información sobre tu estado de salud,
            origen étnico, creencias o datos biométricos. Si para algún seguro (por ejemplo, vida o salud) la
            aseguradora llegara a requerir información de este tipo, te la pediremos por separado, te explicaremos para
            qué se usará y solo la trataremos con tu autorización expresa. Responder preguntas sobre datos sensibles es
            siempre opcional.
          </p>
          <p>
            Este sitio no está dirigido a menores de edad. Para solicitar una cotización debes ser mayor de 18 años.
          </p>

          <h2 id="finalidades">3. Para qué usamos tus datos</h2>
          <ul>
            <li>Recibir y registrar tu solicitud de cotización.</li>
            <li>Analizar tus necesidades y preparar una o varias alternativas de seguro.</li>
            <li>Consultar opciones y precios con aseguradoras para el seguro que solicitaste.</li>
            <li>Contactarte para resolver dudas, completar información y presentarte las opciones.</li>
            <li>Acompañarte en el proceso de contratación, si decides contratar.</li>
            <li>Hacer seguimiento a tu solicitud y llevar un registro interno de su estado.</li>
            <li>Atender tus consultas, reclamos y solicitudes sobre tus datos personales.</li>
            <li>Cumplir obligaciones legales y atender requerimientos de autoridades competentes.</li>
          </ul>
          <p>
            No usaremos tus datos para fines distintos a los descritos aquí sin informarte y, cuando la ley lo exija,
            sin pedirte una nueva autorización.
          </p>

          <h2 id="formularios">4. Cómo usamos los datos de los formularios de cotización</h2>
          <p>Cuando envías un formulario en este sitio:</p>
          <ul>
            <li>Revisamos que los datos estén completos y los guardamos en nuestra base de datos.</li>
            <li>Te asignamos un número de referencia (por ejemplo, «SOL-XXXXXX») para identificar tu solicitud.</li>
            <li>Un asesor de la agencia revisa tu solicitud y prepara la cotización de forma personalizada.</li>
            <li>
              Si es necesario, compartimos con una o varias aseguradoras los datos indispensables para cotizar (por
              ejemplo, los datos del vehículo y tu identificación).
            </li>
            <li>Te contactamos con las alternativas encontradas.</li>
          </ul>
          <p>
            Enviar una solicitud de cotización no te obliga a contratar ningún seguro. Los precios y condiciones finales
            dependen de cada aseguradora.
          </p>

          <h2 id="asistente">5. Asesor virtual con inteligencia artificial</h2>
          <p>
            Este sitio puede ofrecer un <strong>asesor virtual</strong>: un chat automático basado en inteligencia
            artificial que te ayuda a:
          </p>
          <ul>
            <li>Responder preguntas generales sobre seguros y sobre nuestros servicios.</li>
            <li>Orientarte e identificar qué tipo de seguro se ajusta a tu necesidad.</li>
            <li>Recopilar, si tú quieres, los datos necesarios para una solicitud de cotización.</li>
          </ul>
          <p>Así funciona y así tratamos tu información:</p>
          <ul>
            <li>
              Los mensajes que escribes se procesan con <strong>Cloudflare Workers AI</strong>, el servicio de
              inteligencia artificial de Cloudflare, Inc. (empresa con sede en Estados Unidos), que actúa como encargado
              del tratamiento. Los modelos se ejecutan en su red de servidores, que puede estar fuera de Colombia, por
              lo que el contenido de tus mensajes puede transmitirse al exterior solo para generar las respuestas, de
              acuerdo con las políticas de privacidad de Cloudflare.
            </li>
            <li>
              <strong>No guardamos las conversaciones</strong> en nuestra base de datos ni en tu navegador. La
              conversación desaparece al cerrar el chat o la página.
            </li>
            <li>
              Solo si decides enviar una solicitud, el asesor virtual te muestra un resumen; tú lo revisas, aceptas esta
              política y pulsas «Enviar solicitud». En ese momento guardamos los mismos datos de un formulario de
              cotización (punto 2), las observaciones que hayas querido agregar y una marca que indica que la solicitud
              llegó por el asesor virtual. Desde ahí, se trata igual que cualquier otra solicitud (punto 4).
            </li>
            <li>
              El asesor virtual es automático y puede equivocarse. No da precios ni condiciones definitivas: un asesor
              de la agencia revisa cada solicitud y confirma la información.
            </li>
            <li>
              No compartas en el chat datos sensibles (por ejemplo, información de salud), contraseñas ni datos
              bancarios o de tarjetas.
            </li>
            <li>
              Usar el asesor virtual es opcional: también puedes cotizar con los formularios o escribirnos por WhatsApp.
            </li>
          </ul>

          <h2 id="contacto">6. Cómo te contactamos</h2>
          <p>
            Usaremos los datos de contacto que nos diste para comunicarnos contigo <strong>únicamente</strong> sobre tu
            solicitud de cotización y el seguro relacionado, por estos medios:
          </p>
          <ul>
            <li>
              <strong>Llamada telefónica</strong> al número que nos diste.
            </li>
            <li>
              <strong>WhatsApp</strong>, desde nuestro número {whatsapp.display}.
            </li>
            <li>
              <strong>Correo electrónico</strong>, a la dirección que nos diste.
            </li>
          </ul>
          <p>
            Si prefieres que no te contactemos por alguno de estos medios, o que dejemos de contactarte, solo tienes que
            decírnoslo por cualquiera de nuestros canales.
          </p>

          <h2 id="seguimiento">7. Gestión y seguimiento de tu solicitud</h2>
          <p>
            Para darte un buen servicio, registramos el avance de tu solicitud: su estado, las notas del asesor, el
            valor de la cotización y la fecha de contacto. A esta información solo acceden los asesores autorizados de
            la agencia, mediante un usuario y contraseña personales.
          </p>

          <h2 id="terceros">8. Con quién compartimos tus datos</h2>
          <p>
            <strong>No vendemos ni alquilamos tus datos personales.</strong> Solo los compartimos cuando es necesario
            para atender tu solicitud:
          </p>
          <ul>
            <li>
              <strong>Aseguradoras:</strong> los datos indispensables para cotizar y, si decides contratar, para emitir
              la póliza. Cada aseguradora trata esos datos según su propia política de tratamiento de datos.
            </li>
            <li>
              <strong>Proveedores tecnológicos</strong> que nos prestan servicios y actúan por cuenta nuestra
              (encargados del tratamiento), con quienes exigimos medidas de seguridad y confidencialidad:
              <ul>
                <li>
                  Supabase: almacenamiento de la base de datos de solicitudes y acceso de los asesores. Sus servidores
                  están ubicados en São Paulo, Brasil, por lo que tus datos se transmiten fuera de Colombia para este
                  fin.
                </li>
                <li>
                  {legal.hostingProvider
                    ? `${legal.hostingProvider}: alojamiento y publicación de este sitio web.`
                    : "El proveedor de alojamiento donde se publica este sitio web."}
                </li>
                <li>WhatsApp (Meta), cuando la comunicación se realiza por ese medio.</li>
                <li>
                  Cloudflare, Inc. (Workers AI): procesamiento de los mensajes del asesor virtual con inteligencia
                  artificial (punto 5). Su red de servidores puede estar fuera de Colombia.
                </li>
              </ul>
            </li>
            <li>
              <strong>Autoridades</strong>, cuando una ley o una orden de autoridad competente nos lo exija.
            </li>
          </ul>

          <h2 id="conservacion">9. Cuánto tiempo conservamos tus datos</h2>
          <p>Conservamos tus datos solo durante el tiempo necesario para cumplir las finalidades de esta política:</p>
          <ul>
            <li>
              <strong>Si no contratas un seguro:</strong>{" "}
              {legal.retentionPeriod
                ? `conservamos tu solicitud durante ${legal.retentionPeriod} desde su última actualización, para atender consultas o retomar la cotización. Después la eliminamos o la anonimizamos.`
                : "conservamos tu solicitud solo mientras sea útil para atender tus consultas o retomar la cotización. Cuando deja de serlo, o cuando nos pidas eliminarla, la eliminamos o la anonimizamos."}
            </li>
            <li>
              <strong>Si contratas un seguro:</strong> conservamos la información mientras dure la relación y por el
              tiempo adicional que exijan las normas aplicables a la actividad de intermediación de seguros.
            </li>
            <li>
              <strong>Si nos pides eliminar tus datos:</strong> lo haremos, salvo que exista un deber legal o
              contractual de conservarlos.
            </li>
          </ul>

          <h2 id="seguridad">10. Cómo protegemos tus datos</h2>
          <p>Aplicamos medidas técnicas y administrativas razonables para proteger tu información, entre ellas:</p>
          <ul>
            <li>Acceso al panel de solicitudes solo para asesores autorizados, con usuario y contraseña personales.</li>
            <li>
              Reglas en la base de datos que impiden que una persona sin autorización pueda ver o modificar solicitudes.
            </li>
            <li>Conexiones cifradas entre tu navegador, nuestro sitio y la base de datos.</li>
            <li>Los datos del formulario no se guardan en tu navegador ni en tu dispositivo.</li>
            <li>Las conversaciones con el asesor virtual no se almacenan en nuestra base de datos.</li>
            <li>
              Controles para limitar envíos masivos o automatizados de formularios y de mensajes al asesor virtual.
            </li>
          </ul>
          <p>
            Ningún sistema es completamente infalible. Si llegáramos a detectar un incidente que afecte tus datos,
            tomaremos las medidas necesarias y te informaremos cuando la ley así lo exija.
          </p>

          <h2 id="derechos">11. Tus derechos</h2>
          <p>Como titular de tus datos personales, tienes derecho a:</p>
          <ul>
            <li>
              <strong>Conocer</strong> los datos que tenemos sobre ti y <strong>consultarlos</strong> de forma gratuita.
            </li>
            <li>
              <strong>Actualizar y corregir</strong> tus datos si están incompletos, son inexactos o están
              desactualizados.
            </li>
            <li>
              <strong>Pedir prueba</strong> de la autorización que nos diste.
            </li>
            <li>
              <strong>Ser informado</strong> sobre el uso que les hemos dado a tus datos.
            </li>
            <li>
              <strong>Revocar la autorización y pedir la eliminación</strong> de tus datos, cuando no exista un deber
              legal o contractual que nos obligue a conservarlos.
            </li>
            <li>
              <strong>Presentar quejas</strong> ante la Superintendencia de Industria y Comercio (SIC), después de haber
              hecho tu consulta o reclamo ante nosotros.
            </li>
          </ul>

          <h2 id="ejercer">12. Cómo ejercer tus derechos</h2>
          <p>Puedes enviarnos tu consulta, solicitud de corrección o eliminación, o reclamo por estos canales:</p>
          <ul>
            <li>
              <strong>WhatsApp:</strong> {whatsapp.display}
            </li>
            <li>
              <strong>Correo electrónico:</strong> {dato(privacyEmail, "correo para datos personales")}
            </li>
            <li>
              <strong>Responsable de atender tu solicitud:</strong>{" "}
              {dato(legal.privacyContact, "persona o área responsable")}
            </li>
          </ul>
          <p>Para atenderte más rápido, incluye en tu mensaje:</p>
          <ul>
            <li>Tu nombre completo y número de identificación.</li>
            <li>La referencia de tu solicitud (por ejemplo, «SOL-XXXXXX»), si la tienes.</li>
            <li>Qué quieres hacer: consultar, actualizar, corregir o eliminar tus datos, o revocar la autorización.</li>
            <li>Un medio para responderte.</li>
          </ul>
          <p>Podremos pedirte información adicional para verificar tu identidad antes de responder.</p>
          <h3>Tiempos de respuesta</h3>
          <ul>
            <li>
              <strong>Consultas:</strong> máximo 10 días hábiles. Si no es posible, te avisaremos y responderemos a más
              tardar 5 días hábiles después.
            </li>
            <li>
              <strong>Reclamos</strong> (corrección, actualización, eliminación o revocatoria): máximo 15 días hábiles.
              Si no es posible, te avisaremos y responderemos a más tardar 8 días hábiles después.
            </li>
          </ul>

          <h2 id="autorizacion">13. Tu autorización</h2>
          <p>
            Antes de enviar un formulario de cotización (o la solicitud que prepara el asesor virtual) debes marcar la
            casilla «He leído y acepto la Política de Tratamiento de Datos Personales». Al marcarla, nos autorizas de
            forma previa, expresa e informada a tratar tus datos según esta política. Si no la marcas, el formulario no
            se envía.
          </p>
          <p>
            Dar tu autorización es voluntario, pero sin ella no podemos preparar tu cotización. Puedes revocarla en
            cualquier momento por los canales del punto 12. Guardamos la fecha en que nos diste la autorización como
            prueba de ella.
          </p>

          <h2 id="cambios">14. Cambios a esta política</h2>
          <p>
            Podemos actualizar esta política. Cuando hagamos cambios importantes, publicaremos la nueva versión en esta
            página con su fecha de actualización y, si la ley lo exige, te pediremos una nueva autorización.
          </p>
          <p>
            <strong>Vigencia:</strong> esta política rige desde el {formatLongDate(legal.privacyPolicyUpdated)}.
          </p>
        </div>
      </Container>
    </section>
  );
}
