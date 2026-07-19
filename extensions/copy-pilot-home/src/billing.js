/**
 * Shopify Billing (App Subscription + one-time packs) via Admin Direct API.
 * confirmationUrl must be opened by the merchant to complete payment.
 */

import { planOf, CREDIT_PACKS } from "./plans.js";

const SUB_CREATE = `#graphql
  mutation CopyPilotSubCreate(
    $name: String!
    $returnUrl: URL!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $test: Boolean
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      lineItems: $lineItems
      test: $test
      trialDays: 0
    ) {
      appSubscription { id status }
      confirmationUrl
      userErrors { field message }
    }
  }
`;

const PURCHASE_CREATE = `#graphql
  mutation CopyPilotPurchaseCreate(
    $name: String!
    $returnUrl: URL!
    $price: MoneyInput!
    $test: Boolean
  ) {
    appPurchaseOneTimeCreate(
      name: $name
      returnUrl: $returnUrl
      price: $price
      test: $test
    ) {
      appPurchaseOneTime { id status }
      confirmationUrl
      userErrors { field message }
    }
  }
`;

const ACTIVE_SUBS = `#graphql
  query CopyPilotActiveSubs {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        test
        lineItems {
          plan {
            pricingDetails {
              ... on AppRecurringPricing {
                price { amount currencyCode }
                interval
              }
            }
          }
        }
      }
    }
  }
`;

const ONE_TIME_PURCHASES = `#graphql
  query CopyPilotOneTimePurchases {
    currentAppInstallation {
      oneTimePurchases(first: 25, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            status
            createdAt
          }
        }
      }
    }
  }
`;

export const PENDING_PACK_KEY = "copypilot_pending_pack";

/** Test charges only in Shopify development / explicitly requested. */
export function isBillingTestMode(explicit) {
  if (typeof explicit === "boolean") return explicit;
  try {
    if (typeof shopify !== "undefined" && shopify.environment?.development === true) {
      return true;
    }
  } catch (e) {
    /* ignore */
  }
  return false;
}

function returnUrl() {
  try {
    return String(
      shopify?.environment?.myshopifyDomain
        ? `https://admin.shopify.com/store/${String(shopify.environment.myshopifyDomain).replace(".myshopify.com", "")}/apps`
        : "https://admin.shopify.com/"
    );
  } catch (e) {
    return "https://admin.shopify.com/";
  }
}

async function gql(query, variables) {
  const result = await shopify.query(query, { variables });
  if (result?.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join("; "));
  }
  return result?.data;
}

/** Map active Shopify subscription name → local plan id. */
export async function detectActivePlanId() {
  try {
    const data = await gql(ACTIVE_SUBS, {});
    const subs = data?.currentAppInstallation?.activeSubscriptions || [];
    const active = subs.find((s) => s.status === "ACTIVE") || null;
    if (!active) return "free";
    const name = String(active.name || "").toLowerCase();
    if (name.includes("scale")) return "scale";
    if (name.includes("growth")) return "growth";
    if (name.includes("starter")) return "starter";
    return "free";
  } catch (e) {
    return null; // unknown — caller keeps metafield plan
  }
}

/**
 * Start a recurring plan charge. Opens Shopify confirmation URL.
 * Free plan: no charge, just activate locally.
 */
export async function startPlanCheckout(planId, opts = {}) {
  const test = isBillingTestMode(opts.test);
  const plan = planOf(planId);
  if (!plan || plan.id === "free" || plan.price <= 0) {
    return { free: true, planId: "free" };
  }

  const data = await gql(SUB_CREATE, {
    name: `CopyPilot ${plan.plan_name}`,
    returnUrl: returnUrl(),
    test,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: { amount: plan.price, currencyCode: plan.currency || "USD" },
            interval: "EVERY_30_DAYS",
          },
        },
      },
    ],
  });

  const payload = data?.appSubscriptionCreate;
  const errs = payload?.userErrors || [];
  if (errs.length) throw new Error(errs.map((e) => e.message).join("; "));
  if (!payload?.confirmationUrl) throw new Error("Shopify confirmationUrl alınamadı.");
  return {
    confirmationUrl: payload.confirmationUrl,
    planId: plan.id,
    subscriptionId: payload.appSubscription?.id || null,
    test,
  };
}

export async function startCreditPackCheckout(packId, opts = {}) {
  const test = isBillingTestMode(opts.test);
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) throw new Error("Bilinmeyen paket");

  const data = await gql(PURCHASE_CREATE, {
    name: `CopyPilot ${pack.name}`,
    returnUrl: returnUrl(),
    test,
    price: { amount: pack.price, currencyCode: "USD" },
  });

  const payload = data?.appPurchaseOneTimeCreate;
  const errs = payload?.userErrors || [];
  if (errs.length) throw new Error(errs.map((e) => e.message).join("; "));
  if (!payload?.confirmationUrl) throw new Error("Shopify confirmationUrl alınamadı.");
  return {
    confirmationUrl: payload.confirmationUrl,
    pack,
    purchaseId: payload.appPurchaseOneTime?.id || null,
    test,
  };
}

/** Active one-time purchases (paid credit packs). */
export async function listAcceptedOneTimePurchases() {
  try {
    const data = await gql(ONE_TIME_PURCHASES, {});
    const edges = data?.currentAppInstallation?.oneTimePurchases?.edges || [];
    return edges
      .map((e) => e.node)
      .filter((n) => n && String(n.status).toUpperCase() === "ACTIVE");
  } catch (e) {
    return [];
  }
}

/**
 * Grant bonus credits for any ACTIVE one-time purchases not yet applied.
 * Returns { bonusAdded, nextBonus, appliedPurchases, grantedPacks }.
 */
export async function reconcileCreditPacks(appliedPurchases = []) {
  const applied = new Set(appliedPurchases || []);
  const purchases = await listAcceptedOneTimePurchases();
  let bonusAdded = 0;
  const grantedPacks = [];
  const nextApplied = [...applied];

  for (const purchase of purchases) {
    if (applied.has(purchase.id)) continue;
    const name = String(purchase.name || "").toLowerCase();
    const pack = CREDIT_PACKS.find((p) => name.includes(String(p.name).toLowerCase()));
    if (!pack) continue;
    bonusAdded += pack.credits;
    grantedPacks.push(pack);
    nextApplied.push(purchase.id);
  }

  return {
    bonusAdded,
    grantedPacks,
    appliedPurchases: nextApplied,
  };
}

export function rememberPendingPack(packId) {
  try {
    sessionStorage.setItem(PENDING_PACK_KEY, packId);
  } catch (e) {
    /* ignore */
  }
}

export function consumePendingPack() {
  try {
    const id = sessionStorage.getItem(PENDING_PACK_KEY);
    sessionStorage.removeItem(PENDING_PACK_KEY);
    return id;
  } catch (e) {
    return null;
  }
}
