/* CopyPilot AI — Shared utilities */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};

  function cfg() { return (window.CopyPilot && window.CopyPilot.config) || {}; }

  window.CopyPilot.util = {
    cfg: cfg,
    /** Safe async fetch with mock fallback. */
    fetchJson: function (url, options, mockFn) {
      return new Promise(function (resolve) {
        (async function () {
          try {
            var res = await fetch(url, options || {});
            if (!res.ok) { throw new Error("HTTP " + res.status); }
            resolve(await res.json());
          } catch (err) {
            console.error("[CopyPilot Error]: fetchJson fallback —", err.message, url);
            resolve(typeof mockFn === "function" ? mockFn(err) : null);
          }
        })();
      });
    },
    escapeHtml: function (s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
  };
})();
