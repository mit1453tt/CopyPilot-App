/* CopyPilot AI — Data Enrichment (manufacturer/supplier attributes) */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};
  function cfg() { return (window.CopyPilot && window.CopyPilot.config) || {}; }

  function mockEnrichment(product) {
    var title = (product && product.title) || "Product";
    return {
      mock: true,
      productId: product && product.id,
      enriched: {
        brand: (product && product.vendor) || "Generic Brand",
        material: "Premium composite",
        dimensions: "10 x 5 x 2 cm",
        weight: "250g",
        warranty: "12 months",
        certifications: ["CE", "RoHS"],
        compatibility: ["Universal"],
        careInstructions: "Wipe clean with damp cloth"
      },
      source: "mock-manufacturer-db"
    };
  }

  window.CopyPilot.enrichment = {
    enrichProductData: function (product) {
      var url = (cfg().enrichmentEndpoint || cfg().appProxyBase + "/enrichment") + "/lookup";
      return window.CopyPilot.util.fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, title: product.title, vendor: product.vendor, sku: product.sku })
      }, function () { return mockEnrichment(product); });
    },

    enrichBulk: function (products, onEach) {
      var self = this;
      products = products || [];
      return new Promise(function (resolve) {
        (async function () {
          var out = [];
          for (var i = 0; i < products.length; i++) {
            var r = await self.enrichProductData(products[i]);
            out.push(r);
            if (typeof onEach === "function") { onEach(r, i, products.length); }
          }
          resolve(out);
        })();
      });
    }
  };
})();
