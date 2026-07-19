const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const html = path.resolve(__dirname, "CopyPilot-Kisisel-Deneme-Sunumu.html");
  const pdf = path.resolve(__dirname, "CopyPilot-Kisisel-Deneme-Sunumu.pdf");
  const browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto("file:///" + html.replace(/\\/g, "/"), { waitUntil: "networkidle" });
  await page.pdf({
    path: pdf,
    landscape: true,
    format: "A4",
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  await browser.close();
  console.log("PDF_OK", pdf);
})().catch((err) => {
  console.error("PDF_FAIL", err.message);
  process.exit(1);
});
