/* CopyPilot AI — Brand Voice DNA & Content Rules */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};
  function cfg() { return (window.CopyPilot && window.CopyPilot.config) || {}; }

  var storedRules = null;
  var storedDna = null;

  window.CopyPilot.brand = {
    /** Extract Brand Voice DNA from top-selling product copy (mock). */
    extractBrandVoiceDna: function (sampleTexts) {
      var url = (cfg().brandEndpoint || cfg().appProxyBase + "/brand") + "/extract-dna";
      return window.CopyPilot.util.fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: sampleTexts || [] })
      }, function () {
        storedDna = {
          mock: true,
          tone: "confident-premium",
          vocabulary: ["crafted", "premium", "everyday", "designed"],
          sentenceLength: "medium",
          ctaStyle: "direct",
          avoid: ["cheap", "basic", "generic"]
        };
        return storedDna;
      }).then(function (r) { storedDna = r; return r; });
    },

    /** Save content rules (tone, banned words, required phrases). */
    saveContentRules: function (rules) {
      storedRules = rules || {};
      var url = (cfg().brandEndpoint || cfg().appProxyBase + "/brand") + "/rules";
      return window.CopyPilot.util.fetchJson(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(storedRules)
      }, function () { return { mock: true, saved: true, rules: storedRules }; });
    },

    getContentRules: function () {
      if (storedRules) { return Promise.resolve(storedRules); }
      var url = (cfg().brandEndpoint || cfg().appProxyBase + "/brand") + "/rules";
      return window.CopyPilot.util.fetchJson(url, { method: "GET" }, function () {
        storedRules = {
          requiredPhrases: ["free shipping", "quality guaranteed"],
          bannedWords: ["cheap", "knockoff"],
          maxExclamation: 1,
          bulletStyle: "benefit-first"
        };
        return storedRules;
      });
    },

    getBrandDna: function () { return storedDna; },

    /** Apply rules to generated copy (client-side sanitizer). */
    applyRules: function (text, rules) {
      rules = rules || storedRules || {};
      var out = String(text || "");
      (rules.bannedWords || []).forEach(function (w) {
        out = out.replace(new RegExp("\\b" + w + "\\b", "gi"), "");
      });
      out = out.replace(/\s+/g, " ").trim();
      return out;
    }
  };
})();
