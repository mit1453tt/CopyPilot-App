/**
 * Languages + target markets (countries).
 * SEO phrasing / buyer-intent modifiers adapt per country so the copy and
 * keywords match how people actually search in that market.
 */

export const LANGUAGES = [
  { code: "tr", label: "Türkçe", dir: "ltr" },
  { code: "en", label: "English", dir: "ltr" },
  { code: "es", label: "Español", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "zh", label: "中文", dir: "ltr" },
];

/**
 * Country → { defaultLang, intent[] }.
 * `intent` are neutral discovery modifiers (NOT invented offers) that buyers
 * in that market commonly add to searches. Used only to enrich keyword sets
 * and meta description tone — never fake shipping/awards.
 */
export const COUNTRIES = [
  { code: "TR", label: "Türkiye", defaultLang: "tr", intent: ["fiyat", "modelleri", "online"] },
  { code: "US", label: "United States", defaultLang: "en", intent: ["buy online", "reviews", "for sale"] },
  { code: "GB", label: "United Kingdom", defaultLang: "en", intent: ["uk", "buy online", "reviews"] },
  { code: "ES", label: "España", defaultLang: "es", intent: ["comprar", "opiniones", "online"] },
  { code: "MX", label: "México", defaultLang: "es", intent: ["comprar", "precio", "en línea"] },
  { code: "FR", label: "France", defaultLang: "fr", intent: ["acheter", "avis", "en ligne"] },
  { code: "SA", label: "السعودية", defaultLang: "ar", intent: ["شراء", "أفضل", "أونلاين"] },
  { code: "AE", label: "الإمارات", defaultLang: "ar", intent: ["شراء", "سعر", "أونلاين"] },
  { code: "CN", label: "中国", defaultLang: "zh", intent: ["购买", "价格", "正品"] },
];

export function marketFor(countryCode) {
  return COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];
}

export function isRtl(lang) {
  const l = LANGUAGES.find((x) => x.code === lang);
  return l ? l.dir === "rtl" : false;
}
