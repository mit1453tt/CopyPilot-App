/**
 * Export App Store presentation PDF + PNG screenshots from HTML decks.
 * Run: node docs/make-app-store-assets.cjs
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(__dirname, "app-store-screenshots");
const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function fileUrl(p) {
  return "file:///" + p.replace(/\\/g, "/");
}

async function exportDeck(browser, htmlPath, pdfPath, pngPrefix) {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 2,
  });
  await page.goto(fileUrl(htmlPath), { waitUntil: "networkidle" });

  await page.pdf({
    path: pdfPath,
    width: "1280px",
    height: "720px",
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  console.log("PDF", pdfPath);

  const slides = page.locator("section.slide");
  const count = await slides.count();
  for (let i = 0; i < count; i++) {
    const slide = slides.nth(i);
    await slide.scrollIntoViewIfNeeded();
    const out = path.join(OUT_DIR, `${pngPrefix}-slide-${String(i + 1).padStart(2, "0")}.png`);
    await slide.screenshot({ path: out, type: "png" });
    console.log("PNG", out);
  }
  await page.close();
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    headless: true,
  });

  await exportDeck(
    browser,
    path.join(ROOT, "copypilot_presentation.html"),
    path.join(__dirname, "CopyPilot-App-Store-Presentation.pdf"),
    "app-store"
  );

  await exportDeck(
    browser,
    path.join(__dirname, "CopyPilot-Kisisel-Deneme-Sunumu.html"),
    path.join(__dirname, "CopyPilot-Kisisel-Deneme-Sunumu.pdf"),
    "personal"
  );

  await browser.close();
  console.log("ALL_ASSETS_OK");
})().catch((err) => {
  console.error("ASSET_FAIL", err);
  process.exit(1);
});
