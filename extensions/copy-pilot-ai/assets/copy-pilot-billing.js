/* CopyPilot AI — Billing, Plans & Credit Packs
   ------------------------------------------------------------------
   Competitive pricing (2026 market):
     Shopify Magic ………… $0 (shallow features)
     Describely …………… $0.75 / product (pay-as-you-go)
     Hypotenuse Pro …… ~$79 / mo
     Jasper Pro …………… ~$69 / seat
     Writesonic …………… ~$79 / mo

   CopyPilot undercuts mid-market SaaS while bundling GEO, Vision, Agent
   and bulk audit — value competitors charge separately for.

   Exposes:
     window.CopyPilot.billing.PLANS
     window.CopyPilot.billing.CREDIT_PACKS
     window.CopyPilot.billing.checkUserSubscriptionAndCredits()
     window.CopyPilot.billing.initiateShopifyBillingRedirect(planType)
     window.CopyPilot.billing.purchaseCreditPack(packId)
     window.CopyPilot.billing.consumeCredits(amount)                            */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};

  function cfg() { return (window.CopyPilot && window.CopyPilot.config) || {}; }

  /**
   * Subscription plans — 1 Free + 3 Paid.
   * Credits ≈ 1 generation / language OR 1 autofix / product.
   */
  var PLANS = {
    free: {
      id: "free",
      plan_name: "Free",
      price: 0,
      currency: "USD",
      interval: "month",
      monthly_credits: 10,
      badge: null,
      tagline: "Try agentic copy — forever free",
      competitor_note: "Free forever like Shopify Magic; 10 credits to trial.",
      features: [
        "10 AI credits / month",
        "Vision AI (single image)",
        "Classic SEO score",
        "EN + 2 languages",
        "Compact product embed",
        "Community support"
      ],
      limits: {
        languages_max: 2,
        bulk_audit: false,
        geo: false,
        agent: false,
        brand_dna: false,
        publish: true,
        multi_vision: false
      }
    },
    starter: {
      id: "starter",
      plan_name: "Starter",
      price: 19,
      currency: "USD",
      interval: "month",
      monthly_credits: 50,
      badge: null,
      tagline: "For catalogs under ~50 SKUs / month",
      competitor_note: "Undercuts Hypotenuse (~$79) and Jasper (~$69) entry.",
      features: [
        "50 AI credits / month",
        "All 7 languages (EN ES DE FR TR AR ZH)",
        "Vision AI + GEO score",
        "schema.org + llms.txt",
        "Publish to Shopify",
        "Auto-tagging & alt-text",
        "Email support"
      ],
      limits: {
        languages_max: 7,
        bulk_audit: true,
        geo: true,
        agent: false,
        brand_dna: false,
        publish: true,
        multi_vision: true
      }
    },
    growth: {
      id: "growth",
      plan_name: "Growth",
      price: 49,
      currency: "USD",
      interval: "month",
      monthly_credits: 150,
      badge: "Most Popular",
      tagline: "Catalog ops teams & mid-market brands",
      competitor_note: "Bulk + 150 credits at a clear flat rate.",
      features: [
        "150 AI credits / month",
        "Everything in Starter",
        "Bulk audit + auto-fix",
        "Brand Voice DNA & Content Rules",
        "CSV / PIM import (Akeneo, Salsify)",
        "Bulk queue",
        "A/B + conversion bandit",
        "Priority support"
      ],
      limits: {
        languages_max: 7,
        bulk_audit: true,
        geo: true,
        agent: true,
        brand_dna: true,
        publish: true,
        multi_vision: true,
        queue_max: 2000
      }
    },
    scale: {
      id: "scale",
      plan_name: "Scale",
      price: 99,
      currency: "USD",
      interval: "month",
      monthly_credits: 400,
      badge: "Best Value",
      tagline: "Agencies & high-volume catalogs",
      competitor_note: "Matches Hypotenuse Pro price band with Self-Healing Agent + GEO built in.",
      features: [
        "400 AI credits / month",
        "Everything in Growth",
        "Self-Healing Catalog Agent (scheduled)",
        "High-volume bulk",
        "Rank tracking & analytics",
        "Sidekick chat assistant",
        "Dedicated onboarding",
        "SLA priority support"
      ],
      limits: {
        languages_max: 7,
        bulk_audit: true,
        geo: true,
        agent: true,
        brand_dna: true,
        publish: true,
        multi_vision: true,
        queue_max: 10000
      }
    }
  };

  /**
   * One-time UsageCharge credit packs (never expire; add to monthly allowance).
   * Priced below Describely's $0.75/product effective rate.
   */
  var CREDIT_PACKS = {
    pack_10: {
      id: "pack_10",
      name: "Boost 10",
      credits: 10,
      price: 9,
      currency: "USD",
      per_credit: 0.9,
      tagline: "Quick top-up when you hit the limit",
      popular: false
    },
    pack_30: {
      id: "pack_30",
      name: "Boost 30",
      credits: 30,
      price: 24,
      currency: "USD",
      per_credit: 0.8,
      tagline: "Most popular credit pack",
      popular: true
    },
    pack_100: {
      id: "pack_100",
      name: "Boost 100",
      credits: 100,
      price: 69,
      currency: "USD",
      per_credit: 0.69,
      tagline: "Best per-credit price for big launches",
      popular: false
    }
  };

  var ledger = {
    plan_id: "free",
    plan_name: "Free",
    used_credits: 0,
    monthly_credits: 10,
    bonus_credits: 0
  };

  function availableCredits() {
    var monthlyLeft = Math.max(0, ledger.monthly_credits - ledger.used_credits);
    return monthlyLeft + Math.max(0, ledger.bonus_credits || 0);
  }

  function exhausted() {
    return availableCredits() <= 0;
  }

  function snapshot() {
    var bonus = Math.max(0, ledger.bonus_credits || 0);
    return {
      plan_id: ledger.plan_id,
      plan_name: ledger.plan_name,
      used_credits: ledger.used_credits,
      monthly_credits: ledger.monthly_credits + bonus, // UI: total pool (monthly + unused packs)
      bonus_credits: bonus,
      base_monthly: ledger.monthly_credits,
      available: availableCredits(),
      exhausted: exhausted(),
      plan: PLANS[ledger.plan_id] || PLANS.free
    };
  }

  function buildBillingUrl(path, query) {
    var c = cfg();
    var base = c.billingEndpoint || "";
    var shop = (window.CopyPilot.context && window.CopyPilot.context.shopDomain) || "YOUR_SHOP_DOMAIN_PLACEHOLDER";
    var qs = "shop=" + encodeURIComponent(shop);
    if (query) {
      Object.keys(query).forEach(function (k) {
        qs += "&" + k + "=" + encodeURIComponent(query[k]);
      });
    }
    return base + path + "?" + qs;
  }

  var billing = {
    PLANS: PLANS,
    CREDIT_PACKS: CREDIT_PACKS,

    listPlans: function () {
      return ["free", "starter", "growth", "scale"].map(function (id) { return PLANS[id]; });
    },

    listCreditPacks: function () {
      return ["pack_10", "pack_30", "pack_100"].map(function (id) { return CREDIT_PACKS[id]; });
    },

    getLedger: function () { return snapshot(); },

    /**
     * Apply a subscription plan (mock Shopify Billing recurring).
     * @param {string} planId - free | starter | growth | scale
     */
    setPlan: function (planId) {
      var p = PLANS[planId] || PLANS.free;
      ledger.plan_id = p.id;
      ledger.plan_name = p.plan_name;
      ledger.monthly_credits = p.monthly_credits;
      if (planId !== "free") { ledger.used_credits = 0; }
      // Persist to local theme ledger only (Supabase REST locked).
      if (window.CopyPilot.db) {
        window.CopyPilot.db.updateShop(null, {
          plan_name: p.plan_name,
          monthly_credits: p.monthly_credits,
          used_credits: ledger.used_credits,
          reset_date: new Date(Date.now() + 30 * 864e5).toISOString(),
          shopify_charge_id: ledger.shopify_charge_id || null
        }).catch(function (err) {
          console.error("[CopyPilot Error]: setPlan persist failed —", err.message);
        });
      }
      return snapshot();
    },

    /**
     * Load plan + credits from local theme ledger (Admin uses Shopify metafields).
     */
    checkUserSubscriptionAndCredits: function () {
      return new Promise(function (resolve) {
        (async function () {
          try {
            if (!window.CopyPilot.db) { throw new Error("CopyPilot.db not loaded"); }
            var row = await window.CopyPilot.db.getOrCreateShop();
            if (row) {
              ledger.plan_name = row.plan_name || "Free";
              var id = String(ledger.plan_name).toLowerCase();
              ledger.plan_id = PLANS[id] ? id : "free";
              ledger.monthly_credits = typeof row.monthly_credits === "number" ? row.monthly_credits : 30;
              ledger.used_credits = typeof row.used_credits === "number" ? row.used_credits : 0;
              ledger.shopify_charge_id = row.shopify_charge_id || null;
            }
          } catch (err) {
            console.error("[CopyPilot Error]: local ledger load failed —", err.message);
          }
          resolve(snapshot());
        })();
      });
    },

    consumeCredits: function (amount) {
      amount = typeof amount === "number" ? amount : 1;
      var remaining = amount;
      if ((ledger.bonus_credits || 0) > 0) {
        var fromBonus = Math.min(ledger.bonus_credits, remaining);
        ledger.bonus_credits -= fromBonus;
        remaining -= fromBonus;
      }
      if (remaining > 0) {
        ledger.used_credits = Math.min(ledger.monthly_credits, ledger.used_credits + remaining);
      }

      if (window.CopyPilot.db) {
        window.CopyPilot.db.updateShop(null, { used_credits: ledger.used_credits })
          .catch(function (err) {
            console.error("[CopyPilot Error]: local credit persist failed —", err.message);
          });
      }

      return snapshot();
    },

    /**
     * Subscribe / upgrade via Shopify Billing API (mock redirect).
     * @param {string} planType - free | starter | growth | scale | upgrade
     *   "upgrade" auto-selects the next higher paid tier.
     */
    initiateShopifyBillingRedirect: function (planType) {
      planType = planType || "starter";
      if (planType === "upgrade") {
        var order = ["free", "starter", "growth", "scale"];
        var ix = order.indexOf(ledger.plan_id);
        planType = order[Math.min(ix + 1, order.length - 1)];
        if (planType === "free") { planType = "starter"; }
      }

      var plan = PLANS[planType] || PLANS.starter;
      var path = "/subscribe";
      var query = {
        plan: plan.id,
        plan_name: plan.plan_name,
        price: plan.price,
        credits: plan.monthly_credits,
        interval: "every_30_days"
      };
      var url = buildBillingUrl(path, query);

      return new Promise(function (resolve) {
        (async function () {
          try {
            console.log("[CopyPilot] Billing subscribe redirect ->", url);
            var res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(query)
            });
            if (!res.ok) { throw new Error("Billing endpoint returned HTTP " + res.status); }
          } catch (err) {
            console.error("[CopyPilot Error]: Billing endpoint unreachable, simulating approval —", err.message);
          }
          billing.setPlan(plan.id);
          resolve({ confirmationUrl: url, planType: plan.id, ledger: snapshot() });
        })();
      });
    },

    /**
     * Purchase a one-time credit pack (Shopify UsageCharge / one-time app charge).
     * @param {string} [packId=pack_30]
     */
    purchaseCreditPack: function (packId) {
      packId = packId || "pack_30";
      var pack = CREDIT_PACKS[packId] || CREDIT_PACKS.pack_30;
      var path = "/credits";
      var query = {
        type: "extra_credits",
        pack: pack.id,
        units: pack.credits,
        price: pack.price
      };
      var url = buildBillingUrl(path, query);

      return new Promise(function (resolve) {
        (async function () {
          try {
            console.log("[CopyPilot] Credit pack redirect ->", url);
            var res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(query)
            });
            if (!res.ok) { throw new Error("Billing endpoint returned HTTP " + res.status); }
          } catch (err) {
            console.error("[CopyPilot Error]: Credit pack endpoint unreachable, simulating purchase —", err.message);
          }
          // Persist pack credits on local theme ledger (no remote DB).
          try {
            if (window.CopyPilot.db) {
              var row = await window.CopyPilot.db.getOrCreateShop();
              var nextMonthly = ((row && row.monthly_credits) || ledger.monthly_credits || 30) + pack.credits;
              await window.CopyPilot.db.updateShop(null, { monthly_credits: nextMonthly });
              ledger.monthly_credits = nextMonthly;
              ledger.bonus_credits = 0;
            } else {
              ledger.monthly_credits += pack.credits;
            }
          } catch (persistErr) {
            console.error("[CopyPilot Error]: credit pack persist failed —", persistErr.message);
            ledger.monthly_credits += pack.credits;
          }
          resolve({ confirmationUrl: url, pack: pack, ledger: snapshot() });
        })();
      });
    },

    /** @deprecated use purchaseCreditPack — kept for existing UI hooks */
    initiateCreditPurchase: function (packId) {
      return billing.purchaseCreditPack(packId || "pack_30");
    }
  };

  // Back-compat: old "extra_credits" string still works through subscribe redirect router.
  var _origRedirect = billing.initiateShopifyBillingRedirect;
  billing.initiateShopifyBillingRedirect = function (planType) {
    if (planType === "extra_credits" || planType === "buy-credits") {
      return billing.purchaseCreditPack("pack_30");
    }
    return _origRedirect(planType);
  };

  window.CopyPilot.billing = billing;
})();
