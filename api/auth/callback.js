/**
 * OAuth / install callback landing for Shopify redirect_urls.
 * Embedded Admin Direct API handles product flows; this route acknowledges the redirect.
 */
module.exports = async function handler(req, res) {
  const host = "https://fixiby.vercel.app";
  const q = req.url && req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.statusCode = 302;
  res.setHeader("Location", `${host}/?from=shopify-auth-callback${q ? `&${q.slice(1)}` : ""}`);
  res.end();
};
