# Shopify App Store — CopyPilot AI checklist

Developer: **Fixiby Software Technologies** · App: **CopyPilot AI** · Contact: **info@fixiby.com**

Legal pages: `/legal` · Live host: `https://fixiby.vercel.app` · Presentation: `/copypilot_presentation.html`

## 1) Required listing URLs

Partner Dashboard → Distribution → Shopify App Store listing:

| Field | URL |
|------|-----|
| Privacy policy | `https://fixiby.vercel.app/legal/privacy-en.html` |
| TR market notice (KVKK Art. 10/11 EN) | `https://fixiby.vercel.app/legal/privacy-notice-tr-market.html` |
| Terms | `https://fixiby.vercel.app/legal/terms-en.html` |
| Data processing | `https://fixiby.vercel.app/legal/data-processing.html` |
| App / landing | `https://fixiby.vercel.app/` |

All support and privacy email: **info@fixiby.com**

## 2) Mandatory compliance webhooks

Configured in `shopify.app.toml`:

- `customers/data_request`, `customers/redact`, `shop/redact` → `/api/webhooks/compliance`
- `app/uninstalled` → `/api/webhooks/app-uninstalled`

Vercel handlers verify Shopify HMAC; invalid → **401**, valid → **200**.

```bash
# Local compliance host (optional)
set SHOPIFY_API_SECRET=shpss_xxx
npm run compliance

# Trigger test
shopify app webhook trigger --topic customers/data_request
```

Then: `shopify app deploy` so Partner Dashboard picks up TOML webhook URIs.

## 3) application_url / auth

`shopify.app.toml` is set to:

- `application_url = "https://fixiby.vercel.app"`
- Redirects: `https://fixiby.vercel.app/api/auth` and `.../auth/callback`

`LEGAL_BASE_URL` in `extensions/copy-pilot-home/src/legalConfig.js` = `https://fixiby.vercel.app/legal`

## 4) Scopes (least privilege)

`read_products,write_products,read_themes,write_themes`

No customer / order scopes — aligned with privacy docs.

## 5) Billing (source of truth: `plans.js`)

| Plan | Price | Monthly credits | Highlights |
|------|-------|-----------------|------------|
| Free | $0 | 10 | TR+EN, SEO+AIDA, publish, Image SEO |
| Starter | $19 | 50 | 6 langs, media, brand |
| Growth | $49 | 150 | + bulk (Most popular) |
| Scale | $99 | 400 | High-volume (Best value) |
| Packs | $9 / $24 / $69 | 10 / 30 / 100 | One-time Boost packs |

Rule: **1 generation = 1 credit**; bulk of N = N credits.

**Listing paste pack:** see `docs/APP_STORE_LISTING.md`  
**Screenshots / PDF:** `docs/app-store-screenshots/` + `docs/CopyPilot-App-Store-Presentation.pdf`  
Regenerate: `node docs/make-app-store-assets.cjs`

## 6) In-app Help

Admin Help tab links via `legalUrl()` to privacy, terms, and TR-market notice.

## 7) Security QA

```bash
npm run qa
npm run qa:security
npm run qa:compliance
```

Never ship client secrets in theme JS.

## 8) Review briefing

Use `https://fixiby.vercel.app/presentation` (or `/copypilot_presentation.html`) for App Store reviewers.

## 9) Counsel note

These pages cover Shopify process and GDPR/CCPA/KVKK-oriented disclosures. Formal DPAs for enterprise merchants: info@fixiby.com.
