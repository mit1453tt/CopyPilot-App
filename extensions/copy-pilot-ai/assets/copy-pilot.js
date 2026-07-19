/* CopyPilot AI — Agentic SEO & Sales Copywriter
   Orchestrator / controller. Wires the dashboard UI to the module layers:
     - vision  (copy-pilot-vision.js)
     - serp    (copy-pilot-serp.js)
     - audit   (copy-pilot-audit.js)
     - i18n    (copy-pilot-i18n.js)
     - billing (copy-pilot-billing.js)

   ============================ IMPORTANT ============================
   Every endpoint and key below is a MOCK PLACEHOLDER and is fully isolated.
   Nothing here talks to a real service. Replace these values manually with
   real, SERVER-SIDE credentials before production. API keys must NEVER be
   shipped in storefront JavaScript — the placeholders exist only to mark the
   spots that need real wiring later.
   =================================================================== */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};

  /* ---- Centralized MOCK configuration (placeholders only) ---- */
  var CONFIG = {
    // Storefront calls App Proxy (same origin on the shop). Secrets stay on server.
    appProxyBase: "/apps/copy-pilot",
    geminiProxyPath: "/apps/copy-pilot/copilot-gemini",
    // Supabase REST is locked (RLS). Theme ledger is local-only.
    // Production credits: Admin metafield copypilot.credits (copy-pilot-home).
    supabaseUrl: "",
    supabaseAnonKey: "",
    supabasePublishableKey: "",
    geminiModel: "gemini-2.0-flash",
    shopifyAdminRest: "",
    shopifyAdminGraphql: "",
    webhookEndpoint: "",
    metafieldEndpoint: "",
    visionEndpoint: "",
    serpEndpoint: "",
    billingEndpoint: "",
    syncEndpoint: "",
    enrichmentEndpoint: "",
    brandEndpoint: "",
    queueEndpoint: "",
    geoEndpoint: "",
    mediaEndpoint: "",
    tagsEndpoint: "",
    analyticsEndpoint: "",
    chatEndpoint: "",
    importEndpoint: "",
    agentEndpoint: "",
    optimizeEndpoint: ""
  };
  window.CopyPilot.config = CONFIG;

  var GAUGE_R = 52;
  var GAUGE_C = 2 * Math.PI * GAUGE_R;

  function $(root, sel) { return root.querySelector(sel); }
  function $all(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function buildContext(root) {
    var d = root.dataset;
    return {
      config: CONFIG,
      root: root,
      blockId: d.blockId || "",
      shopDomain: d.shopDomain || "YOUR_SHOP_DOMAIN_PLACEHOLDER",
      apiBase: d.apiBase || CONFIG.appProxyBase,
      productId: d.productId || "",
      productTitle: d.productTitle || "Product",
      productType: d.productType || "",
      productVendor: d.productVendor || "",
      productDescription: d.productDescription || "",
      featuredImage: d.featuredImage || "",
      defaultLanguage: d.defaultLanguage || "en",
      defaultTone: d.defaultTone || "professional",
      monthlyCredits: parseInt(d.monthlyCredits, 10) || 200,
      showBilling: d.showBilling === "1"
    };
  }

  function CopyPilotApp(root) {
    this.root = root;
    this.ctx = buildContext(root);
    window.CopyPilot.context = this.ctx;
    this.state = {
      attributes: null,
      keywords: [],
      results: {},      // { lang: { body, metaTitle, metaDescription, title } }
      activeLang: this.ctx.defaultLanguage,
      credits: { plan_name: "—", used_credits: 0, monthly_credits: this.ctx.monthlyCredits, exhausted: false }
    };
  }

  CopyPilotApp.prototype.init = function () {
    var self = this;
    var root = this.root;

    // Prep the SEO gauge geometry.
    var prog = $(root, "[data-cp-gauge-progress]");
    if (prog) {
      prog.style.strokeDasharray = GAUGE_C.toFixed(2);
      prog.style.strokeDashoffset = GAUGE_C.toFixed(2);
    }

    // Wire buttons.
    var actions = {
      vision: function () { self.onVision(); },
      generate: function () { self.onGenerate(); },
      serp: function () { self.onSerp(); },
      audit: function () { self.onAudit(); },
      autofix: function () { self.onAutoFix(); },
      "buy-credits": function (e) {
        var pack = (e && e.currentTarget && e.currentTarget.getAttribute("data-cp-pack")) || "pack_30";
        self.onBuyCredits(pack);
      },
      subscribe: function (e) {
        var plan = (e && e.currentTarget && e.currentTarget.getAttribute("data-cp-plan")) || "starter";
        self.onBilling(plan);
      },
      upgrade: function () { self.onBilling("upgrade"); }
    };
    $all(root, "[data-cp-action]").forEach(function (btn) {
      var fn = actions[btn.getAttribute("data-cp-action")];
      if (fn) {
        btn.addEventListener("click", function (e) { fn(e); });
      }
    });

    // Modal close.
    $all(root.parentNode || document, "[data-cp-modal-close]").forEach(function (el) {
      el.addEventListener("click", function () { self.toggleModal(false); });
    });

    // Meta character counters.
    this.bindCounter($(root, "[data-cp-meta-title]"), $(root, "[data-cp-meta-title-count]"), 60);
    this.bindCounter($(root, "[data-cp-meta-desc]"), $(root, "[data-cp-meta-desc-count]"), 160);

    // Select-all in the audit table.
    var selectAll = $(root, "[data-cp-audit-selectall]");
    if (selectAll) {
      selectAll.addEventListener("change", function () {
        $all(root, "[data-cp-audit-body] [data-cp-row-check]").forEach(function (cb) {
          if (!cb.disabled) { cb.checked = selectAll.checked; }
        });
      });
    }

    // Load credits.
    this.loadCredits();

    console.log("[CopyPilot] initialized", { blockId: this.ctx.blockId, shop: this.ctx.shopDomain });
  };

  CopyPilotApp.prototype.bindCounter = function (input, counter, max) {
    if (!input || !counter) { return; }
    var update = function () {
      var len = (input.value || "").length;
      counter.textContent = len + "/" + max;
      counter.classList.toggle("cp-count-over", len > max);
    };
    input.addEventListener("input", update);
    update();
  };

  /* ---------------- Layer 5: credits UI ---------------- */
  CopyPilotApp.prototype.loadCredits = function () {
    var self = this;
    if (!window.CopyPilot.billing) { return; }
    window.CopyPilot.billing.checkUserSubscriptionAndCredits().then(function (c) {
      self.state.credits = c;
      self.renderCredits();
      self.applyCreditGate();
    });
  };

  CopyPilotApp.prototype.renderCredits = function () {
    var root = this.root, c = this.state.credits;
    var planEl = $(root, "[data-cp-plan-name]");
    var countEl = $(root, "[data-cp-credit-count]");
    var fillEl = $(root, "[data-cp-credit-fill]");
    var pool = c.monthly_credits || 1;
    var used = c.used_credits || 0;
    var pct = Math.min(100, Math.round((used / pool) * 100));
    if (planEl) { planEl.textContent = c.plan_name || "—"; }
    if (countEl) {
      var bonusNote = c.bonus_credits ? " (+" + c.bonus_credits + " pack)" : "";
      countEl.textContent = used + " / " + pool + " credits used" + bonusNote;
    }
    if (fillEl) {
      fillEl.style.width = pct + "%";
      fillEl.classList.toggle("cp-credit-danger", pct >= 85 || c.exhausted);
    }
  };

  CopyPilotApp.prototype.applyCreditGate = function () {
    var root = this.root, exhausted = this.state.credits.exhausted;
    ["vision", "generate"].forEach(function (act) {
      var btn = $(root, '[data-cp-action="' + act + '"]');
      if (btn) { btn.disabled = exhausted; }
    });
  };

  CopyPilotApp.prototype.toggleModal = function (show) {
    var modal = this.root.querySelector("[data-cp-modal]") ||
      (this.root.parentNode || document).querySelector("[data-cp-modal]");
    if (modal) { modal.hidden = !show; }
  };

  /* ---------------- Status helper ---------------- */
  CopyPilotApp.prototype.setStatus = function (text) {
    var el = $(this.root, "[data-cp-status]");
    if (!el) { return; }
    if (text) { el.hidden = false; el.textContent = text; }
    else { el.hidden = true; el.textContent = ""; }
  };

  CopyPilotApp.prototype.getSelectedLanguages = function () {
    var langs = $all(this.root, "[data-cp-language]:checked").map(function (cb) { return cb.value; });
    return langs.length ? langs : [this.ctx.defaultLanguage];
  };

  CopyPilotApp.prototype.getTone = function () {
    var el = $(this.root, "[data-cp-tone]");
    return el ? el.value : this.ctx.defaultTone;
  };

  CopyPilotApp.prototype.getKeyword = function () {
    var el = $(this.root, "[data-cp-keyword]");
    return el ? el.value.trim() : "";
  };

  /* ---------------- Layer 2: Vision ---------------- */
  CopyPilotApp.prototype.onVision = function () {
    var self = this;
    if (this.state.credits.exhausted) { return this.toggleModal(true); }
    var btn = $(this.root, '[data-cp-action="vision"]');
    if (btn) { btn.disabled = true; }
    this.setStatus("Analyzing image…");
    window.CopyPilot.vision.analyzeProductImageWithVision(this.ctx.featuredImage).then(function (attrs) {
      self.state.attributes = attrs;
      var copy = window.CopyPilot.vision.buildAidaSalesCopy(attrs, {
        tone: self.getTone(), productTitle: self.ctx.productTitle, language: self.state.activeLang
      });
      var out = $(self.root, "[data-cp-output]");
      if (out) { out.value = copy; }
      self.setStatus("");
      console.log("[CopyPilot] Vision attributes", attrs);
    }).catch(function (err) {
      console.error("[CopyPilot Error]: Vision flow failed —", err && err.message);
      self.setStatus("");
    }).finally(function () { if (btn) { btn.disabled = self.state.credits.exhausted; } });
  };

  /* ---------------- Layer 3 + i18n: Generate (one-click full listing) ---------------- */
  CopyPilotApp.prototype.onGenerate = function () {
    var self = this;
    if (this.state.credits.exhausted) { return this.toggleModal(true); }

    var langs = this.getSelectedLanguages();
    var tone = this.getTone();
    var keyword = this.getKeyword();
    var btn = $(this.root, '[data-cp-action="generate"]');
    if (btn) { btn.disabled = true; }
    this.setStatus("Tek tık: başlık + açıklama + meta + görsel plan…");

    // Auto-run Vision when we have an image and no attrs yet — seller shouldn't click twice.
    var ensureAttrs = Promise.resolve(self.state.attributes || {});
    if ((!self.state.attributes || !Object.keys(self.state.attributes).length) &&
        self.ctx.featuredImage && window.CopyPilot.vision &&
        window.CopyPilot.vision.analyzeProductImageWithVision) {
      this.setStatus("Görsel okunuyor, ardından tüm listing üretiliyor…");
      ensureAttrs = window.CopyPilot.vision.analyzeProductImageWithVision(self.ctx.featuredImage)
        .then(function (attrs) {
          self.state.attributes = attrs || {};
          return self.state.attributes;
        })
        .catch(function () { return self.state.attributes || {}; });
    }

    ensureAttrs.then(function () {
      var prep = window.CopyPilot.serp
        ? window.CopyPilot.serp.fetchLiveSerpKeywords(self.ctx.productTitle, keyword)
        : Promise.resolve(self.state.keywords || []);
      return prep;
    }).then(function (kws) {
      self.state.keywords = kws || [];
      self.setStatus("Satış metni yazılıyor…");
      return Promise.all(langs.map(function (lang) {
        return window.CopyPilot.i18n.generate({
          language: lang, tone: tone, productTitle: self.ctx.productTitle,
          productType: self.ctx.productType,
          productVendor: self.ctx.productVendor,
          productDescription: self.ctx.productDescription,
          attributes: self.state.attributes, keyword: keyword,
          keywords: self.state.keywords
        });
      }));
    }).then(function (results) {
      results.forEach(function (r) {
        self.state.results[r.language] = r;
        if (window.CopyPilot.billing) {
          self.state.credits = Object.assign(self.state.credits, window.CopyPilot.billing.consumeCredits(1));
        }
        if (window.CopyPilot.db) {
          window.CopyPilot.db.insertHistory({
            shop_domain: self.ctx.shopDomain,
            product_id: self.ctx.productId,
            original_title: self.ctx.productTitle,
            generated_description: r.body,
            seo_score: null
          }).catch(function (err) {
            console.error("[CopyPilot Error]: history insert failed —", err.message);
          });
        }
      });
      self.renderCredits();
      self.applyCreditGate();
      self.renderLanguageTabs(langs);
      self.showLanguage(langs.indexOf(self.state.activeLang) >= 0 ? self.state.activeLang : langs[0]);
      self.setStatus("Hazır — başlık, açıklama, meta ve görsel plan doldu.");
      self.onSerp();
    }).catch(function (err) {
      console.error("[CopyPilot Error]: Generation failed —", err && err.message);
      self.setStatus("");
    }).finally(function () { if (btn) { btn.disabled = self.state.credits.exhausted; } });
  };

  CopyPilotApp.prototype.renderLanguageTabs = function (langs) {
    var self = this;
    var tabs = $(this.root, "[data-cp-output-tabs]");
    if (!tabs) { return; }
    if (langs.length <= 1) { tabs.hidden = true; tabs.innerHTML = ""; return; }
    tabs.hidden = false;
    tabs.innerHTML = "";
    langs.forEach(function (lang) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cp-output-tab" + (lang === self.state.activeLang ? " cp-active" : "");
      b.textContent = lang.toUpperCase();
      b.addEventListener("click", function () { self.showLanguage(lang); });
      tabs.appendChild(b);
    });
  };

  CopyPilotApp.prototype.showLanguage = function (lang) {
    this.state.activeLang = lang;
    var r = this.state.results[lang];
    if (!r) { return; }
    var out = $(this.root, "[data-cp-output]");
    var st = $(this.root, "[data-cp-sales-title]");
    var ip = $(this.root, "[data-cp-image-plan]");
    var mt = $(this.root, "[data-cp-meta-title]");
    var md = $(this.root, "[data-cp-meta-desc]");
    var dir = r.dir || (window.CopyPilot.i18n && window.CopyPilot.i18n.isRtl(lang) ? "rtl" : "ltr");
    if (st) { st.value = r.salesTitle || r.title || ""; st.setAttribute("dir", dir); }
    if (out) { out.value = r.body; out.setAttribute("dir", dir); }
    if (ip) { ip.value = r.imagePlan || ""; ip.setAttribute("dir", dir); }
    if (mt) { mt.value = r.metaTitle; mt.setAttribute("dir", dir); mt.dispatchEvent(new Event("input")); }
    if (md) { md.value = r.metaDescription; md.setAttribute("dir", dir); md.dispatchEvent(new Event("input")); }
    $all(this.root, "[data-cp-output-tabs] .cp-output-tab").forEach(function (t) {
      t.classList.toggle("cp-active", t.textContent === lang.toUpperCase());
    });
  };

  /* ---------------- Layer 3: SERP + SEO gauge ---------------- */
  CopyPilotApp.prototype.onSerp = function () {
    var self = this;
    var keyword = this.getKeyword();
    var out = $(this.root, "[data-cp-output]");
    var text = out ? out.value : "";
    var btn = $(this.root, '[data-cp-action="serp"]');
    if (btn) { btn.disabled = true; }

    window.CopyPilot.serp.fetchLiveSerpKeywords(this.ctx.productTitle, keyword)
      .then(function (keywords) {
        self.state.keywords = keywords;
        var result = window.CopyPilot.serp.calculateSeoScore(text, keywords);
        self.renderSeoScore(result);
      })
      .catch(function (err) {
        console.error("[CopyPilot Error]: SERP scoring failed —", err && err.message);
      })
      .finally(function () { if (btn) { btn.disabled = false; } });
  };

  CopyPilotApp.prototype.renderSeoScore = function (result) {
    var root = this.root;
    var prog = $(root, "[data-cp-gauge-progress]");
    var valEl = $(root, "[data-cp-gauge-value]");
    var labelEl = $(root, "[data-cp-gauge-label]");
    var tips = $(root, "[data-cp-seo-tips]");
    var score = result.score;

    if (prog) {
      prog.style.strokeDashoffset = (GAUGE_C * (1 - score / 100)).toFixed(2);
      prog.classList.remove("cp-score-bad", "cp-score-warn", "cp-score-good");
      prog.classList.add(score >= 80 ? "cp-score-good" : (score >= 50 ? "cp-score-warn" : "cp-score-bad"));
    }
    if (valEl) { valEl.textContent = score; }
    if (labelEl) {
      labelEl.textContent = score >= 80 ? "Excellent — Google ready"
        : score >= 50 ? "Good — room to improve" : "Needs optimization";
    }
    if (tips) {
      tips.innerHTML = "";
      tips.appendChild(this.tip("Keyword coverage: " + result.coverage + "%"));
      (result.missing || []).slice(0, 4).forEach(function (kw) {
        var li = document.createElement("li");
        li.textContent = "Add keyword: “" + kw + "”";
        tips.appendChild(li);
      });
      if (!(result.missing || []).length && result.matched.length) {
        tips.appendChild(this.tip("All target keywords present."));
      }
    }
  };

  CopyPilotApp.prototype.tip = function (text) {
    var li = document.createElement("li");
    li.textContent = text;
    return li;
  };

  /* ---------------- Layer 4: Bulk Audit ---------------- */
  CopyPilotApp.prototype.onAudit = function () {
    var self = this;
    var root = this.root;
    var btn = $(root, '[data-cp-action="audit"]');
    if (btn) { btn.disabled = true; }
    var empty = $(root, "[data-cp-audit-empty]");
    if (empty) { empty.hidden = true; }

    window.CopyPilot.audit.runAutonomousStoreAudit().then(function (res) {
      self.renderAuditTable(res.flagged);
      console.log("[CopyPilot] Audit scanned " + res.scanned + " products, flagged " + res.flagged.length);
    }).catch(function (err) {
      console.error("[CopyPilot Error]: Store audit failed —", err && err.message);
    }).finally(function () { if (btn) { btn.disabled = false; } });
  };

  CopyPilotApp.prototype.renderAuditTable = function (flagged) {
    var root = this.root;
    var toolbar = $(root, "[data-cp-audit-toolbar]");
    var wrap = $(root, "[data-cp-audit-wrap]");
    var body = $(root, "[data-cp-audit-body]");
    var empty = $(root, "[data-cp-audit-empty]");
    if (!body) { return; }
    body.innerHTML = "";

    if (!flagged.length) {
      if (toolbar) { toolbar.hidden = true; }
      if (wrap) { wrap.hidden = true; }
      if (empty) { empty.hidden = false; empty.textContent = "No issues found — your catalog looks great."; }
      return;
    }
    if (toolbar) { toolbar.hidden = false; }
    if (wrap) { wrap.hidden = false; }

    flagged.forEach(function (p) {
      var tr = document.createElement("tr");
      tr.setAttribute("data-cp-audit-row", p.id);
      var badgeClass = p.severity === "critical" ? "cp-badge-critical" : "cp-badge-warn";
      var badgeText = p.severity === "critical" ? "Critical" : "Warning";
      tr.innerHTML =
        '<td class="cp-td-check"><input type="checkbox" data-cp-row-check value="' + escapeHtml(p.id) + '"/></td>' +
        "<td>" + escapeHtml(p.title) + "</td>" +
        "<td>" + escapeHtml((p.issues || []).join("; ")) + "</td>" +
        '<td data-cp-row-status><span class="cp-badge ' + badgeClass + '">' + badgeText + "</span></td>";
      body.appendChild(tr);
    });
    // Reset select-all.
    var selectAll = $(root, "[data-cp-audit-selectall]");
    if (selectAll) { selectAll.checked = false; }
    this._auditData = {};
    flagged.forEach(function (p) { /* keep records for auto-fix */ });
    this._auditRecords = flagged;
  };

  CopyPilotApp.prototype.onAutoFix = function () {
    var self = this;
    var root = this.root;
    var checked = $all(root, "[data-cp-audit-body] [data-cp-row-check]:checked");
    if (!checked.length) {
      console.log("[CopyPilot] Auto-fix: no rows selected.");
      return;
    }
    var ids = checked.map(function (cb) { return cb.value; });
    var records = (this._auditRecords || []).filter(function (r) { return ids.indexOf(r.id) >= 0; });

    // Mark selected rows as "fixing".
    ids.forEach(function (id) { self.setRowStatus(id, "fixing", "Fixing…"); });
    var btn = $(root, '[data-cp-action="autofix"]');
    if (btn) { btn.disabled = true; }

    window.CopyPilot.audit.autoFixSelected(records, function (updated) {
      self.setRowStatus(updated.id, "fixed", "Fixed");
      var cb = root.querySelector('[data-cp-row-check][value="' + updated.id + '"]');
      if (cb) { cb.checked = false; cb.disabled = true; }
    }).then(function (results) {
      console.log("[CopyPilot] Auto-fix complete for " + results.length + " products.");
    }).catch(function (err) {
      console.error("[CopyPilot Error]: Auto-fix failed —", err && err.message);
    }).finally(function () { if (btn) { btn.disabled = false; } });
  };

  CopyPilotApp.prototype.setRowStatus = function (id, cls, text) {
    var cell = this.root.querySelector('[data-cp-audit-row="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"] [data-cp-row-status]');
    if (!cell) {
      // Fallback: manual scan (ids contain special chars).
      var rows = $all(this.root, "[data-cp-audit-row]");
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].getAttribute("data-cp-audit-row") === id) { cell = rows[i].querySelector("[data-cp-row-status]"); break; }
      }
    }
    if (cell) { cell.innerHTML = '<span class="cp-badge cp-badge-' + cls + '">' + escapeHtml(text) + "</span>"; }
  };

  /* ---------------- Layer 5: Billing ---------------- */
  CopyPilotApp.prototype.onBuyCredits = function (packId) {
    var self = this;
    if (!window.CopyPilot.billing) { return; }
    window.CopyPilot.billing.purchaseCreditPack(packId || "pack_30").then(function (res) {
      self.state.credits = Object.assign(self.state.credits, res.ledger);
      self.renderCredits();
      self.applyCreditGate();
      self.toggleModal(false);
      console.log("[CopyPilot] Credit pack purchased (mock).", res.pack && res.pack.name, res.confirmationUrl);
    }).catch(function (err) {
      console.error("[CopyPilot Error]: Credit pack purchase failed —", err && err.message);
    });
  };

  CopyPilotApp.prototype.onBilling = function (planType) {
    var self = this;
    if (!window.CopyPilot.billing) { return; }
    window.CopyPilot.billing.initiateShopifyBillingRedirect(planType).then(function (res) {
      self.state.credits = Object.assign(self.state.credits, res.ledger);
      self.renderCredits();
      self.applyCreditGate();
      self.toggleModal(false);
      if (typeof self.renderPlans === "function") { self.renderPlans(); }
      console.log("[CopyPilot] Billing (" + planType + ") confirmed (mock).", res.confirmationUrl);
    }).catch(function (err) {
      console.error("[CopyPilot Error]: Billing redirect failed —", err && err.message);
    });
  };

  /* Public async APIs requested by architecture (wrappers + orchestration) */
  window.CopyPilot.analyzeProductImageWithVision = function (imageUrl) {
    return window.CopyPilot.vision.analyzeProductImageWithVision(imageUrl);
  };

  window.CopyPilot.fetchLiveSerpKeywords = function (productTitle, targetKeywords) {
    return window.CopyPilot.serp.fetchLiveSerpKeywords(productTitle, targetKeywords).then(function (keywords) {
      var outEl = document.querySelector("[data-cp-output]");
      var text = outEl ? outEl.value : "";
      var scored = window.CopyPilot.serp.calculateSeoScore(text, keywords);
      // Reflect onto the circular gauge if an app instance exposed render via DOM.
      try {
        var appRoot = document.querySelector("[data-copy-pilot-app][data-cp-init]");
        if (appRoot && window.CopyPilot._activeApp) {
          window.CopyPilot._activeApp.state.keywords = keywords;
          window.CopyPilot._activeApp.renderSeoScore(scored);
        }
      } catch (e) { /* ignore */ }
      return Object.assign({ keywords: keywords }, scored);
    });
  };

  window.CopyPilot.runAutonomousStoreAudit = function () {
    return window.CopyPilot.audit.runAutonomousStoreAudit();
  };

  window.CopyPilot.checkUserSubscriptionAndCredits = function () {
    return window.CopyPilot.billing.checkUserSubscriptionAndCredits();
  };

  /* ---------------- Boot ---------------- */
  function boot() {
    $all(document, "[data-copy-pilot-app]:not([data-cp-init])").forEach(function (root) {
      root.setAttribute("data-cp-init", "1");
      try {
        var app = new CopyPilotApp(root);
        window.CopyPilot._activeApp = app;
        app.init();
      } catch (err) {
        console.error("[CopyPilot Error]: init failed —", err && err.message);
      }
    });
  }

  // Defer so copy-pilot-features.js can patch App.prototype.init first (defer order race).
  function scheduleBoot() { setTimeout(boot, 0); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleBoot);
  } else {
    scheduleBoot();
  }
  document.addEventListener("shopify:section:load", scheduleBoot);

  window.CopyPilot.App = CopyPilotApp;
})();
