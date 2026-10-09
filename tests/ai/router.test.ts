/**
 * PRUEBAS DE LA CAPA DE MODELOS (paso 2.2)
 * Sin red: el "binding" de Workers AI es falso y registra cada llamada (modelo y parámetros).
 */
import { EMPTY_LEAD } from "@/lib/chat";
import { AiError, type AiBinding, createWorkersAiModel, DEFAULT_MODEL, type LanguageModel, WORKERS_AI_PROVIDER } from "@/server/ai/model";
import {
  createModelRouter,
  createWorkersAiRouter,
  defaultRoutes,
  memoryUsageSink,
  MODEL_TASKS,
  ModelRoutingError,
  singleModel,
  type ModelTask,
} from "@/server/ai/router";
import { runAssistantTurn, TURN_TASK } from "@/server/assistant/core";
import { testUsage } from "../fakes/workersAi";
import { prueba } from "../harness";

const RESPUESTA = { reply: "Hola", intent: "informacion", confianza: "alta", insuranceType: "ninguno", datos: {} };

/** Binding falso de Workers AI: registra las llamadas y responde lo indicado. */
function fakeBinding(behavior: (n: number) => unknown | Promise<unknown> = () => ({ response: RESPUESTA })) {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
  const binding: AiBinding = {
    async run(model, input) {
      calls.push({ model, input });
      return behavior(calls.length);
    },
  };
  return { binding, calls };
}

const MSG = [{ role: "user" as const, content: "hola" }];
const SCHEMA = { type: "object" };

async function errorKind(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "sin error";
  } catch (e) {
    return e instanceof AiError ? e.kind : e instanceof ModelRoutingError ? "ruta" : "otro";
  }
}

