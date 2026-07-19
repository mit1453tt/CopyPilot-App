/**
 * Soft auth landing for Shopify embedded app redirects.
 * Full OAuth can be extended later; Admin Direct API handles core product flows.
 */
module.exports = async function handler(req, res) {
  const host = "https://fixiby.vercel.app";
  res.statusCode = 302;
  res.setHeader("Location", `${host}/?from=shopify-auth`);
  res.end();
};
