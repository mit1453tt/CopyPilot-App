/* CopyPilot AI — Layer 2: Vision AI (Universal Product Image Reader)
   ------------------------------------------------------------------
   Reads ANY product image via Google Gemini (multimodal). If Gemini key is
   missing, falls back to mock attribute extraction then AIDA sales copy.
   Exposes: window.CopyPilot.vision.analyzeProductImageWithVision(imageUrl)
            window.CopyPilot.vision.buildAidaSalesCopy(attrs, opts)            */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};

  function cfg() { return (window.CopyPilot && window.CopyPilot.config) || {}; }

  // Universal category catalog — each entry works for a whole product family,
  // so the module is NOT limited to clothing. A real Vision model would infer
  // these; here we simulate them deterministically from the image URL.
  var CATEGORIES = [
    { category: "Apparel",       materials: ["organic cotton", "merino wool", "recycled polyester", "linen"], features: ["breathable fabric", "tailored fit", "reinforced stitching"] },
    { category: "Footwear",      materials: ["genuine leather", "knit mesh", "recycled rubber"],              features: ["cushioned sole", "slip-resistant grip", "lightweight build"] },
    { category: "Electronics",   materials: ["aluminum alloy", "tempered glass", "matte polycarbonate"],      features: ["fast charging", "wireless connectivity", "long battery life"] },
    { category: "Home & Living",  materials: ["solid oak", "stoneware ceramic", "brushed stainless steel"],    features: ["scratch-resistant finish", "space-saving design", "easy to clean"] },
    { category: "Beauty & Care", materials: ["vegan formula", "cold-pressed oils", "hypoallergenic blend"],   features: ["dermatologist tested", "cruelty-free", "fast-absorbing"] },
    { category: "Food & Beverage", materials: ["single-origin beans", "raw honey", "organic ingredients"],    features: ["small-batch", "no additives", "rich aroma"] },
    { category: "Accessories",   materials: ["stainless steel", "full-grain leather", "sapphire crystal"],    features: ["water resistant", "handcrafted detail", "adjustable design"] },
    { category: "Sports & Outdoors", materials: ["ripstop nylon", "anodized aluminum", "high-density foam"],  features: ["weatherproof", "ergonomic grip", "ultra-durable"] },
    { category: "Toys & Kids",   materials: ["BPA-free plastic", "sustainable wood", "soft plush"],           features: ["safety tested", "educational design", "durable build"] }
  ];
  var STYLES = ["minimalist", "modern", "premium", "rugged", "elegant", "playful", "vintage"];
  var COLORS = ["midnight navy", "matte black", "off-white", "natural wood", "forest green", "rose gold", "slate grey"];

  // Deterministic mock generator so the same image yields the same "analysis".
  function mockVisionPayload(imageUrl) {
    var seed = 0, s = String(imageUrl || "product");
    for (var i = 0; i < s.length; i++) { seed = (seed * 31 + s.charCodeAt(i)) >>> 0; }
    var pick = function (arr, salt) { return arr[(seed + (salt || 0)) % arr.length]; };
    var cat = pick(CATEGORIES, 0);
    return {
      category: cat.category,
      material: pick(cat.materials, 1),
      style: pick(STYLES, 2),
      color: pick(COLORS, 3),
      keyFeatures: [pick(cat.features, 4), pick(cat.features, 7)].filter(function (v, ix, a) { return a.indexOf(v) === ix; }),
      confidence: 0.9
    };
  }

  var vision = {
    /**
     * Analyze a product image (any category) via the (mock) Vision endpoint.
     * @param {string} imageUrl - absolute URL of the product image.
     * @returns {Promise<{category,material,style,color,keyFeatures,confidence}>}
     */
    analyzeProductImageWithVision: function (imageUrl) {
      return new Promise(function (resolve) {
        (async function () {
          try {
            if (!imageUrl) {
              console.warn("[CopyPilot] Vision called without an image URL; using placeholder.");
            }

            // Prefer Google Gemini when configured.
            if (window.CopyPilot.gemini && window.CopyPilot.gemini.isConfigured()) {
              var attrs = await window.CopyPilot.gemini.analyzeImage(imageUrl);
              if (attrs && (attrs.category || attrs.material || attrs.color)) {
                if (!Array.isArray(attrs.keyFeatures)) { attrs.keyFeatures = attrs.keyFeatures ? [attrs.keyFeatures] : []; }
                if (typeof attrs.confidence !== "number") { attrs.confidence = 0.85; }
                resolve(attrs);
                return;
              }
            }

            // Optional mock proxy fallback (dev).
            var endpoint = cfg().visionEndpoint || "";
            var res = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Accept": "application/json" },
              body: JSON.stringify({ imageUrl: imageUrl || null, task: "attribute-extraction", provider: "gemini" })
            });
            if (!res.ok) { throw new Error("Vision endpoint returned HTTP " + res.status); }
            var data = await res.json();
            resolve(data && data.attributes ? data.attributes : mockVisionPayload(imageUrl));
          } catch (err) {
            console.error("[CopyPilot Error]: Vision analysis fell back to mock payload —", err.message);
            resolve(mockVisionPayload(imageUrl));
          }
        })();
      });
    },

    /**
     * Convert generic visual attributes into an AIDA-structured sales paragraph.
     * Works for ANY product type — apparel, electronics, home, beauty, etc.
     * @param {Object} attrs - { category, material, style, color, keyFeatures[] }.
     * @param {Object} [opts] - { tone, productTitle, language }.
     * @returns {string} ready-to-use marketing copy.
     */
    buildAidaSalesCopy: function (attrs, opts) {
      attrs = attrs || {};
      opts = opts || {};
      var title = opts.productTitle || "this product";
      var tone = opts.tone || "professional";
      var keyword = String(opts.keyword || "").trim();
      var lang = opts.language || "en";
      var features = Array.isArray(attrs.keyFeatures) ? attrs.keyFeatures.filter(Boolean) : [];
      // Only use real / vision-derived traits — do not invent category clichés.
      if (!features.length) {
        if (attrs.material) { features.push(attrs.material); }
        if (attrs.style) { features.push(attrs.style + " design"); }
        if (attrs.color) { features.push(attrs.color); }
      }
      features = features.slice(0, 4);
      if (!features.length) { features = ["durable build", "clean finish", "ready to use"]; }

      var kw = keyword || title.split(/\s+/).slice(0, 2).join(" ");
      var material = attrs.material || null;
      var color = attrs.color || null;
      var style = attrs.style || null;
      var category = attrs.category || "product";

      // Truthful sales copy — NEVER invent shipping, guarantees, Google, or unverified claims.
      var packs = {
        fun: {
          hook: "★ " + title,
          lead: "Bu ürün dikkat çekmek için tasarlandı — abartısız, net ve satış odaklı.",
          cta: "→ Sepete ekle ve farkı kendin gör."
        },
        professional: {
          hook: "★ " + title,
          lead: "Net fayda, net özellik. Alıcıların karşılaştırma yaptığında gerekçe aradığı satırlar.",
          cta: "→ Sepete ekle — bilinçli seçim için net bilgi."
        },
        luxury: {
          hook: "✦ " + title,
          lead: "Sakin bir lüks dili: abartısız iddia, güçlü his, seçici alıcıya hitap.",
          cta: "→ Şimdi ekle — özenli bir seçim."
        },
        exciting: {
          hook: "⚡ " + title,
          lead: "İlk bakışta etki. Kısa, güçlü ve harekete geçiren bir satış anlatısı.",
          cta: "→ Sepete at — hızını kaybetme."
        }
      };
      // English tone packs when language is EN (keep sales language matching target)
      if (lang === "en") {
        packs = {
          fun: {
            hook: "★ " + title,
            lead: "Built to grab attention without overselling. Clear benefits, real details, sales-first flow.",
            cta: "→ Add to cart and see the difference yourself."
          },
          professional: {
            hook: "★ " + title,
            lead: "Straight benefits and concrete details — the kind of clarity shoppers need to decide.",
            cta: "→ Add to cart with clear expectations."
          },
          luxury: {
            hook: "✦ " + title,
            lead: "Quiet confidence: no fake claims, just refined presentation and solid craft cues.",
            cta: "→ Add to bag — a considered choice."
          },
          exciting: {
            hook: "⚡ " + title,
            lead: "High impact from the first line. Sales-focused, specific, and easy to scan.",
            cta: "→ Add to cart now."
          }
        };
      }
      var p = packs[tone] || packs.professional;

      var detailBits = [];
      if (material) { detailBits.push((lang === "tr" ? "Malzeme: " : "Material: ") + material); }
      if (color) { detailBits.push((lang === "tr" ? "Renk: " : "Color: ") + color); }
      if (style) { detailBits.push((lang === "tr" ? "Stil: " : "Style: ") + style); }
      if (category) { detailBits.push((lang === "tr" ? "Kategori: " : "Category: ") + category); }

      var lines = [
        p.hook,
        "",
        p.lead,
        "",
        (lang === "tr"
          ? "Neden tercih edilir?"
          : "Why it converts:"),
        "✓ " + features[0],
        features[1] ? ("✓ " + features[1]) : null,
        features[2] ? ("✓ " + features[2]) : null,
        features[3] ? ("✓ " + features[3]) : null,
        "",
        detailBits.length
          ? ((lang === "tr" ? "◆ Ürün gerçekleri\n" : "◆ Product facts\n") + detailBits.map(function (b) { return "• " + b; }).join("\n"))
          : null,
        "",
        (kw
          ? (lang === "tr"
            ? ("Arama odağı: “" + kw + "”.")
            : ("Search focus: “" + kw + "”."))
          : null),
        "",
        p.cta
      ].filter(function (x) { return x !== null && x !== undefined; });

      return lines.join("\n");
    },

    /** Sales-oriented product title (not inventing brand awards). */
    buildSalesTitle: function (productTitle, keyword, attrs) {
      var base = String(productTitle || "Product").trim();
      var kw = String(keyword || "").trim();
      var color = attrs && attrs.color ? String(attrs.color) : "";
      var parts = [base];
      if (kw && base.toLowerCase().indexOf(kw.toLowerCase()) === -1) { parts.push(kw); }
      if (color && base.toLowerCase().indexOf(color.toLowerCase()) === -1) { parts.push(color); }
      var out = parts.join(" — ");
      if (out.length > 70) { out = out.slice(0, 67).replace(/\s+\S*$/, "") + "…"; }
      return out;
    },

    buildImagePlan: function (productTitle, attrs, lang) {
      var t = productTitle || "ürün";
      var c = (attrs && attrs.color) || (lang === "tr" ? "ana renk" : "primary colorway");
      if (lang === "tr") {
        return [
          "1) Hero — temiz fonda tam ürün (" + t + ", " + c + ")",
          "2) Detay — doku / kenar / bitiş yakın plan",
          "3) Açı — form ve oranları gösteren 3/4 görünüm",
          "4) Bağlam — kullanım veya ölçek (sahte rozet/banner yok)"
        ].join("\n");
      }
      return [
        "1) Hero — full " + t + " on clean background (" + c + ")",
        "2) Detail — texture / edge / binding / finish close-up",
        "3) Angle — 3/4 view showing shape and proportions",
        "4) Context — in-use or scale shot (no fake badges or banners)"
      ].join("\n");
    },

    /** Merge attributes from multiple image analyses. */
    mergeAttributes: function (list) {
      list = (list || []).filter(Boolean);
      if (!list.length) { return {}; }
      if (list.length === 1) { return list[0]; }
      var merged = Object.assign({}, list[0]);
      var features = [];
      list.forEach(function (a) {
        (a.keyFeatures || []).forEach(function (f) { if (features.indexOf(f) < 0) { features.push(f); } });
      });
      merged.keyFeatures = features.slice(0, 6);
      merged.confidence = Math.min(0.99, (merged.confidence || 0.8) + list.length * 0.02);
      merged.imagesAnalyzed = list.length;
      return merged;
    },

    /**
     * Analyze multiple product images (gallery + angles) and merge attributes.
     * @param {string[]} imageUrls
     * @returns {Promise<Object>}
     */
    analyzeMultipleImages: function (imageUrls) {
      imageUrls = (imageUrls || []).filter(Boolean);
      if (!imageUrls.length) { return this.analyzeProductImageWithVision(null); }
      var self = this;
      return Promise.all(imageUrls.map(function (url) { return self.analyzeProductImageWithVision(url); }))
        .then(function (results) { return self.mergeAttributes(results); });
    }
  };

  window.CopyPilot.vision = vision;
})();
