/**
 * PRUEBAS DEL TOOLRUNNER Y LA AUDITORÍA (paso 2.5) — acciones del panel /admin
 * Sin red: las operaciones reales (con RLS) se sustituyen por funciones falsas que imitan a la
 * base de datos (null / false = RLS no dejó ver o cambiar la fila). Las pruebas contra Supabase
 * real están en supabase/tests/0009_auditoria.sql.
 */
import { memoryAuditSink, safeMetadata } from "@/server/tools/audit";
import {
  createToolRunner,
  memoryIdempotencyStore,
  staticPolicies,
  type Actor,
  type PolicySource,
  type ToolDefinition,
} from "@/server/tools/runner";
import {
  actorFromSession,
  actualizarGestionSolicitud,
  gestionarConversacion,
  type StaffToolDeps,
} from "@/server/tools/staff";
import { z } from "zod";
import { prueba } from "../harness";

const ADMIN_ID = "00000000-0000-4000-8000-0000000000ad";
const ASESOR_ID = "00000000-0000-4000-8000-00000000000a";
const admin = actorFromSession({
  userId: ADMIN_ID,
  email: "prueba@example.com",
  role: "admin_principal",
  advisorId: null,
});
const asesor = actorFromSession({
  userId: ASESOR_ID,
  email: "prueba@example.com",
  role: "asesor",
  advisorId: "prueba-a",
});

/** "Base de datos" falsa: el asesor A solo alcanza la solicitud "propia" y la conversación "conv-a". */
function fakeDeps(opts: { fail?: boolean } = {}) {
  const calls: string[] = [];
  const deps: StaffToolDeps = {
    async updateQuoteRequest(id) {
      calls.push(`solicitud:${id}`);
      if (opts.fail) throw new Error("Base de datos no disponible (simulado)");
      return id === "ajena" ? null : { id };
    },
    async updateConversation(id) {
      calls.push(`conversacion:${id}`);
      return id !== "ajena";
    },
  };
  return { deps, calls };
}

const NOTAS = "Prueba: cliente Carlos Pérez cédula 1020304050 placa ABC123";
const patch = (over: Record<string, unknown> = {}) => ({
  status: "cotizando",
  advisorNotes: NOTAS,
  quoteAmount: 1500000,
  contactedAt: null,
  ...over,
});

