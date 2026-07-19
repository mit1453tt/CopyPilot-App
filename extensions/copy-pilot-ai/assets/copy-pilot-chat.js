/* CopyPilot AI — Sidekick-style Chat Assistant */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};
  function cfg() { return (window.CopyPilot && window.CopyPilot.config) || {}; }

  var messages = [];

  function mockReply(userText, ctx) {
    var t = String(userText || "").toLowerCase();
    if (t.indexOf("seo") >= 0 || t.indexOf("google") >= 0) {
      return "I can run a live SERP analysis and boost your SEO score. Try the Intelligence tab → Refresh SERP, or ask me to optimize meta tags.";
    }
    if (t.indexOf("bulk") >= 0 || t.indexOf("catalog") >= 0) {
      return "For bulk work, open Catalog → enqueue products in the queue (supports 10k+ SKUs) or run Autonomous Store Audit.";
    }
    if (t.indexOf("geo") >= 0 || t.indexOf("ai search") >= 0) {
      return "GEO score measures AI search readiness (ChatGPT, Perplexity). I can generate schema.org JSON-LD and llms.txt for you.";
    }
    if (t.indexOf("publish") >= 0 || t.indexOf("shopify") >= 0) {
      return "Use Publish to Shopify to write description, meta tags, metafields and tags back in one click.";
    }
    return "I'm CopyPilot Sidekick. I can help with copy generation, SEO/GEO scoring, bulk audit, enrichment, tagging, and publishing. What would you like to do?";
  }

  window.CopyPilot.chat = {
    getMessages: function () { return messages.slice(); },

    send: function (text, ctx) {
      messages.push({ role: "user", text: text, at: Date.now() });
      var url = (cfg().chatEndpoint || cfg().appProxyBase + "/chat") + "/message";
      return window.CopyPilot.util.fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, context: ctx || {} })
      }, function () {
        var reply = mockReply(text, ctx);
        var msg = { role: "assistant", text: reply, at: Date.now(), mock: true };
        messages.push(msg);
        return msg;
      }).then(function (r) {
        if (r && r.text && r.role !== "user") { messages.push(r); }
        else if (r && r.reply) {
          var m = { role: "assistant", text: r.reply, at: Date.now() };
          messages.push(m);
          return m;
        }
        return r;
      });
    },

    clear: function () { messages = []; }
  };
})();
