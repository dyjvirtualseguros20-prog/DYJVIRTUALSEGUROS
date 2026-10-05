import { getCurrentContact } from "@/server/advisors";
import { isAssistantVisible } from "@/server/assistant";
import { ChatWidget } from "./ChatWidget";

/**
 * Asesor virtual en las páginas públicas. En producción solo aparece si está
 * configurada ANTHROPIC_API_KEY. Usa el WhatsApp del asesor del enlace (o el de la empresa).
 */
export async function AssistantLauncher() {
  if (!isAssistantVisible()) return null;
  const contact = await getCurrentContact();
  return <ChatWidget whatsappNumber={contact.whatsappNumber} advisorName={contact.advisor?.name ?? null} />;
}