export async function pruebasRouter() {
  await prueba("Modelos A. Cada tipo de tarea se resuelve por el enrutador", async (check) => {
    const usados: string[] = [];
    const router = createModelRouter({
      providers: [
        {
          id: "prueba",
          create: (model) => ({
            async generateJson() {
              usados.push(model);
              return RESPUESTA;
            },
          }),
        },
      ],
      routes: {
        rapido: { provider: "prueba", model: "m-rapido" },
        razonamiento: { provider: "prueba", model: "m-razonamiento" },
        resumen: { provider: "prueba", model: "m-resumen" },
        extraccion: { provider: "prueba", model: "m-extraccion" },
      },
    });
    check(MODEL_TASKS.length === 4, "existen las tareas rapido, razonamiento, resumen y extraccion");
    for (const task of MODEL_TASKS) {
      await router.forTask(task).generateJson(MSG, SCHEMA, 10);
      check(router.routeFor(task).model === `m-${task}`, `«${task}» usa su propia ruta`);
    }
    check(usados.join(",") === "m-rapido,m-razonamiento,m-resumen,m-extraccion", "cada tarea llegó a su modelo");
  });

  await prueba("Modelos B. Hoy todas las tareas usan Workers AI con la configuración de siempre", async (check) => {
    const routes = defaultRoutes();
    check(
      MODEL_TASKS.every((t) => routes[t].provider === WORKERS_AI_PROVIDER && routes[t].model === DEFAULT_MODEL),
      `todas las rutas → ${WORKERS_AI_PROVIDER} / ${DEFAULT_MODEL}`,
    );
    check(DEFAULT_MODEL === "@cf/meta/llama-3.3-70b-instruct-fp8-fast", "el modelo sigue siendo Llama 3.3 70B fp8-fast");

    // Llamada directa (como antes) vs. por el enrutador: mismos parámetros exactos a Workers AI.
    const directo = fakeBinding();
    await createWorkersAiModel(directo.binding).generateJson(MSG, SCHEMA, 800);
    const enrutado = fakeBinding();
    const router = createWorkersAiRouter(enrutado.binding);
    for (const task of MODEL_TASKS) await router.forTask(task).generateJson(MSG, SCHEMA, 800);
    check(enrutado.calls.length === 4 && enrutado.calls.every((c) => c.model === DEFAULT_MODEL), "una llamada por tarea, mismo modelo");
    check(
      enrutado.calls.every((c) => JSON.stringify(c.input) === JSON.stringify(directo.calls[0].input)),
      "mismos parámetros (mensajes, max_tokens, temperature 0.3, JSON schema)",
    );

    // La variable WORKERS_AI_MODEL sigue funcionando igual que antes, para todas las tareas.
    const override = fakeBinding();
    const r2 = createWorkersAiRouter(override.binding, { modelOverride: "  @cf/otro/modelo  " });
    await r2.forTask("resumen").generateJson(MSG, SCHEMA, 10);
    check(override.calls[0].model === "@cf/otro/modelo", "WORKERS_AI_MODEL se respeta (sin espacios)");
    check(MODEL_TASKS.every((t) => r2.routeFor(t).model === "@cf/otro/modelo"), "el cambio aplica a todas las tareas");

    // El turno del asistente pide «razonamiento» y llega a Workers AI con el modelo actual.
    const turno = fakeBinding();
    const sink = memoryUsageSink();
    await runAssistantTurn({
      history: MSG,
      lead: EMPTY_LEAD,
      advisor: null,
      models: createWorkersAiRouter(turno.binding, { sink }),
      channel: "web",
    });
    check(TURN_TASK === "razonamiento" && sink.entries()[0]?.task === "razonamiento", "el núcleo pide la tarea «razonamiento»");
    check(turno.calls.length === 1 && turno.calls[0].model === DEFAULT_MODEL, "una sola llamada, mismo consumo que antes");
    check(turno.calls[0].input.max_tokens === 800, "mismo límite de salida (800 tokens)");
  });

  await prueba("Modelos C. Un modelo de prueba sustituye al real", async (check) => {
    let llamadas = 0;
    const fake: LanguageModel = {
      async generateJson() {
        llamadas++;
        return RESPUESTA;
      },
    };
    const src = singleModel(fake);
    check(MODEL_TASKS.every((t) => src.forTask(t) === fake), "singleModel entrega el mismo modelo para todas las tareas");
    const turn = await runAssistantTurn({ history: MSG, lead: EMPTY_LEAD, advisor: null, models: src, channel: "whatsapp" });
    check(llamadas === 1 && turn.reply === "Hola", "el núcleo funciona con el modelo de prueba");
    const legacy = await runAssistantTurn({ history: MSG, lead: EMPTY_LEAD, advisor: null, model: fake, channel: "web" });
    check(legacy.reply === "Hola", "compatibilidad: `model` sigue aceptándose");
    check(testUsage.entries().some((e) => e.provider === "prueba"), "las pruebas web pasan por el enrutador real");
  });

  await prueba("Modelos D. Tarea o proveedor desconocido → error, nunca otro proveedor", async (check) => {
    const { binding, calls } = fakeBinding();
    const router = createWorkersAiRouter(binding);
    check((await errorKind(Promise.resolve().then(() => router.forTask("inventada" as ModelTask)))) === "ruta", "tarea desconocida → ModelRoutingError");
    check(calls.length === 0, "no se llamó a ningún proveedor");
    const construir = (routes: unknown) => {
      try {
        createModelRouter({ providers: [{ id: "workers-ai", create: () => ({ generateJson: async () => ({}) }) }], routes: routes as never });
        return "creado";
      } catch (e) {
        return e instanceof ModelRoutingError ? "rechazado" : "otro";
      }
    };
    check(construir({ ...defaultRoutes(), resumen: { provider: "desconocido", model: "x" } }) === "rechazado", "ruta a proveedor no registrado → rechazada");
    const { extraccion: _omitida, ...incompleta } = defaultRoutes();
    void _omitida;
    check(construir(incompleta) === "rechazado", "falta una tarea → rechazada");
    check(construir({ ...defaultRoutes(), adivinar: { provider: "workers-ai", model: "x" } }) === "rechazado", "tarea extra no reconocida → rechazada");
    check((await errorKind(Promise.resolve().then(() => singleModel({ generateJson: async () => ({}) }).forTask("x" as ModelTask)))) === "ruta", "singleModel también rechaza tareas desconocidas");
  });

  await prueba("Modelos E. Fallos del proveedor: mismo comportamiento seguro que antes", async (check) => {
    // Límite de uso → AiError "busy", sin reintento (igual que antes).
    const cupo = fakeBinding(() => {
      throw new Error("3036: daily neuron limit exceeded");
    });
    const sink = memoryUsageSink();
    const r = createWorkersAiRouter(cupo.binding, { sink });
    check((await errorKind(r.forTask("razonamiento").generateJson(MSG, SCHEMA, 10))) === "busy", "cupo agotado → AiError busy");
    check(cupo.calls.length === 1, "sin reintento ante límite de uso");
    check(sink.entries()[0]?.ok === false && sink.entries()[0]?.errorKind === "busy", "el fallo queda registrado");

    // Fallo puntual → un reintento (igual que antes) y luego AiError "failed".
    const falla = fakeBinding(() => {
      throw new Error("internal error");
    });
    const directo = fakeBinding(() => {
      throw new Error("internal error");
    });
    const kindRouter = await errorKind(createWorkersAiRouter(falla.binding).forTask("resumen").generateJson(MSG, SCHEMA, 10));
    const kindDirecto = await errorKind(createWorkersAiModel(directo.binding).generateJson(MSG, SCHEMA, 10));
    check(kindRouter === "failed" && kindRouter === kindDirecto, "fallo → AiError failed (igual que la llamada directa)");
    check(falla.calls.length === 2 && directo.calls.length === 2, "un reintento, igual que antes");

    // El núcleo propaga el error del proveedor sin inventar respuesta.
    const turno = await errorKind(
      runAssistantTurn({ history: MSG, lead: EMPTY_LEAD, advisor: null, models: createWorkersAiRouter(cupo.binding), channel: "web" }),
    );
    check(turno === "busy", "el turno del asistente falla con el mismo error (la web responde «ocupado»)");

    // Un registro de uso que falla nunca rompe la respuesta.
    const ok = fakeBinding();
    const roto = createWorkersAiRouter(ok.binding, {
      sink: {
        record() {
          throw new Error("registro caído");
        },
      },
    });
    check((await errorKind(roto.forTask("rapido").generateJson(MSG, SCHEMA, 10))) === "sin error", "si el registro de uso falla, la respuesta sigue");
  });

  await prueba("Modelos F. Medición de uso: real si existe, null si no", async (check) => {
    const conUso = fakeBinding(() => ({ response: RESPUESTA, usage: { prompt_tokens: 5140, completion_tokens: 87, total_tokens: 5227 } }));
    const sinUso = fakeBinding(() => ({ response: RESPUESTA }));
    const sink = memoryUsageSink();
    await createWorkersAiRouter(conUso.binding, { sink }).forTask("extraccion").generateJson(MSG, SCHEMA, 10);
    await createWorkersAiRouter(sinUso.binding, { sink }).forTask("rapido").generateJson(MSG, SCHEMA, 10);
    const [a, b] = sink.entries();
    check(a.task === "extraccion" && a.provider === WORKERS_AI_PROVIDER && a.model === DEFAULT_MODEL, "registra tarea, proveedor y modelo");
    check(typeof a.latencyMs === "number" && a.latencyMs >= 0, "registra la latencia");
    check(a.inputTokens === 5140 && a.outputTokens === 87, "tokens informados por el proveedor");
    check(b.inputTokens === null && b.outputTokens === null, "sin informe del proveedor → null (no se estima)");
  });
}
