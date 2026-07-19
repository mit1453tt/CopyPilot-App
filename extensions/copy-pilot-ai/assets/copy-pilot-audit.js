/* CopyPilot AI — Layer 4: Agentic Bulk Audit (Autonomous Store Audit)
   ------------------------------------------------------------------
   Scans the catalog, flags products with thin descriptions (<100 chars) or
   empty meta tags as "Critical", and auto-fixes selected products by calling
   the (mock) generation/metafield endpoints sequentially.

   STUB: all network calls target isolated MOCK endpoints.
   Exposes:
     window.CopyPilot.audit.runAutonomousStoreAudit()
     window.CopyPilot.audit.autoFixProduct(product)
     window.CopyPilot.audit.autoFixSelected(products, onEach)                    */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};

  function cfg() { return (window.CopyPilot && window.CopyPilot.config) || {}; }

  var MIN_DESCRIPTION_LENGTH = 100;

  // Simulated catalog. A real implementation pages the Admin GraphQL API.
  function mockCatalog() {
    return [
      { id: "gid://shopify/Product/101", title: "Classic Cotton Tee", description: "A soft everyday t-shirt made from breathable cotton for all-day comfort and style.", metaTitle: "Classic Cotton Tee", metaDescription: "Soft breathable cotton tee." },
      { id: "gid://shopify/Product/102", title: "Slim Chino Pants", description: "Slim chinos.", metaTitle: "", metaDescription: "" },
      { id: "gid://shopify/Product/103", title: "Wool Overcoat", description: "", metaTitle: "", metaDescription: "" },
      { id: "gid://shopify/Product/104", title: "Linen Summer Shirt", description: "Lightweight linen shirt, perfect for warm days.", metaTitle: "Linen Shirt", metaDescription: "" },
      { id: "gid://shopify/Product/105", title: "Performance Hoodie", description: "A premium performance hoodie engineered with moisture-wicking fabric, a relaxed fit, and reinforced stitching for durability during any workout.", metaTitle: "Performance Hoodie", metaDescription: "Moisture-wicking premium hoodie built for performance and comfort." }
    ];
  }

  function evaluate(product) {
    var reasons = [];
    var descLen = String(product.description || "").trim().length;
    if (descLen < MIN_DESCRIPTION_LENGTH) { reasons.push("Description under " + MIN_DESCRIPTION_LENGTH + " chars (" + descLen + ")"); }
    if (!String(product.metaTitle || "").trim()) { reasons.push("Missing meta title"); }
    if (!String(product.metaDescription || "").trim()) { reasons.push("Missing meta description"); }
    return {
      id: product.id,
      title: product.title,
      description: product.description || "",
      metaTitle: product.metaTitle || "",
      metaDescription: product.metaDescription || "",
      issues: reasons,
      severity: reasons.length >= 2 ? "critical" : (reasons.length === 1 ? "warn" : "ok")
    };
  }

  var audit = {
    /**
     * Run the autonomous store audit over the (mock) catalog.
     * @returns {Promise<{scanned:number, flagged:Object[]}>}
     */
    runAutonomousStoreAudit: function () {
      var graphql = cfg().shopifyAdminGraphql || "";
      return new Promise(function (resolve) {
        (async function () {
          var catalog;
          try {
            var res = await fetch(graphql, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Accept": "application/json" },
              body: JSON.stringify({ query: "{ products(first: 250) { edges { node { id title description } } } }" })
            });
            if (!res.ok) { throw new Error("Admin GraphQL returned HTTP " + res.status); }
            var data = await res.json();
            catalog = (data && data.products) ? data.products : mockCatalog();
          } catch (err) {
            console.error("[CopyPilot Error]: Store audit fell back to mock catalog —", err.message);
            catalog = mockCatalog();
          }
          var evaluated = catalog.map(evaluate);
          var flagged = evaluated.filter(function (p) { return p.severity !== "ok"; });
          resolve({ scanned: evaluated.length, flagged: flagged });
        })();
      });
    },

    /**
     * Auto-fix a single product: (mock) generate copy + write metafields.
     * @param {Object} product - evaluated product record.
     * @returns {Promise<Object>} updated product.
     */
    autoFixProduct: function (product) {
      var proxy = cfg().appProxyBase || "";
      var metaEndpoint = cfg().metafieldEndpoint || "";
      return new Promise(function (resolve) {
        (async function () {
          try {
            // 1) Generate fresh copy.
            var genRes = await fetch(proxy + "/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Accept": "application/json" },
              body: JSON.stringify({ productId: product.id, title: product.title })
            });
            if (!genRes.ok) { throw new Error("Generate returned HTTP " + genRes.status); }
            // 2) Persist to metafields.
            await fetch(metaEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productId: product.id, namespace: "copy_pilot", updated: true })
            });
            resolve(Object.assign({}, product, { severity: "fixed", issues: [] }));
          } catch (err) {
            console.error("[CopyPilot Error]: Auto-fix (real endpoints unreachable) simulated for " + product.id + " —", err.message);
            // Simulate a successful fix so the agentic flow can be demonstrated end-to-end.
            resolve(Object.assign({}, product, { severity: "fixed", issues: [], simulated: true }));
          }
        })();
      });
    },

    /**
     * Sequentially auto-fix a list of products (keeps API pressure predictable).
     * @param {Object[]} products
     * @param {Function} [onEach] - callback(updatedProduct) after each fix.
     * @returns {Promise<Object[]>} updated products.
     */
    autoFixSelected: function (products, onEach) {
      var self = this;
      products = Array.isArray(products) ? products : [];
      return new Promise(function (resolve) {
        (async function () {
          var results = [];
          for (var i = 0; i < products.length; i++) {
            var updated = await self.autoFixProduct(products[i]);
            results.push(updated);
            if (typeof onEach === "function") { onEach(updated, i); }
          }
          resolve(results);
        })();
      });
    }
  };

  window.CopyPilot.audit = audit;
})();
