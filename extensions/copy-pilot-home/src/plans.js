/**
 * CopyPilot subscription plans + feature gates.
 * Admin Home is the source of truth for plan enforcement.
 * Each AI generation = 1 credit. Bulk of N products = N credits.
 */

export const PLANS = {
  free: {
    id: "free",
    plan_name: "Free",
    price: 0,
    currency: "USD",
    monthly_credits: 10,
    badge: null,
    tagline: "Try it — always free",
    features: [
      "10 AI credits / month",
      "2 languages",
      "SEO + AIDA generation",
      "Publish (title / description / meta / alt)",
      "Image SEO",
    ],
    limits: {
      languages_max: 2,
      bulk: false,
      media_upload: false,
      brand: false,
      publish: true,
      countries_all: false,
    },
  },
  starter: {
    id: "starter",
    plan_name: "Starter",
    price: 19,
    currency: "USD",
    monthly_credits: 50,
    badge: null,
    tagline: "Catalogs up to ~50 SKUs / month",
    features: [
      "50 AI credits / month",
      "6 languages (TR EN ES FR AR ZH)",
      "All countries / markets",
      "Media upload (image/GIF/video)",
      "Brand voice",
      "Publish",
    ],
    limits: {
      languages_max: 6,
      bulk: false,
      media_upload: true,
      brand: true,
      publish: true,
      countries_all: true,
    },
  },
  growth: {
    id: "growth",
    plan_name: "Growth",
    price: 49,
    currency: "USD",
    monthly_credits: 150,
    badge: "Most popular",
    tagline: "Mid-scale + bulk",
    features: [
      "150 AI credits / month",
      "Everything in Starter",
      "Bulk generate + publish",
      "Priority support",
    ],
    limits: {
      languages_max: 6,
      bulk: true,
      media_upload: true,
      brand: true,
      publish: true,
      countries_all: true,
    },
  },
  scale: {
    id: "scale",
    plan_name: "Scale",
    price: 99,
    currency: "USD",
    monthly_credits: 400,
    badge: "Best value",
    tagline: "Agencies and high volume",
    features: [
      "400 AI credits / month",
      "Everything in Growth",
      "High-volume bulk",
      "SLA priority",
    ],
    limits: {
      languages_max: 6,
      bulk: true,
      media_upload: true,
      brand: true,
      publish: true,
      countries_all: true,
    },
  },
};

export const CREDIT_PACKS = [
  { id: "pack_10", name: "Boost 10", credits: 10, price: 9 },
  { id: "pack_30", name: "Boost 30", credits: 30, price: 24 },
  { id: "pack_100", name: "Boost 100", credits: 100, price: 69 },
];

export function planOf(id) {
  return PLANS[id] || PLANS.free;
}

export function languageAllowed(planId, langCode, allLangs) {
  const plan = planOf(planId);
  const max = plan.limits.languages_max || 2;
  if (max >= (allLangs || []).length) return true;
  // Free: TR + EN only
  if (plan.id === "free") return langCode === "tr" || langCode === "en";
  return true;
}

export function canUse(planId, feature) {
  const lim = planOf(planId).limits || {};
  return !!lim[feature];
}
