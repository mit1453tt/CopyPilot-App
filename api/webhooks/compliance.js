/**
 * Shopify mandatory compliance webhooks (customers/data_request, customers/redact, shop/redact).
 * Deployed on Vercel at /api/webhooks/compliance
 *
 * Env: SHOPIFY_API_SECRET (Partner app client secret)
 */
const crypto = require("crypto");

function timingSafeEqualB64(a, b) {
  try {
    const ba = Buffer.from(String(a), "base64");
    const bb = Buffer.from(String(b), "base64");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function verifyHmac(rawBody, hmacHeader, secret) {
  if (!secret || !hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return timingSafeEqualB64(digest, String(hmacHeader).trim());
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_API_SECRET_KEY || "";
  const raw = await readRawBody(req);
  const hmac = req.headers["x-shopify-hmac-sha256"];

  if (!verifyHmac(raw, hmac, secret)) {
    return res.status(401).json({ error: "Invalid HMAC" });
  }

  let payload = {};
  try {
    payload = JSON.parse(raw.toString("utf8") || "{}");
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  let topic = String(req.headers["x-shopify-topic"] || "").toLowerCase();
  if (!topic) {
    if (payload.orders_requested || payload.data_request) topic = "customers/data_request";
    else if (payload.orders_to_redact) topic = "customers/redact";
    else if (payload.shop_domain && !payload.customer) topic = "shop/redact";
  }

  // CopyPilot does not store customer PII (no customer/order scopes).
  // Shop metafields (copypilot.*) are owned by the shop and removed when the app is uninstalled;
  // this webhook acknowledges GDPR shop/redact without claiming a separate data store purge.
  console.log("[Fixiby CopyPilot] compliance", topic, payload.shop_domain || payload.shop_id);

  const note =
    topic === "shop/redact"
      ? "Acknowledged. No separate customer DB. Shop metafields are removed on uninstall / Shopify app data deletion."
      : "No customer personal data is stored by this app.";

  return res.status(200).json({
    ok: true,
    topic,
    processor: "Fixiby Software Technologies",
    app: "CopyPilot AI",
    note,
  });
};
