/* CopyPilot AI — CSV / PIM Import (multi-channel ready) */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};

  function parseCsv(text) {
    var lines = String(text || "").split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!lines.length) { return []; }
    var headers = lines[0].split(",").map(function (h) { return h.trim(); });
    return lines.slice(1).map(function (line) {
      var cols = line.split(",");
      var row = {};
      headers.forEach(function (h, i) { row[h] = (cols[i] || "").trim(); });
      row.id = row.id || row.sku || row.handle || ("import-" + Math.random().toString(36).slice(2, 8));
      row.title = row.title || row.name || "Imported Product";
      return row;
    });
  }

  window.CopyPilot.import = {
    parseCsv: parseCsv,

    /** Import from CSV file object. */
    importFromFile: function (file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var products = parseCsv(reader.result);
            resolve({ mock: false, count: products.length, products: products, source: "csv" });
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    },

    /** Mock PIM connector (Akeneo/Salsify style). */
    importFromPim: function (connector) {
      var url = (window.CopyPilot.util.cfg().importEndpoint || window.CopyPilot.util.cfg().appProxyBase + "/import") + "/pim";
      return window.CopyPilot.util.fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connector: connector || "akeneo" })
      }, function () {
        return {
          mock: true,
          connector: connector || "akeneo",
          count: 150,
          products: [
            { id: "pim-001", title: "PIM Import Product A", sku: "SKU-A" },
            { id: "pim-002", title: "PIM Import Product B", sku: "SKU-B" }
          ]
        };
      });
    },

    /** Export enriched catalog as CSV string. */
    exportToCsv: function (products) {
      products = products || [];
      if (!products.length) { return "id,title,description\n"; }
      var keys = Object.keys(products[0]);
      var lines = [keys.join(",")];
      products.forEach(function (p) {
        lines.push(keys.map(function (k) { return String(p[k] || "").replace(/,/g, ";"); }).join(","));
      });
      return lines.join("\n");
    }
  };
})();
