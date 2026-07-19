/**
 * Credit + plan state persisted in shop metafield copypilot.credits (JSON).
 * Shape: { used:number, total:number, planId:string, bonus:number }
 */

import { planOf } from "./plans.js";

const DEFAULT_PLAN = "free";

const READ = `#graphql
  query CopyPilotCredits {
    shop {
      id
      metafield(namespace: "copypilot", key: "credits") {
        value
      }
    }
  }
`;

const WRITE = `#graphql
  mutation CopyPilotCreditsSet($mf: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $mf) {
      userErrors { field message }
    }
  }
`;

function defaultsFromPlan(planId) {
  const p = planOf(planId || DEFAULT_PLAN);
  return {
    used: 0,
    total: p.monthly_credits,
    planId: p.id,
    bonus: 0,
  };
}

export async function readCredits() {
  try {
    const r = await shopify.query(READ);
    const shop = r?.data?.shop;
    const shopId = shop?.id || null;
    let state = defaultsFromPlan(DEFAULT_PLAN);
    const v = shop?.metafield?.value;
    if (v) {
      const parsed = JSON.parse(v);
      if (typeof parsed.used === "number") state.used = parsed.used;
      if (typeof parsed.planId === "string" && planOf(parsed.planId)) state.planId = parsed.planId;
      if (typeof parsed.bonus === "number") state.bonus = parsed.bonus;
      const planCredits = planOf(state.planId).monthly_credits;
      state.total = planCredits + (state.bonus || 0);
      if (typeof parsed.total === "number" && parsed.total > state.total) {
        // Keep larger total only if it includes bonus packs already baked in.
        state.total = parsed.total;
      } else {
        state.total = planCredits + (state.bonus || 0);
      }
    }
    return { shopId, ...state };
  } catch (e) {
    return { shopId: null, ...defaultsFromPlan(DEFAULT_PLAN) };
  }
}

export async function saveCredits(shopId, state) {
  if (!shopId) return;
  const planCredits = planOf(state.planId).monthly_credits;
  const bonus = state.bonus || 0;
  const payload = {
    used: state.used || 0,
    planId: state.planId || DEFAULT_PLAN,
    bonus,
    total: planCredits + bonus,
  };
  try {
    await shopify.query(WRITE, {
      variables: {
        mf: [
          {
            ownerId: shopId,
            namespace: "copypilot",
            key: "credits",
            type: "json",
            value: JSON.stringify(payload),
          },
        ],
      },
    });
  } catch (e) {
    /* best effort */
  }
}

export function creditsLeft(state) {
  return Math.max(0, (state.total || 0) - (state.used || 0));
}
