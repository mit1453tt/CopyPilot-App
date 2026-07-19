/* CopyPilot AI — Gemini client (browser)
   NEVER holds the API key. Calls App Proxy → server (GEMINI_API_KEY).
   Store path: /apps/copy-pilot/copilot-gemini */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};

  function cfg() { return (window.CopyPilot && window.CopyPilot.config) || {}; }

  function proxyUrl() {
    var path = cfg().geminiProxyPath || "/apps/copy-pilot/copilot-gemini";
    return path;
  }

  function post(action, payload) {
    payload = payload || {};
    payload.action = action;
    return fetch(proxyUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin"
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          throw new Error((data && data.error) || ("Gemini proxy HTTP " + res.status));
        }
        return data;
      });
    });
  }

  var gemini = {
    /** True once server reports key configured (cached after first status/call). */
    _configured: null,

    isConfigured: function () {
      // Only true after a successful status ping. Default false so we use local
      // truthful AIDA when App Proxy / Gemini is unavailable (avoids empty/junk HTML).
      return gemini._configured === true;
    },

    status: function () {
      return fetch(proxyUrl(), { method: "GET", headers: { Accept: "application/json" }, credentials: "same-origin" })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          gemini._configured = !!(data && data.configured);
          return data;
        });
    },

    generateText: function (prompt) {
      return post("generate", {
        productTitle: prompt,
        language: "en",
        tone: "professional",
        attributes: {}
      }).then(function (data) {
        if (!data || !data.body) { throw new Error("Empty Gemini text"); }
        return data.body;
      });
    },

    analyzeImage: function (imageUrl) {
      return post("analyze", { imageUrl: imageUrl || null }).then(function (data) {
        if (!data || !data.attributes) { throw new Error("Empty Gemini vision"); }
        return data.attributes;
      });
    },

    writeAidaCopy: function (ctx) {
      ctx = ctx || {};
      return post("generate", {
        language: ctx.language || "en",
        tone: ctx.tone || "professional",
        productTitle: ctx.productTitle || "Product",
        attributes: ctx.attributes || {},
        keyword: ctx.keyword || "",
        rich: true,
        instructions:
          "Write a LONG sales product description (180-280 words) in the requested language. " +
          "Sales-focused AIDA with light symbols (★ ✓ • →). " +
          "CRITICAL RULES: Do NOT invent free shipping, Google, awards, guarantees, discounts, or any offer " +
          "not present in the product attributes JSON. Only use given product facts (title, material, color, style, features). " +
          "Weave the target keyword naturally 1-2 times. Include a short image layout suggestion at the end. " +
          "No filler SEO spam. Conversion-focused and truthful."
      }).then(function (data) {
        if (!data || !data.body) { throw new Error("Empty Gemini copy"); }
        return data.body;
      });
    }
  };

  window.CopyPilot.gemini = gemini;
})();
