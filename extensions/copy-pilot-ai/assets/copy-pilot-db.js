/* CopyPilot AI — secure shop/history client
   Remote Supabase REST is LOCKED (RLS + no anon grants).
   Production credits/plans live in Shopify Admin metafields (copy-pilot-home).
   Theme extension keeps an in-memory / localStorage ledger only. */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};

  var STORAGE_KEY = "copypilot_theme_ledger_v1";

  function shopDomain() {
    var ctx = window.CopyPilot.context || {};
    return ctx.shopDomain || "local-dev.myshopify.com";
  }

  function nextResetDate() {
    var d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  }

  function readLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function writeLocal(row) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(row));
    } catch (e) { /* private mode */ }
    return row;
  }

  function defaultShop(domain) {
    return {
      shop_domain: domain || shopDomain(),
      plan_name: "Free",
      monthly_credits: 10,
      used_credits: 0,
      shopify_charge_id: null,
      reset_date: nextResetDate()
    };
  }

  var db = {
    /** Local-only get-or-create (no remote network). */
    getOrCreateShop: function (domain) {
      domain = domain || shopDomain();
      return Promise.resolve().then(function () {
        var all = readLocal() || {};
        if (all[domain]) return all[domain];
        var row = defaultShop(domain);
        all[domain] = row;
        writeLocal(all);
        return row;
      });
    },

    /** Local-only patch. */
    updateShop: function (domain, patch) {
      domain = domain || shopDomain();
      return db.getOrCreateShop(domain).then(function (row) {
        var next = Object.assign({}, row, patch || {}, { shop_domain: domain });
        var all = readLocal() || {};
        all[domain] = next;
        writeLocal(all);
        return next;
      });
    },

    /** Local history buffer (last 50). Not sent to Supabase. */
    insertHistory: function (record) {
      return Promise.resolve().then(function () {
        var all = readLocal() || {};
        var histKey = "__history__";
        var list = Array.isArray(all[histKey]) ? all[histKey] : [];
        list.unshift({
          id: String(Date.now()),
          shop_domain: (record && record.shop_domain) || shopDomain(),
          product_id: String((record && record.product_id) || ""),
          original_title: (record && record.original_title) || null,
          generated_description: (record && record.generated_description) || null,
          seo_score: typeof (record && record.seo_score) === "number" ? record.seo_score : null,
          created_at: new Date().toISOString()
        });
        all[histKey] = list.slice(0, 50);
        writeLocal(all);
        return list[0];
      });
    }
  };

  window.CopyPilot.db = db;
})();
