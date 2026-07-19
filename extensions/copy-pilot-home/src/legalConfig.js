/**
 * Public origin for legal pages (privacy, terms, data processing).
 * Deployed on Vercel: https://fixiby.vercel.app
 */
export const LEGAL_BASE_URL = "https://fixiby.vercel.app/legal";

export const LEGAL_PATHS = {
  index: "/index.html",
  privacyEn: "/privacy-en.html",
  privacyTr: "/privacy-en.html",
  kvkk: "/privacy-notice-tr-market.html",
  termsEn: "/terms-en.html",
  termsTr: "/terms-en.html",
  dataProcessing: "/data-processing.html",
};

export const COMPANY = {
  name: "Fixiby Software Technologies",
  shortName: "Fixiby",
  appName: "CopyPilot AI",
  domain: "fixiby.com",
  site: "https://fixiby.vercel.app",
  email: "info@fixiby.com",
};

export function legalUrl(key) {
  const path = LEGAL_PATHS[key] || LEGAL_PATHS.index;
  return `${LEGAL_BASE_URL}${path}`;
}
