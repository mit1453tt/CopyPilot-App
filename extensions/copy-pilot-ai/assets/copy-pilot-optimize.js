/* CopyPilot AI — Conversion Optimization (A/B + Multi-Armed Bandit) */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};

  var experiments = {};

  window.CopyPilot.optimize = {
    /** Create A/B experiment with copy variants. */
    createExperiment: function (productId, variants) {
      productId = productId || "unknown";
      variants = variants || [];
      experiments[productId] = {
        productId: productId,
        variants: variants.map(function (v, i) {
          return { id: "v" + (i + 1), body: v.body || v, impressions: 0, conversions: 0, revenue: 0 };
        }),
        startedAt: Date.now(),
        winner: null
      };
      return experiments[productId];
    },

    /** Multi-armed bandit: epsilon-greedy variant selection. */
    selectVariant: function (productId, epsilon) {
      epsilon = typeof epsilon === "number" ? epsilon : 0.1;
      var exp = experiments[productId];
      if (!exp || !exp.variants.length) { return null; }
      if (Math.random() < epsilon) {
        return exp.variants[Math.floor(Math.random() * exp.variants.length)];
      }
      // Exploit: highest conversion rate (with Laplace smoothing).
      var best = exp.variants[0], bestRate = -1;
      exp.variants.forEach(function (v) {
        var rate = (v.conversions + 1) / (v.impressions + 2);
        if (rate > bestRate) { bestRate = rate; best = v; }
      });
      return best;
    },

    /** Record impression or conversion for a variant. */
    recordEvent: function (productId, variantId, type, value) {
      var exp = experiments[productId];
      if (!exp) { return null; }
      var v = null;
      exp.variants.forEach(function (x) { if (x.id === variantId) { v = x; } });
      if (!v) { return null; }
      if (type === "impression") { v.impressions++; }
      if (type === "conversion") { v.conversions++; v.revenue += value || 0; }
      window.CopyPilot.analytics.recordConversion({ productId: productId, variantId: variantId, type: type, value: value });
      return v;
    },

    /** Pick winning variant after enough data. */
    pickWinner: function (productId) {
      var exp = experiments[productId];
      if (!exp) { return null; }
      var best = exp.variants[0], bestRate = -1;
      exp.variants.forEach(function (v) {
        var rate = v.impressions ? v.conversions / v.impressions : 0;
        if (rate > bestRate) { bestRate = rate; best = v; }
      });
      exp.winner = best;
      return best;
    },

    getExperiment: function (productId) { return experiments[productId] || null; },
    listExperiments: function () {
      return Object.keys(experiments).map(function (k) { return experiments[k]; });
    }
  };
})();
