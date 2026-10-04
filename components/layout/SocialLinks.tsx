import { siteConfig } from "@/config/site";
import { cn } from "@/lib/format";

const LABELS: Record<keyof typeof siteConfig.social, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

/** Muestra solo las redes sociales que tengan URL en config/site.ts. */
export function SocialLinks({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const entries = (Object.keys(siteConfig.social) as Array<keyof typeof siteConfig.social>).filter(
    (key) => siteConfig.social[key],
  );
  if (entries.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {entries.map((key) => (
        <li key={key}>
          <a
            href={siteConfig.social[key]}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors",
              tone === "light"
                ? "text-white ring-white/20 hover:bg-white/10"
                : "text-brand-700 ring-brand-200 hover:bg-brand-50",
            )}
          >
            {LABELS[key]}
          </a>
        </li>
      ))}
    </ul>
  );
}
