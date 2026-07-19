/* CopyPilot AI — Media (multi-image vision + bulk alt-text) */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};
  function cfg() { return (window.CopyPilot && window.CopyPilot.config) || {}; }

  window.CopyPilot.media = {
    /** Generate alt-text for a single image. */
    generateAltText: function (imageUrl, productTitle, attributes) {
      attributes = attributes || {};
      var url = (cfg().mediaEndpoint || cfg().appProxyBase + "/media") + "/alt-text";
      return window.CopyPilot.util.fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: imageUrl, productTitle: productTitle, attributes: attributes })
      }, function () {
        var color = attributes.color || "product";
        var cat = attributes.category || "item";
        return {
          mock: true,
          altText: (productTitle || "Product") + " — " + color + " " + cat.toLowerCase() + ", studio product photo"
        };
      });
    },

    /** Bulk alt-text for multiple images. */
    generateBulkAltText: function (images, productTitle, attributes, onEach) {
      var self = this;
      images = images || [];
      return new Promise(function (resolve) {
        (async function () {
          var results = [];
          for (var i = 0; i < images.length; i++) {
            var r = await self.generateAltText(images[i], productTitle, attributes);
            results.push({ url: images[i], altText: r.altText });
            if (typeof onEach === "function") { onEach(results[results.length - 1], i); }
          }
          resolve(results);
        })();
      });
    },

    /** Mock image enhancement request (background removal / resize). */
    enhanceImage: function (imageUrl, options) {
      var url = (cfg().mediaEndpoint || cfg().appProxyBase + "/media") + "/enhance";
      return window.CopyPilot.util.fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: imageUrl, options: options || {} })
      }, function () {
        return { mock: true, enhancedUrl: imageUrl + "?enhanced=1", operations: ["auto-crop", "bg-clean"] };
      });
    }
  };
})();
