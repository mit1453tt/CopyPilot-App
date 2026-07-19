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

function returnUrl() {
  // Merchant lands back in Admin App Home after approving the charge.
  try {
    return String(shopify?.environment?.myshopifyDomain
      ? `https://admin.shopify.com/store/${String(shopify.environment.myshopifyDomain).replace(".myshopify.com", "")}/apps`
      : "https://admin.shopify.com/");
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
    const active = subs.find((s) => s.status === "ACTIVE") || subs[0];
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
export async function startPlanCheckout(planId, { test = true } = {}) {
  const plan = planOf(planId);
  if (!plan || plan.id === "free" || plan.price <= 0) {
    return { free: true, planId: "free" };
  }

  const data = await gql(SUB_CREATE, {
    name: `CopyPilot ${plan.plan_name}`,
    returnUrl: returnUrl(),
    test: !!test,
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
  return { confirmationUrl: payload.confirmationUrl, planId: plan.id };
}

export async function startCreditPackCheckout(packId, { test = true } = {}) {
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) throw new Error("Bilinmeyen paket");

  const data = await gql(PURCHASE_CREATE, {
    name: `CopyPilot ${pack.name}`,
    returnUrl: returnUrl(),
    test: !!test,
    price: { amount: pack.price, currencyCode: "USD" },
  });

  const payload = data?.appPurchaseOneTimeCreate;
  const errs = payload?.userErrors || [];
  if (errs.length) throw new Error(errs.map((e) => e.message).join("; "));
  if (!payload?.confirmationUrl) throw new Error("Shopify confirmationUrl alınamadı.");
  return { confirmationUrl: payload.confirmationUrl, pack };
}
