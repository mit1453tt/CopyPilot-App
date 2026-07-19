/* CopyPilot AI — Layer 3: Live Google SERP & Competitor Analysis (SEO engine)
   ------------------------------------------------------------------
   Fetches live competitor keywords, scores generated copy against them, and
   produces spec-compliant Meta Title (<=60) and Meta Description (<=160).

   STUB: network call targets the isolated MOCK endpoint below.
   Exposes:
     window.CopyPilot.serp.fetchLiveSerpKeywords(productTitle, targetKeywords)
     window.CopyPilot.serp.calculateSeoScore(description, keywords)
     window.CopyPilot.serp.generateMetaTitle(productTitle, keyword)
     window.CopyPilot.serp.generateMetaDescription(description, keyword)         */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};

  function cfg() { return (window.CopyPilot && window.CopyPilot.config) || {}; }

  function mockKeywords(productTitle, targetKeywords) {
    // Only product-derived terms — NEVER invent offers (shipping, guarantees, etc.)
    var BAN = {
      "free shipping": 1, "ucretsiz kargo": 1, "ücretsiz kargo": 1,
      "google": 1, "best seller": 1, "unisex fit": 1, "sustainable": 1,
      "soft fabric": 1, "everyday essential": 1
    };
    var seeds = String(productTitle || "").toLowerCase()
      .replace(/[^a-z0-9ğüşıöçáéíóúñüäöß\s\-]/gi, " ")
      .split(/\s+/).filter(function (w) { return w.length > 2; }).slice(0, 5);
    var provided = Array.isArray(targetKeywords)
      ? targetKeywords
      : String(targetKeywords || "").split(",").map(function (k) { return k.trim(); }).filter(Boolean);
    var related = [];
    if (/\bsnowboard|kayak|ski|board\b/i.test(productTitle || "")) {
      related = ["all-mountain", "camber profile", "edge control", "freestyle"];
    } else if (/\bshoe|sneaker|boot|ayakkab/i.test(productTitle || "")) {
      related = ["cushioned sole", "everyday wear", "lightweight"];
    } else if (/\bshirt|tee|hoodie|jacket|elbise|gömlek\b/i.test(productTitle || "")) {
      related = ["comfortable fit", "breathable", "layering"];
    } else {
      related = seeds.map(function (s) { return s; }).slice(0, 2);
    }
    var merged = provided.concat(seeds).concat(related);
    var seen = {}, out = [];
    merged.forEach(function (k) {
      var key = String(k || "").toLowerCase().trim();
      if (!key || BAN[key] || seen[key]) { return; }
      seen[key] = 1;
      out.push(k);
    });
    return out.slice(0, 8);
  }

  var serp = {
    /**
     * Fetch live SERP competitor keywords for a product.
     * @param {string} productTitle
     * @param {string|string[]} targetKeywords - comma string or array.
     * @returns {Promise<string[]>} competitor keyword list.
     */
    fetchLiveSerpKeywords: function (productTitle, targetKeywords) {
      var endpoint = cfg().serpEndpoint || "";
      return new Promise(function (resolve) {
        (async function () {
          try {
            var res = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Accept": "application/json" },
              body: JSON.stringify({ productTitle: productTitle || "", targetKeywords: targetKeywords || [] })
            });
            if (!res.ok) { throw new Error("SERP endpoint returned HTTP " + res.status); }
            var data = await res.json();
            var raw = Array.isArray(data && data.keywords) ? data.keywords : null;
            // Re-filter through mockKeywords so banned invents (shipping/Google) never score.
            resolve(mockKeywords(productTitle, raw || targetKeywords));
          } catch (err) {
            console.error("[CopyPilot Error]: SERP fetch fell back to mock keywords —", err.message);
            resolve(mockKeywords(productTitle, targetKeywords));
          }
        })();
      });
    },

    /**
     * Dynamic SEO score: measures keyword coverage inside the copy.
     *   >=80% coverage -> 90..100   |   >=50% -> 60..89   |   else 0..59.
     * @param {string} description - generated copy.
     * @param {string[]} keywords - target/competitor keywords.
     * @returns {{score:number, coverage:number, matched:string[], missing:string[]}}
     */
    calculateSeoScore: function (description, keywords) {
      var text = String(description || "").toLowerCase();
      var list = Array.isArray(keywords) ? keywords.filter(Boolean) : [];
      if (!list.length) { return { score: 0, coverage: 0, matched: [], missing: [] }; }

      var matched = [], missing = [];
      list.forEach(function (kw) {
        // Word-boundary aware match; falls back to includes for multi-word phrases.
        var safe = String(kw).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        var re = new RegExp("\\b" + safe + "\\b", "i");
        if (re.test(text) || text.includes(String(kw).toLowerCase())) { matched.push(kw); }
        else { missing.push(kw); }
      });

      var coverage = matched.length / list.length; // 0..1
      var score;
      if (coverage >= 0.8) {
        score = 90 + Math.round((coverage - 0.8) / 0.2 * 10);       // 90..100
      } else if (coverage >= 0.5) {
        score = 60 + Math.round((coverage - 0.5) / 0.3 * 29);       // 60..89
      } else {
        score = Math.round((coverage / 0.5) * 59);                  // 0..59
      }
      return { score: Math.max(0, Math.min(100, score)), coverage: Math.round(coverage * 100), matched: matched, missing: missing };
    },

    /**
     * Build a Meta Title, hard-capped at 60 characters.
     * @param {string} productTitle
     * @param {string} keyword
     * @returns {string}
     */
    generateMetaTitle: function (productTitle, keyword) {
      var title = String(productTitle || "Product").trim();
      var kw = String(keyword || "").trim();
      var candidate = kw && title.toLowerCase().indexOf(kw.toLowerCase()) === -1
        ? title + " | " + kw
        : title;
      if (candidate.length <= 60) { return candidate; }
      return candidate.slice(0, 57).replace(/\s+\S*$/, "").trim() + "…";
    },

    /**
     * Build a Meta Description, hard-capped at 160 characters.
     * @param {string} description
     * @param {string} keyword
     * @returns {string}
     */
    generateMetaDescription: function (description, keyword) {
      var text = String(description || "").replace(/\s+/g, " ").trim();
      var kw = String(keyword || "").trim();
      if (kw && text.toLowerCase().indexOf(kw.toLowerCase()) === -1) {
        text = kw.charAt(0).toUpperCase() + kw.slice(1) + " — " + text;
      }
      if (text.length <= 160) { return text; }
      return text.slice(0, 157).replace(/\s+\S*$/, "").trim() + "…";
    }
  };

  window.CopyPilot.serp = serp;
})();