export async function pruebasHerramientas() {
  await prueba(
    "Herramientas A. Acción permitida: éxito auditado con la identidad (sin el texto de las notas)",
    async (check) => {
      const audit = memoryAuditSink();
      const { deps, calls } = fakeDeps();
      const r = await createToolRunner({ audit }).run(actualizarGestionSolicitud, admin, deps, {
        id: "propia",
        patch: patch(),
      });
      check(r.status === "ok" && calls.length === 1, "se ejecuta una vez");
      const e = audit.events[0];
      check(
        e?.actorType === "admin" && e.actorId === ADMIN_ID && e.channel === "admin",
        "actor: el administrador (su usuario)",
      );
      check(
        e?.action === "solicitud.actualizar_gestion" && e.level === "ejecutar" && e.outcome === "exito",
        "acción, nivel EJECUTAR y éxito",
      );
      check(e?.resourceType === "quote_request" && e.resourceId === "propia", "recurso afectado");
      check(
        e?.metadata.status === "cotizando" && e.metadata.anotado === true && e.metadata.valorCotizado === true,
        "qué cambió (sin contenido)",
      );
      check(
        !JSON.stringify(audit.events).match(/Carlos|1020304050|ABC123|1500000/),
        "ni las notas ni el valor quedan en la auditoría",
      );
    },
  );

  await prueba("Herramientas B. Asesor sobre un recurso ajeno: RLS lo bloquea → DENEGADO y auditado", async (check) => {
    const audit = memoryAuditSink();
    const { deps } = fakeDeps();
    const runner = createToolRunner({ audit });
    const r = await runner.run(actualizarGestionSolicitud, asesor, deps, { id: "ajena", patch: patch() });
    check(r.status === "denegado" && r.reason === "sin_acceso_o_no_existe", "solicitud ajena: denegado");
    const c = await runner.run(gestionarConversacion, asesor, deps, {
      id: "ajena",
      patch: { status: "asesor", assignedAdvisorId: "prueba-a", take: true },
    });
    check(c.status === "denegado", "conversación ajena: denegado");
    check(
      audit.events.length === 2 &&
        audit.events.every((e) => e.outcome === "denegado" && e.actorType === "asesor" && e.actorId === ASESOR_ID),
      "ambos intentos quedan auditados con la identidad del asesor",
    );
  });

  await prueba(
    "Herramientas C. Asesor intentando reasignar: se niega ANTES de tocar la base de datos",
    async (check) => {
      const audit = memoryAuditSink();
      const { deps, calls } = fakeDeps();
      const runner = createToolRunner({ audit });
      const otro = await runner.run(gestionarConversacion, asesor, deps, {
        id: "conv-a",
        patch: { status: "asesor", assignedAdvisorId: "prueba-b", take: false },
      });
      const soltar = await runner.run(gestionarConversacion, asesor, deps, {
        id: "conv-a",
        patch: { status: "bot", assignedAdvisorId: null, take: false },
      });
      check(
        otro.status === "denegado" && otro.reason === "reasignacion_no_permitida",
        "no puede pasarla a otro asesor",
      );
      check(soltar.status === "denegado", "no puede soltarla");
      check(calls.length === 0, "no se llegó a la base de datos");
      const propia = await runner.run(gestionarConversacion, asesor, deps, {
        id: "conv-a",
        patch: { status: "asesor", assignedAdvisorId: "prueba-a", take: true },
      });
      check(propia.status === "ok", "sí gestiona su propia conversación");
      const adm = await runner.run(gestionarConversacion, admin, deps, {
        id: "conv-a",
        patch: { status: "bot", assignedAdvisorId: "prueba-b", take: false },
      });
      check(adm.status === "ok", "el administrador reasigna sin restricción");
    },
  );

  await prueba("Herramientas D. Usuario inactivo, actor no permitido y entrada inválida → denegado", async (check) => {
    const audit = memoryAuditSink();
    const { deps, calls } = fakeDeps();
    const runner = createToolRunner({ audit });
    const inactivo: Actor = { ...asesor, active: false };
    const a = await runner.run(actualizarGestionSolicitud, inactivo, deps, { id: "propia", patch: patch() });
    check(a.status === "denegado" && a.reason === "actor_inactivo", "cuenta inactiva");
    const ia: Actor = { type: "ia", id: "asesor-virtual", channel: "whatsapp", active: true };
    const b = await runner.run(actualizarGestionSolicitud, ia, deps, { id: "propia", patch: patch() });
    check(b.status === "denegado" && b.reason === "actor_no_permitido", "la IA no usa las acciones del panel");
    const c = await runner.run(actualizarGestionSolicitud, admin, deps, {
      id: "propia",
      patch: patch({ status: "aprobada" }),
    });
    check(c.status === "denegado" && c.reason === "entrada_invalida", "estado inexistente");
    check(calls.length === 0 && audit.events.length === 3, "nada se ejecutó y los 3 intentos quedan auditados");
  });

  await prueba("Herramientas E. Fallo durante la acción: ERROR auditado con su mensaje", async (check) => {
    const audit = memoryAuditSink();
    const { deps } = fakeDeps({ fail: true });
    const r = await createToolRunner({ audit }).run(actualizarGestionSolicitud, admin, deps, {
      id: "propia",
      patch: patch(),
    });
    check(r.status === "error", "devuelve error (el panel muestra un mensaje genérico)");
    check(
      audit.events[0]?.outcome === "error" && /no disponible/.test(audit.events[0].errorMessage ?? ""),
      "auditado: error con su mensaje técnico",
    );
    check(!JSON.stringify(audit.events).includes("Carlos"), "sin datos de las notas");
  });

  await prueba(
    "Herramientas F. Políticas: desactivar bloquea; nunca se relaja; sin política no se actúa",
    async (check) => {
      const audit = memoryAuditSink();
      const { deps, calls } = fakeDeps();
      const off = createToolRunner({
        audit,
        policies: staticPolicies({ "solicitud.actualizar_gestion": { enabled: false, requiresHuman: false } }),
      });
      const r = await off.run(actualizarGestionSolicitud, admin, deps, { id: "propia", patch: patch() });
      check(
        r.status === "denegado" && r.reason === "accion_desactivada" && calls.length === 0,
        "acción desactivada: no se ejecuta",
      );
      const human = createToolRunner({
        audit,
        policies: staticPolicies({ "solicitud.actualizar_gestion": { enabled: true, requiresHuman: true } }),
      });
      const h = await human.run(actualizarGestionSolicitud, admin, deps, { id: "propia", patch: patch() });
      check(h.status === "ok", "«requiere humano» no frena a una persona del panel");
      const broken: PolicySource = {
        async get() {
          throw new Error("sin conexión");
        },
      };
      const b = await createToolRunner({ audit, policies: broken }).run(actualizarGestionSolicitud, admin, deps, {
        id: "propia",
        patch: patch(),
      });
      check(b.status === "error" && calls.length === 1, "sin poder leer la política, no se actúa (falla cerrado)");
    },
  );

  await prueba("Herramientas G. Idempotencia y PROPONER (ToolRunner genérico)", async (check) => {
    const audit = memoryAuditSink();
    const idempotency = memoryIdempotencyStore();
    let runs = 0;
    let fail = true;
    const tool: ToolDefinition<{ n: number }, { n: number }, null> = {
      name: "prueba.contar",
      level: "ejecutar",
      actors: ["ia", "admin"],
      input: z.object({ n: z.number() }),
      resource: () => ({ type: "prueba", id: "1" }),
      async execute(_ctx, i) {
        runs++;
        if (fail) {
          fail = false;
          throw new Error("fallo puntual");
        }
        return { n: i.n };
      },
    };
    const runner = createToolRunner({ audit, idempotency });
    const ia: Actor = { type: "ia", id: "asesor-virtual", channel: "whatsapp", active: true };
    const r1 = await runner.run(tool, ia, null, { n: 1 }, { idempotencyKey: "k" });
    const r2 = await runner.run(tool, ia, null, { n: 1 }, { idempotencyKey: "k" });
    const r3 = await runner.run(tool, ia, null, { n: 1 }, { idempotencyKey: "k" });
    check(
      r1.status === "error" && r2.status === "ok" && r3.status === "duplicado",
      "fallo → reintento ejecuta → repetición es duplicado",
    );
    check(runs === 2, "la acción con éxito se ejecutó una sola vez");
    check(
      audit.events.map((e) => e.outcome).join(",") === "error,exito,duplicado",
      "los tres resultados quedan auditados",
    );

    const delicada: ToolDefinition<{ n: number }, never, null> = {
      ...tool,
      name: "prueba.delicada",
      requiresHuman: true,
    } as never;
    const sinBuzon = await runner.run(delicada, ia, null, { n: 1 });
    check(
      sinBuzon.status === "denegado" && sinBuzon.reason === "requiere_humano",
      "acción delicada sin buzón de propuestas: la IA no la ejecuta",
    );
    check(runs === 2, "y no se ejecutó");
  });

  await prueba("Herramientas H. Los metadatos de auditoría descartan datos sensibles", async (check) => {
    const m = safeMetadata({
      status: "cotizando",
      phone: "3001234567",
      email: "x@example.com",
      body: "texto del cliente",
      fullName: "Carlos",
      documentNumber: "1020304050",
      plate: "ABC123",
      advisorNotes: "notas",
      nested: { a: 1 },
      largo: "x".repeat(500),
      lista: ["a", "b"],
    });
    check(m.status === "cotizando" && Array.isArray(m.lista), "conserva lo útil");
    check(
      !(
        "phone" in m ||
        "email" in m ||
        "body" in m ||
        "fullName" in m ||
        "documentNumber" in m ||
        "plate" in m ||
        "advisorNotes" in m
      ),
      "descarta teléfono, correo, texto, nombre, documento, placa y notas",
    );
    check(!("nested" in m) && String(m.largo).length === 120, "sin objetos anidados y textos recortados");
  });
}
