/**
 * Static security + Shopify approval risk scanner for CopyPilot-App only.
 * Does not scan Size Wizard / other apps.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXT = path.join(root, "extensions");

const SECRETISH = [
  /GEMINI_API_KEY\s*=\s*['"][^'"]+['"]/i,
  /sk-[a-zA-Z0-9]{20,}/,
  /AIza[0-9A-Za-z\-_]{20,}/,
  /BEGIN (RSA |OPENSSH )?PRIVATE KEY/,
  /shopify_api_secret\s*[:=]\s*['"][^'"]+['"]/i,
];

const findings = [];
function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".shopify") continue;
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (/\.(js|jsx|ts|tsx|liquid|toml|json|env)$/i.test(name)) files.push(p);
  }
  return files;
}

const files = walk(EXT).concat([
  path.join(root, "shopify.app.toml"),
]);

for (const f of files) {
  let text = "";
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  for (const re of SECRETISH) {
    if (re.test(text)) findings.push({ severity: "CRITICAL", file: f, issue: `Possible secret: ${re}` });
  }
  if (/api\.mock-shop-endpoint\.local/.test(text)) {
    findings.push({ severity: "HIGH", file: f, issue: "Mock endpoint still referenced — production publish/generate must not depend on mocks." });
  }
}

const toml = readFileSync(path.join(root, "shopify.app.toml"), "utf8");
if (!/customers\/data_request|shop\/redact|compliance_topics/.test(toml)) {
  findings.push({
    severity: "HIGH",
    file: "shopify.app.toml",
    issue: "Missing GDPR compliance webhooks (customers/data_request, customers/redact, shop/redact) — required for App Store public listing.",
  });
} else if (/uri\s*=\s*"\/webhooks\/compliance"/.test(toml) && /shopify\.dev\/apps\/default-app-home/.test(toml)) {
  findings.push({
    severity: "MED",
    file: "shopify.app.toml",
    issue: "GDPR compliance webhooks declared, but application_url is still Shopify placeholder — deploy server/compliance.mjs to HTTPS and set application_url before App Store submit.",
  });
}

const legalIndex = path.join(root, "legal", "index.html");
const kvkkPath = path.join(root, "legal", "privacy-notice-tr-market.html");
if (!existsSync(legalIndex) || !existsSync(kvkkPath)) {
  findings.push({
    severity: "HIGH",
    file: "legal/",
    issue: "Missing privacy / KVKK legal pages required for App Store listing and TR disclosure.",
  });
}
if (!existsSync(path.join(root, "server", "compliance.mjs"))) {
  findings.push({
    severity: "HIGH",
    file: "server/compliance.mjs",
    issue: "Missing compliance webhook server with HMAC verification.",
  });
}
if (/shopify\.dev\/apps\/default-app-home/.test(toml)) {
  findings.push({
    severity: "MED",
    file: "shopify.app.toml",
    issue: "application_url is Shopify default placeholder — OK for extension-only, but paid Billing returnUrl must still resolve for merchants.",
  });
}
if (!/write_products/.test(toml)) {
  findings.push({ severity: "CRITICAL", file: "shopify.app.toml", issue: "Missing write_products scope." });
}

console.log("Security / approval scan:\n");
if (!findings.length) {
  console.log("No findings.");
  process.exit(0);
}
const order = { CRITICAL: 0, HIGH: 1, MED: 2, LOW: 3 };
findings.sort((a, b) => order[a.severity] - order[b.severity]);
for (const f of findings) {
  console.log(`[${f.severity}] ${path.relative(root, f.file)}\n  → ${f.issue}\n`);
}
const crit = findings.filter((f) => f.severity === "CRITICAL").length;
process.exit(crit ? 1 : 0);
