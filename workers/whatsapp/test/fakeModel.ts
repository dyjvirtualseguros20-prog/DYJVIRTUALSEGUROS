/** Modelo de prueba compartido por las pruebas del Worker: imita la salida JSON del modelo real. */
import type { LanguageModel, ModelMessage } from "@/server/ai/model";

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const BRANDS = ["mazda", "chevrolet", "renault", "toyota", "kia", "hyundai", "nissan", "ford", "volkswagen", "suzuki"];

/** Modelo de prueba: imita la salida JSON del modelo real a partir de palabras clave. */
export function fakeModel(): LanguageModel & { calls: number; lastUserMessage: string } {
  const model = {
    calls: 0,
    lastUserMessage: "",
    async generateJson(messages: ModelMessage[]) {
      model.calls++;
      const last = messages.at(-1)?.content ?? "";
      model.lastUserMessage = last;
      const f = fold(last);
      const allUser = fold(messages.filter((m) => m.role === "user").map((m) => m.content).join("\n"));
      let intent = "otro";
      let confianza = "alta";
      let reply = "";
      if (/chocar|chocaron|accidente/.test(f)) [intent, reply] = ["accidente", "Lo siento mucho. Lo primero es tu seguridad."];
      else if (/reclam|no me ha pagado/.test(f)) [intent, reply] = ["reclamacion", "Entiendo tu situación y lamento lo ocurrido."];
      else if (/renov|vence/.test(f)) [intent, reply] = ["renovacion", "Antes de renovar podemos comparar opciones."];
      else if (/persona|humano/.test(f)) [intent, reply] = ["asesor_humano", "Claro."];
      else if (/cuanto (cuesta|vale)|precio/.test(f))
        // Respuesta con un precio INVENTADO: el sistema debe bloquearla.
        [intent, reply] = ["informacion", "Un todo riesgo para tu carro te sale en $1.850.000 al año."];
      else if (/que cubre|que es|como funciona/.test(f))
        [intent, reply] = [
          "informacion",
          "Un seguro todo riesgo puede incluir daños a tu vehículo y a terceros, según las condiciones de la póliza.",
        ];
      else if (/asdk|qwe|zzz/.test(f)) [intent, confianza, reply] = ["otro", "baja", "No entendí tu mensaje."];
      else if (/quiero|cotiz|asegurar|seguro|soy|me llamo|cedula|placa|particular|riesgo|\d{4}/.test(f))
        [intent, reply] = ["cotizacion", "¡Perfecto! 👍 Ya tomé nota."];
      else [intent, confianza, reply] = ["otro", "baja", "No estoy seguro de entenderte."];

      const insuranceType = /carro|vehiculo|moto|camioneta|mazda|toyota|fortuner|cx-5/.test(allUser)
        ? "vehiculos"
        : /vida/.test(allUser)
          ? "vida"
          : "ninguno";

      const datos: Record<string, string> = {};
      const tokens = last.split(/[\s,]+/);
      const b = tokens.findIndex((t) => BRANDS.includes(fold(t)));
      if (b >= 0) {
        datos.brand = tokens[b];
        if (tokens[b + 1] && !/^\d{4}$/.test(tokens[b + 1])) datos.model = tokens[b + 1];
      }
      const plate = last.match(/placa\s+(?:es\s+)?([A-Za-z0-9]+)/i);
      if (plate) datos.plate = plate[1];
      const year = last.match(/año\s+(?:es\s+)?(\d{4})/i);
      if (year) datos.year = year[1];
      return { reply, intent, confianza, insuranceType, datos, cobertura: "", uso: "", observaciones: "" };
    },
  };
  return model;
}
