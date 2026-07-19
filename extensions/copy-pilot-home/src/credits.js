/**
 * Credit + plan state persisted in shop metafield copypilot.credits (JSON).
 * Shape: {
 *   used:number, total:number, planId:string, bonus:number,
 *   period:string (YYYY-MM UTC), appliedPurchases:string[]
 * }
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

export function currentPeriodKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function defaultsFromPlan(planId) {
  const p = planOf(planId || DEFAULT_PLAN);
  return {
    used: 0,
    total: p.monthly_credits,
    planId: p.id,
    bonus: 0,
    period: currentPeriodKey(),
    appliedPurchases: [],
  };
}

function normalizeState(parsed, fallbackPlanId) {
  const state = defaultsFromPlan(fallbackPlanId || DEFAULT_PLAN);
  if (!parsed || typeof parsed !== "object") return state;

  if (typeof parsed.planId === "string" && planOf(parsed.planId)) state.planId = parsed.planId;
  if (typeof parsed.bonus === "number") state.bonus = parsed.bonus;
  if (Array.isArray(parsed.appliedPurchases)) {
    state.appliedPurchases = parsed.appliedPurchases.filter((id) => typeof id === "string");
  }

  const period = typeof parsed.period === "string" ? parsed.period : null;
  const nowPeriod = currentPeriodKey();
  if (period && period !== nowPeriod) {
    // New billing month: reset usage, keep bonus packs and plan.
    state.used = 0;
    state.period = nowPeriod;
  } else {
    state.period = period || nowPeriod;
    if (typeof parsed.used === "number") state.used = parsed.used;
  }

  const planCredits = planOf(state.planId).monthly_credits;
  state.total = planCredits + (state.bonus || 0);
  return state;
}

export async function readCredits() {
  try {
    const r = await shopify.query(READ);
    const shop = r?.data?.shop;
    const shopId = shop?.id || null;
    let state = defaultsFromPlan(DEFAULT_PLAN);
    const v = shop?.metafield?.value;
    if (v) {
      try {
        state = normalizeState(JSON.parse(v), DEFAULT_PLAN);
      } catch {
        state = defaultsFromPlan(DEFAULT_PLAN);
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
    period: state.period || currentPeriodKey(),
    appliedPurchases: Array.isArray(state.appliedPurchases) ? state.appliedPurchases : [],
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
