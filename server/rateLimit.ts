import "server-only";

/**
 * Límite de peticiones por visitante (IP), en dos capas:
 * 1) Cloudflare Rate Limiting (binding CHAT_RATE_LIMITER de wrangler.jsonc): ráfagas,
 *    compartido entre todas las instancias. Solo existe en Cloudflare.
 * 2) Memoria de la instancia: N peticiones por ventana de tiempo (funciona en todas partes).
 */

const buckets = new Map<string, number[]>();

interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

async function cloudflareLimiter(): Promise<RateLimiterBinding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const env = getCloudflareContext().env as unknown as Record<string, unknown>;
    return (env.CHAT_RATE_LIMITER as RateLimiterBinding | undefined) ?? null;
  } catch {
    // Fuera de Cloudflare (desarrollo local o Vercel) no hay binding.
    return null;
  }
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  );
}

/** true si el visitante superó el límite. */
export async function rateLimited(scope: string, ip: string, max: number, windowMs: number): Promise<boolean> {
  const key = `${scope}:${ip}`;

  const binding = await cloudflareLimiter();
  if (binding) {
    try {
      if (!(await binding.limit({ key })).success) return true;
    } catch (error) {
      console.error("[rateLimit] binding", error instanceof Error ? error.message : error);
    }
  }

  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5_000) buckets.clear();
  return recent.length > max;
}
