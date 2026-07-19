/**
 * CopyPilot AI — compliance + legal host
 *
 * Serves:
 *   GET  /legal/*                 → privacy, KVKK, terms (static)
 *   POST /webhooks/compliance     → customers/data_request | customers/redact | shop/redact
 *   POST /webhooks/app/uninstalled
 *   GET  /health
 *
 * Required env:
 *   SHOPIFY_API_SECRET  (Partner app client secret — HMAC)
 * Optional:
 *   PORT                (default 8080)
 *   HOST                (default 0.0.0.0)
 *   LEGAL_DIR           (default ../legal)
 *   COMPLIANCE_LOG_DIR  (default ../.compliance-log)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const LEGAL_DIR = path.resolve(process.env.LEGAL_DIR || path.join(ROOT, "legal"));
const LOG_DIR = path.resolve(process.env.COMPLIANCE_LOG_DIR || path.join(ROOT, ".compliance-log"));
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const API_SECRET = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_API_SECRET_KEY || "";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function timingSafeEqualB64(a, b) {
  try {
    const ba = Buffer.from(a, "base64");
    const bb = Buffer.from(b, "base64");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Verify Shopify webhook HMAC (raw body). */
export function verifyShopifyHmac(rawBody, hmacHeader, secret) {
  if (!secret || !hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return timingSafeEqualB64(digest, String(hmacHeader).trim());
}

function appendComplianceLog(topic, payload) {
  ensureLogDir();
  const day = new Date().toISOString().slice(0, 10);
  const line = JSON.stringify({
    at: new Date().toISOString(),
    topic,
    shop_id: payload?.shop_id,
    shop_domain: payload?.shop_domain,
    customer_id: payload?.customer?.id,
    note:
      topic === "customers/data_request" || topic === "customers/redact"
        ? "CopyPilot does not store customer PII; acknowledged."
        : topic === "shop/redact"
          ? "Shop data purge scheduled / applied for app storage."
          : "recorded",
  }) + "\n";
  fs.appendFileSync(path.join(LOG_DIR, `${day}.jsonl`), line, "utf8");
}

function handleCompliance(topic, payload) {
  appendComplianceLog(topic, payload);
  // No customer DB — acknowledge. For shop/redact, wipe any shop-keyed local files if present.
  if (topic === "shop/redact" && payload?.shop_domain) {
    const safe = String(payload.shop_domain).replace(/[^a-zA-Z0-9._-]/g, "_");
    const shopFile = path.join(LOG_DIR, `shop-${safe}.json`);
    if (fs.existsSync(shopFile)) fs.unlinkSync(shopFile);
  }
  return { ok: true, topic };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function send(res, status, body, headers = {}) {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": headers["Content-Type"] || "application/json; charset=utf-8",
    ...headers,
  });
  res.end(data);
}

function safeLegalPath(urlPath) {
  const rel = urlPath.replace(/^\/legal\/?/, "") || "index.html";
  const full = path.normalize(path.join(LEGAL_DIR, rel));
  if (!full.startsWith(LEGAL_DIR)) return null;
  return full;
}

async function onRequest(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const { pathname } = url;

  if (req.method === "GET" && pathname === "/health") {
    return send(res, 200, {
      ok: true,
      service: "copypilot-compliance",
      hmacConfigured: Boolean(API_SECRET),
      legalDir: LEGAL_DIR,
    });
  }

  if (req.method === "GET" && (pathname === "/" || pathname === "/legal" || pathname === "/legal/")) {
    res.writeHead(302, { Location: "/legal/index.html" });
    return res.end();
  }

  if (req.method === "GET" && pathname.startsWith("/legal")) {
    const file = safeLegalPath(pathname);
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
    }
    const ext = path.extname(file);
    return send(res, 200, fs.readFileSync(file), { "Content-Type": MIME[ext] || "application/octet-stream" });
  }

  if (req.method === "POST" && (pathname === "/webhooks/compliance" || pathname === "/webhooks/app/uninstalled")) {
    const raw = await readBody(req);
    const hmac = req.headers["x-shopify-hmac-sha256"];
    if (!verifyShopifyHmac(raw, hmac, API_SECRET)) {
      return send(res, 401, { error: "Invalid HMAC" });
    }
    let payload = {};
    try {
      payload = JSON.parse(raw.toString("utf8") || "{}");
    } catch {
      return send(res, 400, { error: "Invalid JSON" });
    }
    const topicHeader = String(req.headers["x-shopify-topic"] || "").toLowerCase();
    let topic = topicHeader;
    if (pathname === "/webhooks/app/uninstalled") topic = "app/uninstalled";
    // Shopify may send compliance to one URI with topic header distinguishing them
    if (!topic || topic === "compliance") {
      if (payload.orders_requested || payload.data_request) topic = "customers/data_request";
      else if (payload.orders_to_redact) topic = "customers/redact";
      else if (payload.shop_domain && !payload.customer) topic = "shop/redact";
    }
    const result = handleCompliance(topic, payload);
    return send(res, 200, result);
  }

  return send(res, 404, { error: "Not found" });
}

export function createServer() {
  return http.createServer((req, res) => {
    onRequest(req, res).catch((err) => {
      console.error("[compliance]", err);
      send(res, 500, { error: "Internal error" });
    });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (!API_SECRET) {
    console.warn("[compliance] WARNING: SHOPIFY_API_SECRET is empty — HMAC will fail App Store checks.");
  }
  ensureLogDir();
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`[compliance] listening http://${HOST}:${PORT}`);
    console.log(`[compliance] legal:  http://localhost:${PORT}/legal/index.html`);
    console.log(`[compliance] health: http://localhost:${PORT}/health`);
    console.log(`[compliance] webhooks: POST /webhooks/compliance`);
  });
}
