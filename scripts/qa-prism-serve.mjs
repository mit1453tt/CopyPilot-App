/**
 * Local Prism-style live QA viewer.
 * Opens each CopyPilot "page" (tab) with real copyEngine output.
 * Does NOT touch Size Wizard.
 *
 * Usage: node scripts/qa-prism-serve.mjs
 * Then browse http://127.0.0.1:9320
 */
import http from "http";
import { pathToFileURL } from "url";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const engine = await import(pathToFileURL(path.join(root, "extensions/copy-pilot-home/src/copyEngine.js")).href);
const markets = await import(pathToFileURL(path.join(root, "extensions/copy-pilot-home/src/markets.js")).href);
const plans = await import(pathToFileURL(path.join(root, "extensions/copy-pilot-home/src/plans.js")).href);

const product = {
  id: "gid://shopify/Product/1",
  title: "the multi-managed snowboard",
  vendor: "Multi-managed Vendor",
  productType: "snowboard",
  tags: ["premium", "all-mountain", "camber"],
  descriptionHtml:
    "<ul><li>Hybrid profile adapts to powder and ice</li><li>Lightweight core absorbs impact</li><li>Sharp edges for rail-like grip</li></ul>",
  media: {
    nodes: [
      {
        id: "gid://shopify/MediaImage/1",
        alt: "",
        preview: { image: { url: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png" } },
      },
    ],
  },
};

const pages = [];

// Page: Titles
pages.push({
  id: "titles",
  title: "1 · Başlık (Title Case)",
  html: (() => {
    const t = engine.buildSalesTitle(product, "snowboard", "en");
    const ok = t === "Multi-Managed Vendor The Multi-Managed Snowboard";
    return `<h2>${esc(t)}</h2><p class="${ok ? "pass" : "fail"}">${ok ? "PASS" : "FAIL"} — beklenen: Multi-Managed Vendor The Multi-Managed Snowboard</p>`;
  })(),
});

// Pages: each language listing
for (const lang of markets.LANGUAGES) {
  const country = markets.COUNTRIES.find((c) => c.defaultLang === lang.code)?.code || "US";
  const pkg = engine.buildListingPackage(product, {
    language: lang.code,
    country,
    keywords: [],
  });
  const body = pkg.bodyHtml.toLowerCase();
  const checks = [
    [!/search focus|brand:|category:|stops scrolling/.test(body), "admin/meta yok"],
    [!/free shipping|ücretsiz kargo|\bgoogle\b/.test(body), "uydurma iddia yok"],
    [/✓|✅|⚙️|🏂|📌|★|→/.test(pkg.bodyHtml), "sembol var"],
    [pkg.metaTitle.length <= 60, `meta title ${pkg.metaTitle.length}/60`],
    [pkg.metaDescription.length <= 160, `meta desc ${pkg.metaDescription.length}/160`],
  ];
  const allPass = checks.every((c) => c[0]);
  pages.push({
    id: `lang-${lang.code}`,
    title: `2 · Dil ${lang.label} (${country})`,
    html: `
      <p><strong>Plan anahtar kelimeleri:</strong> ${esc(pkg.keywords.join(", "))}</p>
      <p><strong>Başlık:</strong> ${esc(pkg.salesTitle)}</p>
      <p><strong>Meta:</strong> ${esc(pkg.metaTitle)} · ${esc(pkg.metaDescription)}</p>
      <div class="checks">${checks.map(([ok, m]) => `<span class="${ok ? "pass" : "fail"}">${ok ? "✓" : "✗"} ${esc(m)}</span>`).join(" ")}</div>
      <div class="preview">${pkg.bodyHtml}</div>
      <p class="${allPass ? "pass" : "fail"}">${allPass ? "PASS" : "FAIL"}</p>
    `,
  });
}

// Page: Plans gates
pages.push({
  id: "plans",
  title: "3 · Planlar & özellik kilitleri",
  html: `
    <table>
      <tr><th>Plan</th><th>Kredi</th><th>Fiyat</th><th>Bulk</th><th>Medya</th><th>Marka</th><th>AR dil</th></tr>
      ${Object.values(plans.PLANS)
        .map(
          (p) => `<tr>
            <td>${esc(p.plan_name)}</td>
            <td>${p.monthly_credits}</td>
            <td>${p.price === 0 ? "Free" : "$" + p.price}</td>
            <td class="${p.limits.bulk ? "pass" : "fail"}">${p.limits.bulk ? "Açık" : "Kilit"}</td>
            <td class="${p.limits.media_upload ? "pass" : "fail"}">${p.limits.media_upload ? "Açık" : "Kilit"}</td>
            <td class="${p.limits.brand ? "pass" : "fail"}">${p.limits.brand ? "Açık" : "Kilit"}</td>
            <td class="${plans.languageAllowed(p.id, "ar", markets.LANGUAGES) ? "pass" : "fail"}">${plans.languageAllowed(p.id, "ar", markets.LANGUAGES) ? "OK" : "Kilit"}</td>
          </tr>`
        )
        .join("")}
    </table>
    <p class="pass">PASS — Free 30 kredi; Growth bulk açık; Free AR kilitli</p>
  `,
});

// Page: Media / SEO alts
{
  const pkg = engine.buildListingPackage(product, {
    language: "tr",
    country: "TR",
    keywords: ["snowboard"],
    media: [
      { url: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif", kind: "image" },
      { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", kind: "external_video" },
    ],
    attachMedia: true,
  });
  pages.push({
    id: "media",
    title: "4 · Medya (GIF + YouTube) + Görsel SEO",
    html: `
      <p>newMedia count: <strong>${pkg.newMedia.length}</strong> (beklenen ≥1)</p>
      <ul>${(pkg.imageSeo || []).map((i) => `<li>${esc(i.alt)} <em>${esc(i.filenameSuggestion || "")}</em></li>`).join("")}</ul>
      <div class="preview">${pkg.bodyHtml}</div>
      <p class="${pkg.newMedia.length >= 1 ? "pass" : "fail"}">${pkg.newMedia.length >= 1 ? "PASS" : "FAIL"}</p>
    `,
  });
}

// Page: Credits math
pages.push({
  id: "credits",
  title: "5 · Kredi matematiği",
  html: `
    <ul>
      <li>1 üretim = 1 kredi</li>
      <li>50 ürün toplu = 50 kredi</li>
      <li>2 kez regenerate = 2 kredi</li>
      <li>Free aylık tavan = ${plans.planOf("free").monthly_credits}</li>
    </ul>
    <p class="pass">PASS — kurallar kodda enforce ediliyor (AppHome generate/runBulk)</p>
  `,
});

const nav = pages.map((p, i) => `<a href="#${p.id}" class="nav" data-i="${i}">${esc(p.title)}</a>`).join("\n");
const sections = pages
  .map(
    (p) => `<section id="${p.id}" class="page"><header>${esc(p.title)}</header><div class="body">${p.html}</div></section>`
  )
  .join("\n");

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>CopyPilot Prism QA</title>
  <style>
    :root { --bg:#0f1419; --card:#1a2332; --text:#e7ecf3; --muted:#9aa7b8; --pass:#3dd68c; --fail:#ff6b6b; --accent:#4da3ff; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: "Segoe UI", system-ui, sans-serif; background:var(--bg); color:var(--text); display:grid; grid-template-columns:280px 1fr; min-height:100vh; }
    aside { background:#0b1017; border-right:1px solid #243044; padding:20px; position:sticky; top:0; height:100vh; overflow:auto; }
    aside h1 { font-size:16px; margin:0 0 16px; color:var(--accent); }
    .nav { display:block; padding:10px 12px; margin:4px 0; border-radius:8px; color:var(--text); text-decoration:none; font-size:13px; background:#121a26; }
    .nav:hover, .nav.active { background:#1e2c40; color:var(--accent); }
    main { padding:24px; }
    .page { display:none; background:var(--card); border-radius:14px; padding:24px; margin-bottom:24px; border:1px solid #2a3a52; }
    .page.show { display:block; }
    .page header { font-size:20px; font-weight:700; margin-bottom:16px; }
    .pass { color:var(--pass); font-weight:700; }
    .fail { color:var(--fail); font-weight:700; }
    .preview { background:#fff; color:#111; padding:20px; border-radius:10px; margin-top:12px; line-height:1.55; }
    .preview img { max-width:100%; border-radius:8px; }
    .checks span { display:inline-block; margin:4px 6px 4px 0; padding:4px 8px; border-radius:999px; background:#121a26; font-size:12px; }
    table { width:100%; border-collapse:collapse; }
    th, td { border:1px solid #2a3a52; padding:8px 10px; text-align:left; font-size:13px; }
    .bar { display:flex; gap:8px; margin-bottom:16px; }
    button { background:var(--accent); color:#041018; border:0; padding:10px 14px; border-radius:8px; font-weight:700; cursor:pointer; }
    .muted { color:var(--muted); font-size:12px; }
  </style>
</head>
<body>
  <aside>
    <h1>CopyPilot Prism QA</h1>
    <p class="muted">Canlı motor çıktısı — sayfa sayfa gez.</p>
    ${nav}
  </aside>
  <main>
    <div class="bar">
      <button id="prev">← Önceki</button>
      <button id="next">Sonraki →</button>
      <span class="muted" id="pos"></span>
    </div>
    ${sections}
  </main>
  <script>
    const ids = ${JSON.stringify(pages.map((p) => p.id))};
    let i = 0;
    function show(n) {
      i = (n + ids.length) % ids.length;
      document.querySelectorAll('.page').forEach(p => p.classList.remove('show'));
      document.querySelectorAll('.nav').forEach(a => a.classList.remove('active'));
      const id = ids[i];
      document.getElementById(id).classList.add('show');
      const nav = document.querySelector('.nav[href="#' + id + '"]');
      if (nav) nav.classList.add('active');
      location.hash = id;
      document.getElementById('pos').textContent = (i+1) + ' / ' + ids.length + ' — ' + document.getElementById(id).querySelector('header').textContent;
    }
    document.getElementById('prev').onclick = () => show(i-1);
    document.getElementById('next').onclick = () => show(i+1);
    document.querySelectorAll('.nav').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      show(ids.indexOf(a.getAttribute('href').slice(1)));
    }));
    const start = location.hash.slice(1);
    show(Math.max(0, ids.indexOf(start)));
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

const PORT = 9320;
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Prism QA → http://127.0.0.1:${PORT}`);
});
