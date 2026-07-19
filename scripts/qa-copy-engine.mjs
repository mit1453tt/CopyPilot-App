/**
 * Automated QA for CopyPilot copyEngine — run with: node scripts/qa-copy-engine.mjs
 * Does NOT touch Size Wizard or other apps.
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const enginePath = path.join(__dirname, "../extensions/copy-pilot-home/src/copyEngine.js");
const marketsPath = path.join(__dirname, "../extensions/copy-pilot-home/src/markets.js");
const plansPath = path.join(__dirname, "../extensions/copy-pilot-home/src/plans.js");

// Dynamic import of ES modules
const engine = await import(pathToFileURL(enginePath).href);
const markets = await import(pathToFileURL(marketsPath).href);
const plans = await import(pathToFileURL(plansPath).href);

const {
  buildSalesTitle,
  buildListingPackage,
  suggestKeywords,
  buildAidaHtml,
} = engine;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error("FAIL:", msg);
  } else {
    console.log("OK  :", msg);
  }
}

const product = {
  id: "gid://shopify/Product/1",
  title: "the multi-managed snowboard",
  vendor: "Multi-managed Vendor",
  productType: "snowboard",
  tags: ["premium", "all-mountain", "camber"],
  descriptionHtml:
    "<ul><li>Hybrid profile adapts to powder and ice</li><li>Lightweight core absorbs impact</li><li>Sharp edges for rail-like grip</li></ul>",
  media: { nodes: [] },
};

// 1) Title Case
const title = buildSalesTitle(product, "snowboard", "en");
assert(
  title === "Multi-Managed Vendor The Multi-Managed Snowboard" ||
    title.startsWith("Multi-Managed Vendor The Multi-Managed"),
  `Title Case → "${title}"`
);
assert(!title.includes("|"), "Title has no pipe keyword dump");
assert(title.includes("The "), `Title capitalizes The → "${title}"`);

// 2) No admin / fake claims in body
for (const lang of ["tr", "en", "es", "fr", "ar", "zh"]) {
  const pkg = buildListingPackage(product, {
    language: lang,
    country: markets.COUNTRIES.find((c) => c.defaultLang === lang)?.code || "US",
    keywords: ["snowboard", "all-mountain snowboard"],
  });
  const body = pkg.bodyHtml.toLowerCase();
  assert(!/search focus|brand:|category:|stops scrolling|sales-led/.test(body), `${lang}: no admin/meta talk`);
  assert(!/free shipping|ücretsiz kargo|\bgoogle\b/.test(body), `${lang}: no fake claims`);
  assert(/✓|✅|⚙️|🏂|📌/.test(pkg.bodyHtml) || /★|◆|→/.test(pkg.bodyHtml), `${lang}: has symbols`);
  assert(pkg.bodyHtml.includes("Hybrid profile") || pkg.bodyHtml.includes("📌"), `${lang}: uses product features / bottom list`);
  assert(pkg.keywords.length >= 1, `${lang}: keywords present`);
  assert(pkg.metaTitle.length <= 60, `${lang}: meta title ≤60 (${pkg.metaTitle.length})`);
  assert(pkg.metaDescription.length <= 160, `${lang}: meta desc ≤160 (${pkg.metaDescription.length})`);
}

// 3) Empty keywords → 3 suggestions auto-applied
const sug = suggestKeywords(product, "TR", "tr");
assert(sug.length >= 2 && sug.length <= 3, `suggestKeywords returns 2–3 → ${sug.join(", ")}`);
const auto = buildListingPackage(product, { language: "tr", country: "TR", keywords: [] });
assert(auto.keywords.length >= 2, `empty keywords uses suggestions → ${auto.keywords.join(", ")}`);

// 4) Product WITHOUT description still generates
const bare = {
  id: "gid://shopify/Product/2",
  title: "Organic Vitamin C Serum",
  vendor: "GlowLab",
  productType: "Skincare",
  tags: [],
  descriptionHtml: "",
  media: { nodes: [] },
};
const barePkg = buildListingPackage(bare, { language: "en", country: "US", keywords: [] });
assert(barePkg.bodyHtml.length > 200, "bare product still gets rich copy");
assert(!/Brand:|Category:|Search focus/.test(barePkg.bodyHtml), "bare: no admin labels");

// 5) Plan gates
assert(plans.planOf("free").monthly_credits === 30, "free = 30 credits");
assert(plans.planOf("growth").limits.bulk === true, "growth allows bulk");
assert(plans.planOf("free").limits.bulk === false, "free blocks bulk");
assert(plans.canUse("free", "media_upload") === false, "free blocks media upload");
assert(plans.languageAllowed("free", "ar", markets.LANGUAGES) === false, "free blocks AR");
assert(plans.languageAllowed("free", "tr", markets.LANGUAGES) === true, "free allows TR");

// 6) Admin UI chrome follows selected language (no Turkish bleed in EN)
const { uiFor, tabsFor, planCopy } = await import("../extensions/copy-pilot-home/src/uiI18n.js");
const enUi = uiFor("en");
const trUi = uiFor("tr");
assert(enUi.tabs.generate === "Generate", "EN tab Generate");
assert(trUi.tabs.generate === "Üretim", "TR tab Üretim");
assert(!/Üretim|Hedefleme|Kredi/.test(enUi.introBody), "EN intro has no Turkish chrome");
assert(/Tema editörü/.test(trUi.introHeading), "TR intro heading");
assert(tabsFor("en").every((t) => !/[ğüşıöçĞÜŞİÖÇ]/.test(t.label) || t.id === "seo"), "EN tabs avoid Turkish letters");
assert(planCopy("growth", "en").badge === "Most popular", "EN growth badge");
assert(planCopy("growth", "tr").badge === "En Popüler", "TR growth badge");
assert(uiFor("es").tabs.generate === "Generate", "unsupported UI lang falls back to EN");

console.log("\n———");
if (failed) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("All QA assertions passed.");
