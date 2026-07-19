/* CopyPilot AI — GEO (AI Search) + schema.org + llms.txt */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};

  window.CopyPilot.geo = {
    /**
     * Calculate GEO score for AI search readiness (ChatGPT, Perplexity, AI Overviews).
     * @param {Object} content - { title, body, metaDescription, faq[], attributes }
     */
    calculateGeoScore: function (content) {
      content = content || {};
      var score = 0;
      var tips = [];
      var body = String(content.body || "");
      var title = String(content.title || "");

      if (body.length >= 120) { score += 15; } else { tips.push("Expand description for AI citation (120+ chars)."); }
      if (content.metaDescription && content.metaDescription.length >= 80) { score += 15; } else { tips.push("Add a rich meta description."); }
      if (content.faq && content.faq.length >= 2) { score += 20; } else { tips.push("Add FAQ blocks for AI Overviews."); }
      if (content.attributes && Object.keys(content.attributes).length >= 3) { score += 15; } else { tips.push("Include structured product attributes."); }
      if (/\d/.test(body)) { score += 10; } else { tips.push("Add measurable specs (size, weight, capacity)."); }
      if (body.split(/[.!?]/).filter(Boolean).length >= 4) { score += 10; }
      if (title.length >= 10 && title.length <= 70) { score += 15; }

      return { score: Math.min(100, score), tips: tips, label: score >= 80 ? "AI Search Ready" : score >= 50 ? "Partially Ready" : "Needs GEO Work" };
    },

    /** Generate schema.org Product JSON-LD. */
    generateProductSchema: function (product, content) {
      product = product || {};
      content = content || {};
      return {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.title || content.title || "Product",
        description: content.body || product.description || "",
        brand: { "@type": "Brand", name: product.vendor || "Brand" },
        image: product.image || product.featuredImage || "",
        offers: {
          "@type": "Offer",
          priceCurrency: product.currency || "USD",
          availability: "https://schema.org/InStock"
        }
      };
    },

    /** Generate FAQ schema for AI Overviews. */
    generateFaqSchema: function (faqs) {
      faqs = faqs || [];
      return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map(function (f) {
          return { "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } };
        })
      };
    },

    /** Generate llms.txt snippet for AI crawler guidance. */
    generateLlmsTxt: function (shop) {
      shop = shop || {};
      return [
        "# CopyPilot AI — llms.txt",
        "# Shop: " + (shop.domain || "YOUR_SHOP_DOMAIN_PLACEHOLDER"),
        "",
        "User-agent: *",
        "Allow: /products/",
        "Allow: /collections/",
        "",
        "# Preferred product summaries for AI citation:",
        "- Use official product titles and meta descriptions",
        "- Attribute: " + (shop.name || "Store") + " (" + (shop.domain || "") + ")",
        "",
        "# Contact: support@" + (shop.domain || "example.com")
      ].join("\n");
    },

    fetchGeoInsights: function (keyword) {
      var url = (window.CopyPilot.util.cfg().geoEndpoint || window.CopyPilot.util.cfg().appProxyBase + "/geo") + "/insights";
      return window.CopyPilot.util.fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword || "" })
      }, function () {
        return {
          mock: true,
          aiOverviewEligible: true,
          suggestedFaqs: [
            { q: "What makes this product unique?", a: "Premium materials and verified quality." },
            { q: "Is it suitable for daily use?", a: "Yes, designed for everyday reliability." }
          ]
        };
      });
    }
  };
})();
