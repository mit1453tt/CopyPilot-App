/* CopyPilot AI — Shopify Sync (two-way publish) */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};
  function cfg() { return (window.CopyPilot && window.CopyPilot.config) || {}; }

  window.CopyPilot.sync = {
    /**
     * Publish generated content back to Shopify (description, meta, metafields, tags).
     * @param {Object} payload - { productId, body, metaTitle, metaDescription, tags, metafields }
     */
    publishToShopify: function (payload) {
      var base = cfg().syncEndpoint || cfg().appProxyBase + "/sync";
      return window.CopyPilot.util.fetchJson(base + "/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload || {})
      }, function () {
        return { mock: true, published: true, productId: payload && payload.productId, at: new Date().toISOString() };
      });
    },

    /** Bulk publish queued items. */
    publishBulk: function (items) {
      var base = cfg().syncEndpoint || cfg().appProxyBase + "/sync";
      return window.CopyPilot.util.fetchJson(base + "/publish-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items || [] })
      }, function () {
        return { mock: true, published: (items || []).length, items: items || [] };
      });
    }
  };
})();
