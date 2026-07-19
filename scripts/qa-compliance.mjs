/**
 * QA: legal docs + compliance webhook HMAC behavior.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { verifyShopifyHmac } from "../server/compliance.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log("OK  :", msg);
  else {
    failed += 1;
    console.error("FAIL:", msg);
  }
}

const legalFiles = [
  "legal/index.html",
  "legal/privacy-en.html",
  "legal/terms-en.html",
  "legal/data-processing.html",
  "legal/privacy-notice-tr-market.html",
  "legal/assets/legal.css",
  "docs/APP_STORE_CHECKLIST.md",
  "server/compliance.mjs",
  "extensions/copy-pilot-home/src/legalConfig.js",
];

for (const rel of legalFiles) {
  assert(fs.existsSync(path.join(root, rel)), `exists ${rel}`);
}

const kvkk = fs.readFileSync(path.join(root, "legal/privacy-notice-tr-market.html"), "utf8");
assert(/6698/.test(kvkk), "KVKK cites law 6698");
assert(/Article 10|Art\.\s*10|Article 10/i.test(kvkk), "KVKK cites article 10");
assert(/Art\.\s*11|Article 11/i.test(kvkk), "KVKK cites article 11 rights");
assert(/info@fixiby\.com/.test(kvkk), "KVKK uses info@fixiby.com");
assert(/Fixiby Software Technologies/.test(kvkk), "KVKK names Fixiby");

const privacyEn = fs.readFileSync(path.join(root, "legal/privacy-en.html"), "utf8");
assert(/Privacy Policy/i.test(privacyEn), "EN privacy title");
assert(/info@fixiby\.com/.test(privacyEn), "EN privacy uses info@fixiby.com");
assert(/Fixiby Software Technologies/.test(privacyEn), "EN privacy names Fixiby");
assert(!/privacy@copypilot\.ai|support@copypilot\.ai/.test(privacyEn), "no legacy copypilot emails");

const legalCfg = fs.readFileSync(path.join(root, "extensions/copy-pilot-home/src/legalConfig.js"), "utf8");
assert(/fixiby\.vercel\.app\/legal/.test(legalCfg), "LEGAL_BASE_URL is fixiby.vercel.app/legal");

const toml = fs.readFileSync(path.join(root, "shopify.app.toml"), "utf8");
assert(/fixiby\.vercel\.app/.test(toml), "toml application_url on fixiby.vercel.app");
assert(/customers\/data_request/.test(toml), "toml data_request");
assert(/customers\/redact/.test(toml), "toml customers/redact");
assert(/shop\/redact/.test(toml), "toml shop/redact");
assert(/app\/uninstalled/.test(toml), "toml app/uninstalled");
assert(/\/api\/webhooks\/compliance/.test(toml), "toml compliance uri");

const secret = "test_secret_copypilot";
const body = Buffer.from(JSON.stringify({ shop_id: 1, shop_domain: "x.myshopify.com" }));
const good = crypto.createHmac("sha256", secret).update(body).digest("base64");
assert(verifyShopifyHmac(body, good, secret) === true, "HMAC accepts valid signature");
assert(verifyShopifyHmac(body, "AAAA", secret) === false, "HMAC rejects invalid signature");
assert(verifyShopifyHmac(body, good, "") === false, "HMAC rejects empty secret");

const appHome = fs.readFileSync(path.join(root, "extensions/copy-pilot-home/src/AppHome.jsx"), "utf8");
assert(/legalUrl/.test(appHome), "Admin Help links legalUrl");
assert(/legalKvkk|KVKK/.test(appHome), "Admin Help includes KVKK link");

console.log("\n———");
if (failed) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("All compliance assertions passed.");
