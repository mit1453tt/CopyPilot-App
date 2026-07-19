/* CopyPilot AI — Extended features (tabs, GEO, sync, brand, queue, agent, chat, optimize) */
(function () {
  "use strict";

  function waitForApp(cb) {
    if (window.CopyPilot && window.CopyPilot.App) { return cb(window.CopyPilot.App); }
    setTimeout(function () { waitForApp(cb); }, 50);
  }

  waitForApp(function (App) {
    var GAUGE_C = 2 * Math.PI * 52;

    function $(root, sel) { return root.querySelector(sel); }
    function $all(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }

    var origInit = App.prototype.init;
    App.prototype.init = function () {
      origInit.call(this);
      var geoProg = $(this.root, "[data-cp-geo-progress]");
      if (geoProg) {
        geoProg.style.strokeDasharray = GAUGE_C.toFixed(2);
        geoProg.style.strokeDashoffset = GAUGE_C.toFixed(2);
      }
      this.initTabs();
      this.initExtraActions();
      this.loadBrandRules();
      this.renderAgentState();
      this.renderPlans();
      this.renderPacks();
    };

    App.prototype.initTabs = function () {
      var self = this;
      $all(this.root, "[data-cp-tab]").forEach(function (btn) {
        if (btn.getAttribute("data-cp-tab-bound") === "1") { return; }
        btn.setAttribute("data-cp-tab-bound", "1");
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          var tab = btn.getAttribute("data-cp-tab");
          $all(self.root, "[data-cp-tab]").forEach(function (b) {
            b.classList.toggle("cp-tab-active", b === btn);
            b.setAttribute("aria-selected", b === btn ? "true" : "false");
          });
          $all(self.root, "[data-cp-panel]").forEach(function (p) {
            var on = p.getAttribute("data-cp-panel") === tab;
            p.hidden = !on;
            p.style.display = on ? "" : "none";
          });
        });
      });
    };

    App.prototype.initExtraActions = function () {
      var self = this;
      var map = {
        publish: function () { self.onPublish(); },
        "multi-vision": function () { self.onMultiVision(); },
        enrich: function () { self.onEnrich(); },
        "extract-dna": function () { self.onExtractDna(); },
        "save-rules": function () { self.onSaveRules(); },
        "gen-schema": function () { self.onGenSchema(); },
        "gen-llms": function () { self.onGenLlms(); },
        "gen-geo": function () { self.onGenGeo(); },
        "gen-alts": function () { self.onGenAlts(); },
        "apply-tags": function () { self.onApplyTags(); },
        "import-csv": function () { self.onImportCsv(); },
        "import-pim": function () { self.onImportPim(); },
        "queue-run": function () { self.onQueueRun(); },
        "agent-run": function () { self.onAgentRun(); },
        "agent-start": function () { self.onAgentStart(); },
        "agent-stop": function () { self.onAgentStop(); },
        "track-rank": function () { self.onTrackRank(); },
        "load-analytics": function () { self.onLoadAnalytics(); },
        "ab-create": function () { self.onAbCreate(); },
        "ab-pick": function () { self.onAbPick(); },
        "chat-send": function () { self.onChatSend(); },
        subscribe: function (e) {
          var plan = e.currentTarget.getAttribute("data-cp-plan") || "starter";
          self.onBilling(plan);
        },
        "buy-credits": function (e) {
          var pack = e.currentTarget.getAttribute("data-cp-pack") || "pack_30";
          self.onBuyCredits(pack);
        }
      };
      Object.keys(map).forEach(function (action) {
        var btn = $(self.root, '[data-cp-action="' + action + '"]');
        if (btn) { btn.addEventListener("click", map[action]); }
      });
      var chatInput = $(this.root, "[data-cp-chat-input]");
      if (chatInput) {
        chatInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter") { e.preventDefault(); self.onChatSend(); }
        });
      }
      var csvInput = $(this.root, "[data-cp-csv-input]");
      if (csvInput) {
        csvInput.addEventListener("change", function () {
          if (csvInput.files && csvInput.files[0]) { self._csvFile = csvInput.files[0]; }
        });
      }
    };

    App.prototype.guardCredits = function () {
      if (this.state.credits.exhausted) { this.toggleModal(true); return true; }
      return false;
    };

    /* ---- Publish to Shopify ---- */
    App.prototype.onPublish = function () {
      var self = this;
      var out = $(this.root, "[data-cp-output]");
      var mt = $(this.root, "[data-cp-meta-title]");
      var md = $(this.root, "[data-cp-meta-desc]");
      var status = $(this.root, "[data-cp-publish-status]");
      if (!window.CopyPilot.sync) { return; }
      if (status) { status.textContent = "Publishing…"; }
      var st = $(this.root, "[data-cp-sales-title]");
      var ip = $(this.root, "[data-cp-image-plan]");
      window.CopyPilot.sync.publishToShopify({
        productId: this.ctx.productId,
        title: st ? st.value : "",
        body: out ? out.value : "",
        metaTitle: mt ? mt.value : "",
        metaDescription: md ? md.value : "",
        imagePlan: ip ? ip.value : "",
        tags: this.state.suggestedTags || []
      }).then(function (r) {
        if (status) { status.textContent = r.mock ? "Published (mock) ✓" : "Published ✓"; }
        console.log("[CopyPilot] Published", r);
      }).catch(function (e) {
        console.error("[CopyPilot Error]: publish failed —", e.message);
        if (status) { status.textContent = "Publish failed"; }
      });
    };

    /* ---- Multi-image Vision ---- */
    App.prototype.onMultiVision = function () {
      var self = this;
      if (this.guardCredits()) { return; }
      var urls = [this.ctx.featuredImage].filter(Boolean);
      $all(this.root, "[data-cp-extra-image]").forEach(function (inp) {
        if (inp.value) { urls.push(inp.value); }
      });
      var el = $(this.root, "[data-cp-vision-result]");
      if (el) { el.textContent = "Analyzing " + urls.length + " image(s)…"; }
      window.CopyPilot.vision.analyzeMultipleImages(urls).then(function (attrs) {
        self.state.attributes = attrs;
        if (el) { el.textContent = JSON.stringify(attrs, null, 2); }
        self.onVision();
      });
    };

    /* ---- Enrichment ---- */
    App.prototype.onEnrich = function () {
      var self = this;
      var el = $(this.root, "[data-cp-enrich-result]");
      window.CopyPilot.enrichment.enrichProductData({
        id: this.ctx.productId, title: this.ctx.productTitle, vendor: this.ctx.productVendor
      }).then(function (r) {
        self.state.enrichment = r;
        if (el) { el.textContent = JSON.stringify(r.enriched || r, null, 2); }
      });
    };

    /* ---- Brand Voice ---- */
    App.prototype.loadBrandRules = function () {
      var self = this;
      if (!window.CopyPilot.brand) { return; }
      window.CopyPilot.brand.getContentRules().then(function (rules) {
        var ta = $(self.root, "[data-cp-brand-rules]");
        if (ta) { ta.value = JSON.stringify(rules, null, 2); }
      });
    };

    App.prototype.onExtractDna = function () {
      var self = this;
      var samples = [this.ctx.productDescription, $(this.root, "[data-cp-output]") && $(this.root, "[data-cp-output]").value].filter(Boolean);
      window.CopyPilot.brand.extractBrandVoiceDna(samples).then(function (dna) {
        var el = $(self.root, "[data-cp-brand-dna]");
        if (el) { el.textContent = JSON.stringify(dna, null, 2); }
      });
    };

    App.prototype.onSaveRules = function () {
      var ta = $(this.root, "[data-cp-brand-rules]");
      try {
        var rules = JSON.parse(ta ? ta.value : "{}");
        window.CopyPilot.brand.saveContentRules(rules).then(function () {
          console.log("[CopyPilot] Content rules saved");
        });
      } catch (e) {
        console.error("[CopyPilot Error]: invalid rules JSON —", e.message);
      }
    };

    /* ---- GEO + Schema ---- */
    App.prototype.onGenGeo = function () {
      var self = this;
      var out = $(this.root, "[data-cp-output]");
      var text = out ? out.value : "";
      var geo = window.CopyPilot.geo.calculateGeoScore({
        title: this.ctx.productTitle, body: text,
        metaDescription: $(this.root, "[data-cp-meta-desc]") && $(this.root, "[data-cp-meta-desc]").value,
        attributes: this.state.attributes
      });
      self.renderGeoScore(geo);
      window.CopyPilot.geo.fetchGeoInsights(self.getKeyword()).then(function (insights) {
        var faqEl = $(self.root, "[data-cp-faq-json]");
        if (faqEl && insights.suggestedFaqs) {
          faqEl.value = JSON.stringify(window.CopyPilot.geo.generateFaqSchema(insights.suggestedFaqs), null, 2);
        }
      });
    };

    App.prototype.renderGeoScore = function (geo) {
      var prog = $(this.root, "[data-cp-geo-progress]");
      var val = $(this.root, "[data-cp-geo-value]");
      var tips = $(this.root, "[data-cp-geo-tips]");
      if (prog) {
        prog.style.strokeDashoffset = (GAUGE_C * (1 - geo.score / 100)).toFixed(2);
        prog.classList.remove("cp-score-bad", "cp-score-warn", "cp-score-good");
        prog.classList.add(geo.score >= 80 ? "cp-score-good" : geo.score >= 50 ? "cp-score-warn" : "cp-score-bad");
      }
      if (val) { val.textContent = geo.score; }
      if (tips) {
        tips.innerHTML = "";
        (geo.tips || []).forEach(function (t) {
          var li = document.createElement("li"); li.textContent = t; tips.appendChild(li);
        });
      }
    };

    App.prototype.onGenSchema = function () {
      var out = $(this.root, "[data-cp-output]");
      var schema = window.CopyPilot.geo.generateProductSchema(
        { title: this.ctx.productTitle, vendor: this.ctx.productVendor, featuredImage: this.ctx.featuredImage },
        { body: out ? out.value : "" }
      );
      var el = $(this.root, "[data-cp-schema-json]");
      if (el) { el.value = JSON.stringify(schema, null, 2); }
    };

    App.prototype.onGenLlms = function () {
      var txt = window.CopyPilot.geo.generateLlmsTxt({ domain: this.ctx.shopDomain, name: "CopyPilot Store" });
      var el = $(this.root, "[data-cp-llms-txt]");
      if (el) { el.value = txt; }
    };

    /* ---- Media + Tags ---- */
    App.prototype.onGenAlts = function () {
      var self = this;
      var list = $(this.root, "[data-cp-alt-list]");
      var urls = [this.ctx.featuredImage].filter(Boolean);
      window.CopyPilot.media.generateBulkAltText(urls, this.ctx.productTitle, this.state.attributes, function (item) {
        if (list) {
          var li = document.createElement("li");
          li.textContent = item.altText;
          list.appendChild(li);
        }
      });
    };

    App.prototype.onApplyTags = function () {
      var self = this;
      var tags = window.CopyPilot.tags.suggestTags(this.state.attributes, this.state.enrichment);
      this.state.suggestedTags = tags;
      var el = $(this.root, "[data-cp-tags-preview]");
      if (el) { el.textContent = tags.join(", "); }
      window.CopyPilot.tags.applyTags(this.ctx.productId, tags);
    };

    /* ---- Import + Queue ---- */
    App.prototype.onImportCsv = function () {
      var self = this;
      if (!this._csvFile || !window.CopyPilot.import) { return; }
      window.CopyPilot.import.importFromFile(this._csvFile).then(function (r) {
        window.CopyPilot.queue.enqueue(r.products, "generate");
        var el = $(self.root, "[data-cp-queue-status]");
        if (el) { el.textContent = "Queued " + r.count + " products from CSV"; }
      });
    };

    App.prototype.onImportPim = function () {
      var self = this;
      var connector = $(this.root, "[data-cp-pim-connector]");
      window.CopyPilot.import.importFromPim(connector ? connector.value : "akeneo").then(function (r) {
        window.CopyPilot.queue.enqueue(r.products || [], "generate");
        var el = $(self.root, "[data-cp-queue-status]");
        if (el) { el.textContent = "Queued " + (r.count || 0) + " from PIM"; }
      });
    };

    App.prototype.onQueueRun = function () {
      var self = this;
      var el = $(this.root, "[data-cp-queue-status]");
      var bar = $(this.root, "[data-cp-queue-bar]");
      window.CopyPilot.queue.process({ batchSize: 25, concurrency: 3 }, function (stats) {
        if (el) { el.textContent = "Processed " + stats.done + "/" + stats.total + " (failed: " + stats.failed + ")"; }
        if (bar) { bar.style.width = (stats.total ? Math.round(stats.done / stats.total * 100) : 0) + "%"; }
      }).then(function (res) {
        console.log("[CopyPilot] Queue complete", res);
      });
    };

    /* ---- Agent ---- */
    App.prototype.renderAgentState = function () {
      if (!window.CopyPilot.agent) { return; }
      var st = window.CopyPilot.agent.getState();
      var el = $(this.root, "[data-cp-agent-status]");
      if (el) {
        el.textContent = st.enabled
          ? "Agent ON — next run ~" + (st.nextRun ? new Date(st.nextRun).toLocaleTimeString() : "—")
          : "Agent OFF";
      }
    };

    App.prototype.onAgentRun = function () {
      var self = this;
      var log = $(this.root, "[data-cp-agent-log]");
      window.CopyPilot.agent.runCycle(this.ctx, function (step, detail) {
        if (log) {
          var p = document.createElement("p");
          p.textContent = step + (detail && detail.steps ? " (" + detail.steps.length + " steps)" : "");
          log.appendChild(p);
        }
      }).then(function () { self.renderAgentState(); });
    };

    App.prototype.onAgentStart = function () {
      var self = this;
      var hours = parseInt(($(this.root, "[data-cp-agent-interval]") || {}).value, 10) || 24;
      window.CopyPilot.agent.startScheduler(this.ctx, hours, function (step) {
        var log = $(self.root, "[data-cp-agent-log]");
        if (log) { var p = document.createElement("p"); p.textContent = "[scheduled] " + step; log.appendChild(p); }
      });
      this.renderAgentState();
    };

    App.prototype.onAgentStop = function () {
      window.CopyPilot.agent.stopScheduler();
      this.renderAgentState();
    };

    /* ---- Analytics + Optimize ---- */
    App.prototype.onTrackRank = function () {
      var self = this;
      window.CopyPilot.analytics.trackRank(this.ctx.productId, this.getKeyword()).then(function (r) {
        var el = $(self.root, "[data-cp-rank-result]");
        if (el) { el.textContent = "Position #" + r.position + " (Δ " + r.delta + ") for \"" + r.keyword + "\""; }
      });
    };

    App.prototype.onLoadAnalytics = function () {
      window.CopyPilot.analytics.getPerformanceSummary(this.ctx.productId).then(function (s) {
        var el = document.querySelector("[data-cp-analytics-summary]");
        if (el) {
          el.innerHTML = "<p>Impressions: " + s.impressions + " · CTR: " + s.ctr + "% · Conv: " + s.conversionRate + "%</p>";
        }
      });
    };

    App.prototype.onAbCreate = function () {
      var out = $(this.root, "[data-cp-output]");
      var base = out ? out.value : "";
      var exp = window.CopyPilot.optimize.createExperiment(this.ctx.productId, [
        { body: base },
        { body: base.replace(/\./g, "!") },
        { body: "🔥 " + base }
      ]);
      var el = $(this.root, "[data-cp-ab-status]");
      if (el) { el.textContent = "Experiment created with " + exp.variants.length + " variants"; }
    };

    App.prototype.onAbPick = function () {
      var winner = window.CopyPilot.optimize.pickWinner(this.ctx.productId);
      var el = $(this.root, "[data-cp-ab-status]");
      if (el && winner) {
        el.textContent = "Winner: " + winner.id + " (conv rate " + (winner.impressions ? (winner.conversions / winner.impressions * 100).toFixed(1) : 0) + "%)";
        var out = $(this.root, "[data-cp-output]");
        if (out) { out.value = winner.body; }
      }
    };

    /* ---- Chat ---- */
    App.prototype.onChatSend = function () {
      var input = $(this.root, "[data-cp-chat-input]");
      var log = $(this.root, "[data-cp-chat-log]");
      if (!input || !input.value.trim() || !window.CopyPilot.chat) { return; }
      var text = input.value.trim();
      input.value = "";
      if (log) {
        var u = document.createElement("div"); u.className = "cp-chat-msg cp-chat-user"; u.textContent = text; log.appendChild(u);
      }
      window.CopyPilot.chat.send(text, this.ctx).then(function (msg) {
        if (log && msg) {
          var a = document.createElement("div"); a.className = "cp-chat-msg cp-chat-bot"; a.textContent = msg.text || msg.reply || ""; log.appendChild(a);
          log.scrollTop = log.scrollHeight;
        }
      });
    };

    /* ---- Plans & Credit Packs UI ---- */
    App.prototype.renderPlans = function () {
      var grid = $(this.root, "[data-cp-plans-grid]");
      if (!grid || !window.CopyPilot.billing) { return; }
      var current = (this.state.credits && this.state.credits.plan_id) || "free";
      var self = this;
      grid.innerHTML = "";
      window.CopyPilot.billing.listPlans().forEach(function (plan) {
        var isCurrent = plan.id === current;
        var card = document.createElement("div");
        card.className = "cp-plan-card" + (plan.badge === "Most Popular" ? " cp-plan-featured" : "") + (isCurrent ? " cp-plan-current" : "");
        var priceHtml = plan.price === 0
          ? '<div class="cp-plan-price">$0<span>/mo</span></div>'
          : '<div class="cp-plan-price">$' + plan.price + "<span>/mo</span></div>";
        var badgeHtml = plan.badge ? '<span class="cp-plan-badge">' + plan.badge + "</span>" : "";
        var feats = (plan.features || []).map(function (f) { return "<li>" + f + "</li>"; }).join("");
        card.innerHTML =
          badgeHtml +
          '<h4 class="cp-plan-name">' + plan.plan_name + "</h4>" +
          priceHtml +
          '<p class="cp-plan-credits">' + plan.monthly_credits + " credits / month</p>" +
          '<p class="cp-plan-tagline">' + plan.tagline + "</p>" +
          "<ul class=\"cp-plan-features\">" + feats + "</ul>" +
          (isCurrent
            ? '<button type="button" class="cp-btn cp-btn-ghost cp-btn-block" disabled>Current plan</button>'
            : '<button type="button" class="cp-btn ' + (plan.price === 0 ? "cp-btn-ghost" : "cp-btn-primary") + ' cp-btn-block" data-cp-action="subscribe" data-cp-plan="' + plan.id + '">' +
              (plan.price === 0 ? "Downgrade to Free" : "Choose " + plan.plan_name) +
              "</button>");
        grid.appendChild(card);
      });
      $all(grid, "[data-cp-action='subscribe']").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self.onBilling(btn.getAttribute("data-cp-plan"));
        });
      });
    };

    App.prototype.renderPacks = function () {
      var grid = $(this.root, "[data-cp-packs-grid]");
      if (!grid || !window.CopyPilot.billing) { return; }
      var self = this;
      grid.innerHTML = "";
      window.CopyPilot.billing.listCreditPacks().forEach(function (pack) {
        var card = document.createElement("div");
        card.className = "cp-pack-card" + (pack.popular ? " cp-plan-featured" : "");
        card.innerHTML =
          (pack.popular ? '<span class="cp-plan-badge">Popular</span>' : "") +
          '<h4 class="cp-plan-name">' + pack.name + "</h4>" +
          '<div class="cp-plan-price">$' + pack.price + "</div>" +
          '<p class="cp-plan-credits">' + pack.credits + " credits · $" + pack.per_credit + "/credit</p>" +
          '<p class="cp-plan-tagline">' + pack.tagline + "</p>" +
          '<button type="button" class="cp-btn cp-btn-secondary cp-btn-block" data-cp-action="buy-credits" data-cp-pack="' + pack.id + '">Buy pack</button>';
        grid.appendChild(card);
      });
      $all(grid, "[data-cp-action='buy-credits']").forEach(function (btn) {
        btn.addEventListener("click", function () {
          self.onBuyCredits(btn.getAttribute("data-cp-pack"));
        });
      });
    };

    /* Hook generate to also run GEO after completion */
    var origGenerate = App.prototype.onGenerate;
    App.prototype.onGenerate = function () {
      var self = this;
      var btn = $(this.root, '[data-cp-action="generate"]');
      var origFinally = null;
      origGenerate.call(this);
      setTimeout(function () {
        if (!$(self.root, "[data-cp-output]") || !$(self.root, "[data-cp-output]").value) { return; }
        self.onGenGeo();
      }, 1200);
    };

    // If app already booted before this file patched init, wire tabs now.
    if (window.CopyPilot._activeApp) {
      try {
        window.CopyPilot._activeApp.initTabs();
        window.CopyPilot._activeApp.initExtraActions();
        if (typeof window.CopyPilot._activeApp.renderPlans === "function") {
          window.CopyPilot._activeApp.renderPlans();
        }
        if (typeof window.CopyPilot._activeApp.renderPacks === "function") {
          window.CopyPilot._activeApp.renderPacks();
        }
      } catch (e) { /* ignore */ }
    }
  });
})();
