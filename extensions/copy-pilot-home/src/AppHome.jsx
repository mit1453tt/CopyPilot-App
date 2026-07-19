import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { buildListingPackage, analyzeSeo, analyzeGeo, suggestKeywords, detectMediaKind } from "./copyEngine.js";
import { fetchProducts, publishListing } from "./api.js";
import { LANGUAGES, COUNTRIES, marketFor } from "./markets.js";
import { readCredits, saveCredits } from "./credits.js";
import { PLANS, CREDIT_PACKS, planOf, canUse, languageAllowed } from "./plans.js";
import {
  startPlanCheckout,
  startCreditPackCheckout,
  detectActivePlanId,
  reconcileCreditPacks,
  rememberPendingPack,
} from "./billing.js";
import { uiFor, tabsFor, planCopy } from "./uiI18n.js";
import { legalUrl } from "./legalConfig.js";

export default async () => {
  render(<App />, document.body);
};

function App() {
  const [tab, setTab] = useState("generate");

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState("");

  const [country, setCountry] = useState("TR");
  const [lang, setLang] = useState("tr");
  const [customKw, setCustomKw] = useState("");
  const [kwSuggestions, setKwSuggestions] = useState([]);
  const [selectedKw, setSelectedKw] = useState({});

  const [creditShopId, setCreditShopId] = useState(null);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [creditsTotal, setCreditsTotal] = useState(10);
  const [bonusCredits, setBonusCredits] = useState(0);
  const [planId, setPlanId] = useState("free");
  const [appliedPurchases, setAppliedPurchases] = useState([]);
  const [creditPeriod, setCreditPeriod] = useState(null);
  const plan = planOf(planId);
  const ui = uiFor(lang);
  const tabs = tabsFor(lang);

  const [brandVendor, setBrandVendor] = useState("");
  const [tone, setTone] = useState("professional");

  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaList, setMediaList] = useState([]);
  const [attachMedia, setAttachMedia] = useState(true);

  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);

  const [checked, setChecked] = useState({});
  const [bulkLog, setBulkLog] = useState([]);

  async function load(q) {
    setLoading(true);
    setError("");
    try {
      const list = await fetchProducts({ first: 50, search: q || "" });
      setProducts(list);
      if (list.length && !selectedId) setSelectedId(list[0].id);
    } catch (e) {
      setError(e.message || ui.loadFailed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("");
    (async () => {
      const c = await readCredits();
      setCreditShopId(c.shopId);
      let used = c.used;
      let bonus = c.bonus || 0;
      let appliedPurchasesNext = c.appliedPurchases || [];
      let pid = c.planId || "free";
      const period = c.period;

      const detected = await detectActivePlanId();
      if (detected) pid = detected;

      // Apply paid credit packs only after Shopify marks the purchase ACTIVE.
      try {
        const recon = await reconcileCreditPacks(appliedPurchasesNext);
        if (recon.bonusAdded > 0) {
          bonus += recon.bonusAdded;
          appliedPurchasesNext = recon.appliedPurchases;
          setBanner({
            tone: "success",
            heading: "Credit pack applied",
            text: `Added ${recon.bonusAdded} credits from: ${recon.grantedPacks.map((p) => p.name).join(", ")}.`,
          });
        }
      } catch (e) {
        /* non-fatal */
      }

      const total = planOf(pid).monthly_credits + bonus;
      setCreditsUsed(used);
      setBonusCredits(bonus);
      setPlanId(pid);
      setCreditsTotal(total);
      setAppliedPurchases(appliedPurchasesNext);
      setCreditPeriod(period);

      if (c.shopId) {
        saveCredits(c.shopId, {
          used,
          planId: pid,
          bonus,
          period,
          appliedPurchases: appliedPurchasesNext,
        });
      }
    })();
  }, []);

  const creditsLeft = Math.max(0, creditsTotal - creditsUsed);

  function persistState(next) {
    saveCredits(creditShopId, {
      used: next.used,
      planId: next.planId,
      bonus: next.bonus,
      period: next.period || creditPeriod,
      appliedPurchases: next.appliedPurchases || appliedPurchases,
    });
  }

  function consumeCredits(n) {
    const nextUsed = creditsUsed + n;
    setCreditsUsed(nextUsed);
    persistState({ used: nextUsed, planId, bonus: bonusCredits });
  }

  function activatePlanLocally(nextPlanId, extraBonus) {
    const p = planOf(nextPlanId);
    const bonus = typeof extraBonus === "number" ? extraBonus : bonusCredits;
    const total = p.monthly_credits + bonus;
    setPlanId(p.id);
    setBonusCredits(bonus);
    setCreditsTotal(total);
    persistState({ used: creditsUsed, planId: p.id, bonus });
  }

  function onCountry(code) {
    setCountry(code);
    const m = marketFor(code);
    if (m?.defaultLang) {
      const next = m.defaultLang;
      if (languageAllowed(planId, next, LANGUAGES)) setLang(next);
    }
  }

  const selected = products.find((p) => p.id === selectedId) || null;

  useEffect(() => {
    if (selected) {
      try {
        setKwSuggestions(suggestKeywords(selected, country, lang));
        setSelectedKw({});
      } catch (e) {
        setKwSuggestions([]);
      }
    }
  }, [selectedId, country, lang, products]);

  function effectiveKeywords() {
    const custom = String(customKw || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const chosen = kwSuggestions.filter((k) => selectedKw[k]);
    let kws = [...custom, ...chosen];
    if (!kws.length) kws = kwSuggestions.slice(0, 3);
    return Array.from(new Set(kws.map((k) => k.toLowerCase())));
  }

  function makePackage(product) {
    const prod = brandVendor && canUse(planId, "brand")
      ? { ...product, vendor: brandVendor }
      : product;
    return buildListingPackage(prod, {
      language: lang,
      country,
      keywords: effectiveKeywords(),
      tone,
      media: canUse(planId, "media_upload") ? mediaList : [],
      attachMedia: canUse(planId, "media_upload") && attachMedia,
    });
  }

  function addMedia() {
    if (!canUse(planId, "media_upload")) {
      setError(ui.errMediaPlan);
      setTab("plans");
      return;
    }
    const url = String(mediaUrl || "").trim();
    if (!url) return;
    setMediaList([...mediaList, { url, kind: detectMediaKind(url), alt: "" }]);
    setMediaUrl("");
  }
  function removeMedia(i) {
    setMediaList(mediaList.filter((_, idx) => idx !== i));
  }

  function generate() {
    if (!selected) return;
    if (!languageAllowed(planId, lang, LANGUAGES)) {
      setError(ui.errLangPlan(lang.toUpperCase(), plan.plan_name));
      return;
    }
    if (creditsLeft < 1) {
      setError(ui.errCredits);
      setTab("plans");
      return;
    }
    setBusy("generate");
    setBanner(null);
    setError("");
    try {
      consumeCredits(1);
      setDraft(makePackage(selected));
      setBanner({
        tone: "success",
        heading: ui.previewReadyHeading,
        text: ui.previewReadyBody,
      });
    } catch (e) {
      setError(e.message || ui.genError);
    } finally {
      setBusy("");
    }
  }

  async function approve(pkg) {
    const payload = pkg || draft;
    if (!payload) return;
    if (!canUse(planId, "publish")) {
      setError(ui.errPublishPlan);
      return;
    }
    setBusy("publish");
    setError("");
    setBanner(null);
    try {
      const result = await publishListing(payload);
      const added = result.newMediaCount ? ui.mediaAdded(result.newMediaCount) : "";
      setBanner({
        tone: "success",
        heading: ui.publishedHeading,
        text: ui.publishedBody(result.imageCount, added),
      });
      await load(search);
      setDraft(null);
    } catch (e) {
      setError(e.message || ui.publishFailed);
    } finally {
      setBusy("");
    }
  }

  async function runBulk() {
    if (!canUse(planId, "bulk")) {
      setError(ui.errBulkPlan);
      setTab("plans");
      return;
    }
    const ids = Object.keys(checked).filter((k) => checked[k]);
    if (!ids.length) {
      setError(ui.errBulkNone);
      return;
    }
    if (creditsLeft < ids.length) {
      setError(ui.errBulkCredits(ids.length, creditsLeft));
      setTab("plans");
      return;
    }
    setBusy("bulk");
    setError("");
    const log = [];
    let used = creditsUsed;
    for (const id of ids) {
      const product = products.find((p) => p.id === id);
      if (!product) continue;
      used += 1;
      setCreditsUsed(used);
      persistState({ used, planId, bonus: bonusCredits });
      try {
        const pkg = makePackage(product);
        const res = await publishListing(pkg);
        log.push({ title: product.title, ok: true, images: res.imageCount });
      } catch (e) {
        log.push({ title: product.title, ok: false, msg: e.message });
      }
      setBulkLog(log.slice());
    }
    await load(search);
    setBusy("");
    setBanner({
      tone: "success",
      heading: ui.bulkDoneHeading,
      text: ui.bulkDoneBody(log.filter((l) => l.ok).length, log.length, ids.length),
    });
  }

  function openTab(id) {
    if (id === "bulk" && !canUse(planId, "bulk")) {
      setError(ui.errBulkTab);
      setTab("plans");
      return;
    }
    if (id === "media" && !canUse(planId, "media_upload")) {
      setError(ui.errMediaTab);
      setTab("plans");
      return;
    }
    if (id === "brand" && !canUse(planId, "brand")) {
      setError(ui.errBrandTab);
      setTab("plans");
      return;
    }
    setError("");
    setTab(id);
  }

  return (
    <s-page heading={ui.pageTitle}>
      <s-banner heading={ui.introHeading} tone="info">
        {ui.introBody}
      </s-banner>

      <s-banner
        tone={creditsLeft > 0 ? "info" : "critical"}
        heading={ui.planCreditsHeading(plan.plan_name, creditsUsed, creditsTotal, creditsLeft)}
      >
        {ui.planCreditsBody}
      </s-banner>

      {banner ? (
        <s-banner heading={banner.heading} tone={banner.tone}>
          {banner.text}
        </s-banner>
      ) : null}
      {error ? (
        <s-banner heading={ui.errorHeading} tone="critical">
          {error}
        </s-banner>
      ) : null}

      <s-section>
        <s-stack direction="inline" gap="small">
          {tabs.map((t) => (
            <s-button
              key={t.id}
              variant={tab === t.id ? "primary" : "secondary"}
              onClick={() => openTab(t.id)}
            >
              {t.label}
            </s-button>
          ))}
        </s-stack>
      </s-section>

      <s-section heading={ui.targeting}>
        <s-stack direction="inline" gap="base">
          <s-select label={ui.country} value={country} onChange={(e) => onCountry(e.currentTarget.value)}>
            {COUNTRIES.map((c) => (
              <s-option key={c.code} value={c.code}>
                {c.label}
              </s-option>
            ))}
          </s-select>
          <s-select label={ui.language} value={lang} onChange={(e) => {
            const next = e.currentTarget.value;
            if (!languageAllowed(planId, next, LANGUAGES)) {
              setError(ui.errLangPlan(next.toUpperCase(), plan.plan_name));
              setTab("plans");
              return;
            }
            setError("");
            setLang(next);
          }}>
            {LANGUAGES.map((l) => (
              <s-option
                key={l.code}
                value={l.code}
                disabled={!languageAllowed(planId, l.code, LANGUAGES) || undefined}
              >
                {l.label}{languageAllowed(planId, l.code, LANGUAGES) ? "" : ` (${ui.locked})`}
              </s-option>
            ))}
          </s-select>
          <s-text-field
            label={ui.customKw}
            value={customKw}
            placeholder={ui.customKwPh}
            onChange={(e) => setCustomKw(e.currentTarget.value)}
          />
        </s-stack>
        {kwSuggestions.length ? (
          <s-stack direction="block" gap="small">
            <s-text tone="neutral">{ui.kwHint(marketFor(country).label)}</s-text>
            <s-stack direction="inline" gap="small">
              {kwSuggestions.map((k) => (
                <s-button
                  key={k}
                  variant={selectedKw[k] ? "primary" : "secondary"}
                  onClick={() => setSelectedKw({ ...selectedKw, [k]: !selectedKw[k] })}
                >
                  {selectedKw[k] ? "✓ " : ""}{k}
                </s-button>
              ))}
            </s-stack>
            <s-text tone="neutral">
              {ui.kwUsing} {effectiveKeywords().join(", ") || "—"}
            </s-text>
          </s-stack>
        ) : null}
      </s-section>

      {tab === "generate" ? (
        <GenerateTab
          ui={ui}
          products={products}
          loading={loading}
          search={search}
          setSearch={setSearch}
          load={load}
          selected={selected}
          setSelectedId={setSelectedId}
          setDraft={setDraft}
          draft={draft}
          generate={generate}
          approve={approve}
          busy={busy}
        />
      ) : null}

      {tab === "seo" ? <SeoTab ui={ui} draft={draft} generate={generate} selected={selected} /> : null}

      {tab === "media" ? (
        <UploadTab
          ui={ui}
          mediaUrl={mediaUrl}
          setMediaUrl={setMediaUrl}
          mediaList={mediaList}
          addMedia={addMedia}
          removeMedia={removeMedia}
          attachMedia={attachMedia}
          setAttachMedia={setAttachMedia}
        />
      ) : null}

      {tab === "images" ? <MediaTab ui={ui} draft={draft} setDraft={setDraft} approve={approve} busy={busy} /> : null}

      {tab === "brand" ? (
        <BrandTab
          ui={ui}
          brandVendor={brandVendor}
          setBrandVendor={setBrandVendor}
          tone={tone}
          setTone={setTone}
          selected={selected}
          planId={planId}
        />
      ) : null}

      {tab === "bulk" ? (
        <BulkTab
          ui={ui}
          products={products}
          checked={checked}
          setChecked={setChecked}
          runBulk={runBulk}
          busy={busy}
          bulkLog={bulkLog}
        />
      ) : null}

      {tab === "plans" ? (
        <PlansTab
          ui={ui}
          lang={lang}
          planId={planId}
          creditsUsed={creditsUsed}
          creditsTotal={creditsTotal}
          creditsLeft={creditsLeft}
          activatePlanLocally={activatePlanLocally}
          setBanner={setBanner}
          setError={setError}
          setBusy={setBusy}
          busy={busy}
          bonusCredits={bonusCredits}
          setBonusCredits={setBonusCredits}
          setCreditsTotal={setCreditsTotal}
          persistState={persistState}
        />
      ) : null}
      {tab === "assistant" ? <AssistantTab ui={ui} lang={lang} /> : null}
    </s-page>
  );
}

function GenerateTab(props) {
  const { ui, products, loading, search, setSearch, load, selected, setSelectedId, setDraft, draft, generate, approve, busy } = props;
  return (
    <>
      <s-section heading={ui.controls}>
        <s-stack direction="inline" gap="base">
          <s-text-field label={ui.searchProducts} value={search} placeholder={ui.searchPh} onChange={(e) => setSearch(e.currentTarget.value)} />
          <s-button onClick={() => load(search)} disabled={loading}>{ui.search}</s-button>
          <s-button variant="primary" onClick={generate} disabled={!selected || busy === "generate"} loading={busy === "generate"}>
            {ui.generate}
          </s-button>
          <s-button tone="success" variant="primary" onClick={() => approve()} disabled={!draft || busy === "publish"} loading={busy === "publish"}>
            {ui.approvePublish}
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading={ui.products(products.length)}>
        {loading ? (
          <s-spinner accessibilityLabel={ui.loading} />
        ) : products.length === 0 ? (
          <s-paragraph>{ui.noProducts}</s-paragraph>
        ) : (
          <s-stack direction="block" gap="small">
            {products.map((p) => (
              <ProductRow key={p.id} ui={ui} p={p} active={p.id === selected?.id} onSelect={() => { setSelectedId(p.id); setDraft(null); }} />
            ))}
          </s-stack>
        )}
      </s-section>

      {selected ? (
        <s-section heading={ui.selectedCurrent}>
          <s-stack direction="block" gap="base">
            <s-text type="strong">{selected.title}</s-text>
            <s-text tone="neutral">{ui.brandLabel} {selected.vendor || "—"} · {ui.typeLabel} {selected.productType || "—"}</s-text>
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-text>{cleanPreview(selected.descriptionHtml) || ui.noDescription}</s-text>
            </s-box>
          </s-stack>
        </s-section>
      ) : null}

      {draft ? <DraftPreview ui={ui} draft={draft} setDraft={setDraft} approve={approve} busy={busy} /> : null}
    </>
  );
}

function ProductRow({ ui, p, active, onSelect }) {
  const thumb = p.featuredMedia?.preview?.image?.url || p.media?.nodes?.[0]?.preview?.image?.url || "";
  return (
    <s-box padding="base" border="base" borderRadius="base" background={active ? "subdued" : "transparent"}>
      <s-stack direction="inline" gap="base" alignItems="center">
        {thumb ? <s-thumbnail src={thumb} alt={p.title} size="small" /> : <s-thumbnail size="small" />}
        <s-stack direction="block" gap="none">
          <s-text type="strong">{p.title}</s-text>
          <s-text tone="neutral">{[p.vendor, p.productType, p.status].filter(Boolean).join(" · ")}</s-text>
        </s-stack>
        <s-button variant={active ? "primary" : "secondary"} onClick={onSelect}>{ui.select}</s-button>
      </s-stack>
    </s-box>
  );
}

function DraftPreview({ ui, draft, setDraft, approve, busy }) {
  return (
    <s-section heading={ui.previewHeading}>
      <s-stack direction="block" gap="base">
        <s-text-field label={ui.salesTitle} value={draft.salesTitle} onChange={(e) => setDraft({ ...draft, salesTitle: e.currentTarget.value })} />
        <s-text-field label={ui.metaTitle} value={draft.metaTitle} onChange={(e) => setDraft({ ...draft, metaTitle: e.currentTarget.value })} />
        <s-text-area label={ui.metaDesc} value={draft.metaDescription} rows={3} onChange={(e) => setDraft({ ...draft, metaDescription: e.currentTarget.value })} />
        <s-text-area label={ui.bodyHtml} value={draft.bodyHtml} rows={14} onChange={(e) => setDraft({ ...draft, bodyHtml: e.currentTarget.value })} />
        <s-button tone="success" variant="primary" onClick={() => approve(draft)} disabled={busy === "publish"} loading={busy === "publish"}>
          {ui.approveSafe}
        </s-button>
      </s-stack>
    </s-section>
  );
}

function SeoTab({ ui, draft, generate, selected }) {
  if (!draft) {
    return (
      <s-section heading={ui.tabs.seo}>
        <s-paragraph>{ui.seoNeedDraft}</s-paragraph>
        {selected ? <s-button variant="primary" onClick={generate}>{ui.generateNow}</s-button> : null}
      </s-section>
    );
  }
  const seo = analyzeSeo(draft);
  const geo = analyzeGeo(draft);
  return (
    <s-stack direction="block" gap="large">
      <s-section heading={ui.seoScore(seo.score)}>
        <s-stack direction="block" gap="base">
          <s-banner tone={seo.score >= 80 ? "success" : seo.score >= 50 ? "warning" : "critical"} heading={ui.scoreLabel(seo.score)}>
            {ui.keywordCoverage(seo.keywordCoverage)}
          </s-banner>
          <s-text type="strong">{ui.tips}</s-text>
          <s-unordered-list>
            {seo.tips.map((t, i) => <s-list-item key={`seo-${i}`}>{t}</s-list-item>)}
          </s-unordered-list>
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="none">
              <s-text tone="neutral">{ui.metaTitleLen} {draft.metaTitle.length}/60</s-text>
              <s-text tone="neutral">{ui.metaDescLen} {draft.metaDescription.length}/160</s-text>
              <s-text tone="neutral">{ui.words} {(draft.keywords || [draft.keyword]).join(", ")} · {draft.country} · {draft.language}</s-text>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading={ui.geoScore(geo.score)}>
        <s-stack direction="block" gap="base">
          <s-paragraph>{ui.geoIntro}</s-paragraph>
          <s-banner tone={geo.score >= 80 ? "success" : geo.score >= 50 ? "warning" : "critical"} heading={ui.geoLabel(geo.label)}>
            {ui.geoScoreLine(geo.score)}
          </s-banner>
          <s-text type="strong">{ui.geoTips}</s-text>
          <s-unordered-list>
            {geo.tips.map((t, i) => <s-list-item key={`geo-${i}`}>{t}</s-list-item>)}
          </s-unordered-list>
        </s-stack>
      </s-section>
    </s-stack>
  );
}

function UploadTab({ ui, mediaUrl, setMediaUrl, mediaList, addMedia, removeMedia, attachMedia, setAttachMedia }) {
  const kindLabel = { image: ui.kindImage, external_video: ui.kindExternal, video: ui.kindVideo };
  return (
    <s-section heading={ui.uploadHeading}>
      <s-stack direction="block" gap="base">
        <s-paragraph>{ui.uploadBody}</s-paragraph>
        <s-stack direction="inline" gap="base" alignItems="end">
          <s-text-field
            label={ui.mediaUrl}
            value={mediaUrl}
            placeholder="https://…"
            onChange={(e) => setMediaUrl(e.currentTarget.value)}
          />
          <s-button variant="primary" onClick={addMedia}>{ui.add}</s-button>
        </s-stack>
        <s-checkbox checked={attachMedia} onChange={(e) => setAttachMedia(e.currentTarget.checked)}>
          {ui.attachOnPublish}
        </s-checkbox>
        {mediaList.length === 0 ? (
          <s-paragraph>{ui.noMediaYet}</s-paragraph>
        ) : (
          <s-stack direction="block" gap="small">
            {mediaList.map((m, i) => (
              <s-box key={i} padding="small" border="base" borderRadius="base">
                <s-stack direction="inline" gap="base" alignItems="center">
                  {m.kind === "image" ? <s-thumbnail src={m.url} alt="" size="small" /> : null}
                  <s-stack direction="block" gap="none">
                    <s-text type="strong">{kindLabel[m.kind] || ui.mediaGeneric}</s-text>
                    <s-text tone="neutral">{m.url}</s-text>
                    {m.kind === "video" ? (
                      <s-text tone="critical">{ui.videoFileWarn}</s-text>
                    ) : null}
                  </s-stack>
                  <s-button variant="tertiary" tone="critical" onClick={() => removeMedia(i)}>{ui.remove}</s-button>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        )}
        <s-text tone="neutral">{ui.thenGenerate}</s-text>
      </s-stack>
    </s-section>
  );
}

function MediaTab({ ui, draft, setDraft, approve, busy }) {
  if (!draft) {
    return (
      <s-section heading={ui.imageSeo}>
        <s-paragraph>{ui.imageSeoNeed}</s-paragraph>
      </s-section>
    );
  }
  return (
    <s-section heading={ui.imageSeoAlt}>
      <s-stack direction="block" gap="base">
        <s-paragraph>{ui.imageSeoHint}</s-paragraph>
        {(draft.imageSeo || []).length === 0 ? <s-paragraph>{ui.noImages}</s-paragraph> : null}
        {(draft.imageSeo || []).map((img, idx) => (
          <s-box key={img.id || idx} padding="small" background="subdued" borderRadius="base">
            <s-stack direction="inline" gap="base" alignItems="center">
              {img.url ? <s-thumbnail src={img.url} alt={img.alt} size="small" /> : null}
              <s-stack direction="block" gap="none">
                <s-text-field
                  label={ui.altN(idx + 1)}
                  value={img.alt}
                  onChange={(e) => {
                    const next = draft.imageSeo.slice();
                    next[idx] = { ...next[idx], alt: e.currentTarget.value };
                    setDraft({ ...draft, imageSeo: next });
                  }}
                />
                <s-text tone="neutral">{ui.fileSuggest} {img.filenameSuggestion}</s-text>
              </s-stack>
            </s-stack>
          </s-box>
        ))}
        <s-button tone="success" variant="primary" onClick={() => approve(draft)} disabled={busy === "publish"} loading={busy === "publish"}>
          {ui.approvePublish}
        </s-button>
      </s-stack>
    </s-section>
  );
}

function BrandTab({ ui, brandVendor, setBrandVendor, tone, setTone, selected, planId }) {
  const locked = !canUse(planId || "free", "brand");
  return (
    <s-section heading={ui.brandVoice}>
      <s-stack direction="block" gap="base">
        {locked ? (
          <s-banner tone="warning" heading={ui.lockedHeading}>
            {ui.brandLocked}
          </s-banner>
        ) : null}
        <s-paragraph>{ui.brandBody}</s-paragraph>
        <s-text-field
          label={ui.brandName}
          value={brandVendor}
          placeholder={selected?.vendor || ui.brandPh}
          disabled={locked}
          onChange={(e) => setBrandVendor(e.currentTarget.value)}
        />
        <s-select label={ui.tone} value={tone} disabled={locked} onChange={(e) => setTone(e.currentTarget.value)}>
          <s-option value="professional">{ui.toneProfessional}</s-option>
          <s-option value="friendly">{ui.toneFriendly}</s-option>
          <s-option value="luxury">{ui.toneLuxury}</s-option>
          <s-option value="energetic">{ui.toneEnergetic}</s-option>
        </s-select>
        <s-text tone="neutral">{ui.noFakeClaims}</s-text>
      </s-stack>
    </s-section>
  );
}

function BulkTab({ ui, products, checked, setChecked, runBulk, busy, bulkLog }) {
  return (
    <s-section heading={ui.bulkHeading}>
      <s-stack direction="block" gap="base">
        <s-paragraph>{ui.bulkBody}</s-paragraph>
        <s-button variant="primary" tone="success" onClick={runBulk} loading={busy === "bulk"} disabled={busy === "bulk"}>
          {ui.bulkRun}
        </s-button>
        <s-stack direction="block" gap="small">
          {products.map((p) => (
            <s-box key={p.id} padding="small" border="base" borderRadius="base">
              <s-stack direction="inline" gap="base" alignItems="center">
                <s-checkbox
                  checked={!!checked[p.id]}
                  onChange={(e) => setChecked({ ...checked, [p.id]: e.currentTarget.checked })}
                >
                  {p.title}
                </s-checkbox>
              </s-stack>
            </s-box>
          ))}
        </s-stack>
        {bulkLog.length ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="none">
              {bulkLog.map((l, i) => (
                <s-text key={i} tone={l.ok ? "success" : "critical"}>
                  {l.ok ? "✓" : "✗"} {l.title} {l.ok ? ui.imagesCount(l.images) : `— ${l.msg}`}
                </s-text>
              ))}
            </s-stack>
          </s-box>
        ) : null}
      </s-stack>
    </s-section>
  );
}

function PlansTab(props) {
  const {
    ui, lang, planId, creditsUsed, creditsTotal, creditsLeft,
    activatePlanLocally, setBanner, setError, setBusy, busy,
    bonusCredits, setBonusCredits, setCreditsTotal, persistState,
  } = props;

  async function choosePlan(nextId) {
    setBusy("billing");
    setError("");
    try {
      const res = await startPlanCheckout(nextId);
      if (res.free) {
        activatePlanLocally("free");
        setBanner({ tone: "success", heading: ui.freeActiveHeading, text: ui.freeActiveBody });
        return;
      }
      if (res.confirmationUrl) {
        // Do not activate paid plan until Shopify subscription is ACTIVE (reconciled on reload).
        setBanner({
          tone: "warning",
          heading: ui.billingConfirmHeading,
          text: ui.billingConfirmBody(res.confirmationUrl),
        });
        try {
          if (typeof shopify !== "undefined" && shopify.navigation?.navigate) {
            shopify.navigation.navigate(res.confirmationUrl);
          } else {
            window.top.location.href = res.confirmationUrl;
          }
        } catch (navErr) {
          setError(ui.openConfirmUrl(res.confirmationUrl));
        }
      }
    } catch (e) {
      setError(ui.billingLocalFallback(e.message));
    } finally {
      setBusy("");
    }
  }

  async function buyPack(packId) {
    setBusy("billing");
    setError("");
    try {
      const res = await startCreditPackCheckout(packId);
      const pack = res.pack;
      // Credits are granted only after the one-time purchase is ACTIVE (see reconcile on load).
      rememberPendingPack(pack.id);
      setBanner({
        tone: "warning",
        heading: ui.packConfirmHeading,
        text: ui.packConfirmBody(pack.name, pack.credits, res.confirmationUrl),
      });
      try {
        if (typeof shopify !== "undefined" && shopify.navigation?.navigate) {
          shopify.navigation.navigate(res.confirmationUrl);
        } else {
          window.top.location.href = res.confirmationUrl;
        }
      } catch (navErr) {
        setError(ui.openConfirmUrl(res.confirmationUrl));
      }
    } catch (e) {
      setError(ui.packError(e.message));
    } finally {
      setBusy("");
    }
  }

  return (
    <s-section heading={ui.plansHeading}>
      <s-stack direction="block" gap="base">
        <s-banner tone="info" heading={ui.activePlan(planOf(planId).plan_name)}>
          {ui.creditsUsedLine(creditsUsed, creditsTotal, creditsLeft)} {ui.plansBanner}
        </s-banner>

        {Object.values(PLANS).map((p) => {
          const copy = planCopy(p.id, lang);
          return (
            <s-box key={p.id} padding="base" border="base" borderRadius="base" background={p.id === planId ? "subdued" : "transparent"}>
              <s-stack direction="block" gap="small">
                <s-stack direction="inline" gap="base" alignItems="center">
                  <s-text type="strong">{p.plan_name}{copy.badge ? ` · ${copy.badge}` : ""}</s-text>
                  <s-text tone="neutral">
                    {p.price === 0 ? ui.freeCreditsLine(p.monthly_credits) : ui.perMonth(p.price, p.monthly_credits)}
                  </s-text>
                </s-stack>
                <s-text tone="neutral">{copy.tagline}</s-text>
                <s-unordered-list>
                  {copy.features.map((f, i) => <s-list-item key={i}>{f}</s-list-item>)}
                </s-unordered-list>
                <s-button
                  variant={p.id === planId ? "secondary" : "primary"}
                  disabled={p.id === planId || busy === "billing"}
                  loading={busy === "billing"}
                  onClick={() => choosePlan(p.id)}
                >
                  {p.id === planId ? ui.activePlanBtn : p.price === 0 ? ui.switchFree : ui.subscribeTest}
                </s-button>
              </s-stack>
            </s-box>
          );
        })}

        <s-text type="strong">{ui.creditPacks}</s-text>
        <s-stack direction="inline" gap="base">
          {CREDIT_PACKS.map((pack) => (
            <s-button key={pack.id} onClick={() => buyPack(pack.id)} disabled={busy === "billing"}>
              {pack.name} · ${pack.price} (+{pack.credits})
            </s-button>
          ))}
        </s-stack>
        <s-paragraph>{ui.billingNote}</s-paragraph>
      </s-stack>
    </s-section>
  );
}

function AssistantTab({ ui, lang }) {
  const privacy = lang === "tr" ? legalUrl("privacyTr") : legalUrl("privacyEn");
  const terms = lang === "tr" ? legalUrl("termsTr") : legalUrl("termsEn");
  return (
    <>
      <s-section heading={ui.help}>
        <s-unordered-list>
          {ui.helpItems.map((item, i) => (
            <s-list-item key={i}>{item}</s-list-item>
          ))}
        </s-unordered-list>
      </s-section>
      <s-section heading={ui.legalHeading}>
        <s-stack direction="block" gap="small">
          <s-paragraph>{ui.legalNote}</s-paragraph>
          <s-link href={privacy} target="_blank">{ui.legalPrivacy}</s-link>
          <s-link href={legalUrl("kvkk")} target="_blank">{ui.legalKvkk}</s-link>
          <s-link href={terms} target="_blank">{ui.legalTerms}</s-link>
          <s-link href={legalUrl("dataProcessing")} target="_blank">{ui.legalData}</s-link>
          <s-link href={legalUrl("index")} target="_blank">{ui.legalIndex}</s-link>
        </s-stack>
      </s-section>
    </>
  );
}

function cleanPreview(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280);
}
