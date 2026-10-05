import { getCurrentContact } from "@/server/advisors";
import { isAssistantAvailable } from "@/server/assistant";
import { ChatWidget } from "./ChatWidget";

/**
 * Asesor virtual en las páginas públicas. Solo aparece si Workers AI está disponible
 * (Cloudflare, o next dev con wrangler). Usa el WhatsApp del asesor del enlace (o el de la empresa).
 */
export async function AssistantLauncher() {
  if (!(await isAssistantAvailable())) return null;
  const contact = await getCurrentContact();
  return <ChatWidget whatsappNumber={contact.whatsappNumber} advisorName={contact.advisor?.name ?? null} />;
}
