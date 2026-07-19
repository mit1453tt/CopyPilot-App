/* CopyPilot AI — Rank Tracking & Conversion Analytics */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};
  function cfg() { return (window.CopyPilot && window.CopyPilot.config) || {}; }

  var history = [];

  window.CopyPilot.analytics = {
    /** Track keyword rank for a product page (mock SERP position). */
    trackRank: function (productId, keyword) {
      var url = (cfg().analyticsEndpoint || cfg().appProxyBase + "/analytics") + "/rank";
      return window.CopyPilot.util.fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: productId, keyword: keyword })
      }, function () {
        var pos = 5 + Math.floor(Math.random() * 20);
        var entry = { mock: true, productId: productId, keyword: keyword, position: pos, delta: pos < 15 ? +2 : -1, at: Date.now() };
        history.push(entry);
        return entry;
      });
    },

    /** Record conversion event for copy variant (views, add-to-cart, purchases). */
    recordConversion: function (event) {
      var url = (cfg().analyticsEndpoint || cfg().appProxyBase + "/analytics") + "/conversion";
      return window.CopyPilot.util.fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event || {})
      }, function () {
        return { mock: true, recorded: true, event: event };
      });
    },

    /** Fetch performance summary for published copy. */
    getPerformanceSummary: function (productId) {
      var url = (cfg().analyticsEndpoint || cfg().appProxyBase + "/analytics") + "/summary?productId=" + encodeURIComponent(productId || "");
      return window.CopyPilot.util.fetchJson(url, { method: "GET" }, function () {
        return {
          mock: true,
          productId: productId,
          impressions: 1240,
          ctr: 3.2,
          addToCartRate: 1.8,
          conversionRate: 0.9,
          topKeyword: "premium product",
          rankHistory: history.slice(-5)
        };
      });
    },

    getRankHistory: function () { return history.slice(); }
  };
})();
