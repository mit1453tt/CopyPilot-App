/* CopyPilot AI — Multi-Language Content Generation (Deep Localization) */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};

  function cfg() { return (window.CopyPilot && window.CopyPilot.config) || {}; }

  var LANGUAGE_PARAMS = {
    en: { label: "English",  locale: "en-US", dir: "ltr", formality: "neutral", ctaFallback: "Shop now." },
    es: { label: "Español",  locale: "es-ES", dir: "ltr", formality: "formal",  ctaFallback: "Compra ahora." },
    de: { label: "Deutsch",  locale: "de-DE", dir: "ltr", formality: "formal",  ctaFallback: "Jetzt kaufen." },
    fr: { label: "Français", locale: "fr-FR", dir: "ltr", formality: "formal",  ctaFallback: "Achetez maintenant." },
    tr: { label: "Türkçe",   locale: "tr-TR", dir: "ltr", formality: "neutral", ctaFallback: "Hemen satın al." },
    ar: { label: "العربية",  locale: "ar-SA", dir: "rtl", formality: "formal",  ctaFallback: "تسوق الآن." },
    zh: { label: "中文",      locale: "zh-CN", dir: "ltr", formality: "neutral", ctaFallback: "立即购买。" }
  };

  var LOCALIZE_PREFIX = {
    en: "", es: "", de: "", fr: "", tr: "", ar: "", zh: ""
  };

  var MARKET_PARAMS = {
    en: { currency: "USD", shippingNote: "" },
    es: { currency: "EUR", shippingNote: "" },
    de: { currency: "EUR", shippingNote: "" },
    fr: { currency: "EUR", shippingNote: "" },
    tr: { currency: "TRY", shippingNote: "", culturalTone: "samimi-güvenilir" },
    ar: { currency: "AED", shippingNote: "", culturalTone: "رسمي-فاخر" },
    zh: { currency: "CNY", shippingNote: "", culturalTone: "简洁-品质" }
  };

  function deepLocalize(body, lang) {
    var out = String(body || "");
    // Do NOT invent shipping / promo lines.
    if (window.CopyPilot.brand && window.CopyPilot.brand.getBrandDna) {
      var dna = window.CopyPilot.brand.getBrandDna();
      if (dna && dna.vocabulary && dna.vocabulary[0]) {
        out = out.replace(/premium/gi, dna.vocabulary[0]);
      }
    }
    if (window.CopyPilot.brand && window.CopyPilot.brand.applyRules) {
      out = window.CopyPilot.brand.applyRules(out);
    }
    return out.trim();
  }

  var CLAIM_BAN = /free shipping|ücretsiz kargo|ucretsiz kargo|google\b|best seller|award[- ]winning|#1|guaranteed|money[- ]back|env[ií]o gratis|kostenloser versand|livraison gratuite/i;

  function stripInventedClaims(text) {
    var lines = String(text || "").split(/\r?\n/);
    var cleaned = lines.filter(function (line) {
      return !CLAIM_BAN.test(line) && !/seo focus phrases|buyers reward|trio google/i.test(line);
    });
    return cleaned.join("\n")
      .replace(/\b(Google|Bing|Yahoo)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function weaveSeoKeywords(body, keywords) {
    // Do not append keyword dumps — that created spam like "Google" / unrelated SERP phrases.
    return String(body || "");
  }

  var i18n = {
    params: LANGUAGE_PARAMS,
    markets: MARKET_PARAMS,

    isRtl: function (language) {
      return !!(LANGUAGE_PARAMS[language] && LANGUAGE_PARAMS[language].dir === "rtl");
    },

    deepLocalize: deepLocalize,

    generate: function (ctx) {
      ctx = ctx || {};
      var lang = LANGUAGE_PARAMS[ctx.language] ? ctx.language : "en";

      return new Promise(function (resolve) {
        (async function () {
          // Seed attributes from Shopify product facts when Vision hasn't run.
          var attrs = Object.assign({}, ctx.attributes || {});
          if (!attrs.category && ctx.productType) { attrs.category = ctx.productType; }
          if (!attrs.keyFeatures || !attrs.keyFeatures.length) {
            var bits = [];
            if (ctx.productVendor) { bits.push(ctx.productVendor); }
            if (ctx.productType) { bits.push(ctx.productType); }
            var desc = String(ctx.productDescription || "").replace(/\s+/g, " ").trim();
            if (desc) { bits.push(desc.slice(0, 80) + (desc.length > 80 ? "…" : "")); }
            if (bits.length) { attrs.keyFeatures = bits.slice(0, 4); }
          }

          var base;
          if (window.CopyPilot.vision && window.CopyPilot.vision.buildAidaSalesCopy) {
            base = window.CopyPilot.vision.buildAidaSalesCopy(attrs, {
              tone: ctx.tone, productTitle: ctx.productTitle, language: lang, keyword: ctx.keyword || ""
            });
          } else {
            base = (ctx.productTitle || "Product") + " — quality you can trust.";
          }

          var body = base;
          try {
            if (window.CopyPilot.gemini && window.CopyPilot.gemini.isConfigured()) {
              var geminiBody = await window.CopyPilot.gemini.writeAidaCopy({
                language: lang,
                tone: ctx.tone || "professional",
                productTitle: ctx.productTitle || "",
                attributes: ctx.attributes || {},
                keyword: ctx.keyword || ""
              });
              if (geminiBody) { body = geminiBody; }
            }
            // No mock /generate invents — local AIDA is the truthful fallback.
          } catch (err) {
            console.error("[CopyPilot Error]: Generation fell back to local AIDA copy (" + lang + ") —", err.message);
            body = base;
          }

          // SEO weave: ensure primary keyword + top SERP terms appear in the copy.
          var serp = window.CopyPilot.serp;
          var kwList = [];
          if (ctx.keyword) { kwList.push(ctx.keyword); }
          if (ctx.keywords && ctx.keywords.length) { kwList = kwList.concat(ctx.keywords); }
          if (!kwList.length && serp) {
            try { kwList = await serp.fetchLiveSerpKeywords(ctx.productTitle, ctx.keyword); } catch (e2) { /* ignore */ }
          }
          body = stripInventedClaims(weaveSeoKeywords(body, kwList));

          var localized = stripInventedClaims(deepLocalize(body, lang));
          var salesTitle = window.CopyPilot.vision && window.CopyPilot.vision.buildSalesTitle
            ? window.CopyPilot.vision.buildSalesTitle(ctx.productTitle, ctx.keyword || kwList[0], attrs)
            : (ctx.productTitle || "Product");
          var imagePlan = window.CopyPilot.vision && window.CopyPilot.vision.buildImagePlan
            ? window.CopyPilot.vision.buildImagePlan(ctx.productTitle, attrs, lang)
            : "";
          var metaTitle = serp ? serp.generateMetaTitle(salesTitle, ctx.keyword || kwList[0]) : salesTitle;
          var metaDescription = serp ? serp.generateMetaDescription(localized, ctx.keyword || kwList[0]) : localized.replace(/\s+/g, " ").slice(0, 160);

          resolve({
            language: lang,
            dir: (LANGUAGE_PARAMS[lang] && LANGUAGE_PARAMS[lang].dir) || "ltr",
            market: MARKET_PARAMS[lang],
            title: salesTitle,
            salesTitle: salesTitle,
            body: localized,
            metaTitle: metaTitle,
            metaDescription: metaDescription,
            imagePlan: imagePlan
          });
        })();
      });
    }
  };

  window.CopyPilot.i18n = i18n;
})();
