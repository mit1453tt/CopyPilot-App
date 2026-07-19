/* CopyPilot AI — Auto-Tagging (size, color, material, category) */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};
  function cfg() { return (window.CopyPilot && window.CopyPilot.config) || {}; }

  window.CopyPilot.tags = {
    /** Suggest Shopify product tags from vision attributes + enrichment. */
    suggestTags: function (attributes, enrichment) {
      attributes = attributes || {};
      enrichment = (enrichment && enrichment.enriched) || enrichment || {};
      var tags = [];
      if (attributes.category) { tags.push(attributes.category); }
      if (attributes.color) { tags.push(attributes.color); }
      if (attributes.material) { tags.push(attributes.material); }
      if (attributes.style) { tags.push(attributes.style); }
      if (enrichment.brand) { tags.push(enrichment.brand); }
      (attributes.keyFeatures || []).forEach(function (f) { tags.push(f); });
      // Dedupe
      var seen = {}, out = [];
      tags.forEach(function (t) {
        var k = String(t).toLowerCase();
        if (t && !seen[k]) { seen[k] = 1; out.push(String(t)); }
      });
      return out.slice(0, 12);
    },

    /** Push tags to Shopify via sync endpoint. */
    applyTags: function (productId, tags) {
      var url = (cfg().tagsEndpoint || cfg().appProxyBase + "/tags") + "/apply";
      return window.CopyPilot.util.fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: productId, tags: tags || [] })
      }, function () {
        return { mock: true, productId: productId, tags: tags || [], applied: true };
      });
    }
  };
})();
