/* CopyPilot AI — Bulk Queue (10k+ SKU batch processing) */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};
  function cfg() { return (window.CopyPilot && window.CopyPilot.config) || {}; }

  var queue = [];
  var running = false;
  var stats = { total: 0, done: 0, failed: 0 };

  window.CopyPilot.queue = {
    getStats: function () { return Object.assign({}, stats); },
    getItems: function () { return queue.slice(); },

    /** Enqueue products for bulk generation (supports 10k+). */
    enqueue: function (products, task) {
      task = task || "generate";
      products = products || [];
      products.forEach(function (p) {
        queue.push({ id: p.id || p.productId, title: p.title, task: task, status: "pending", product: p });
      });
      stats.total = queue.length;
      return queue.length;
    },

    /** Process queue in batches with concurrency control. */
    process: function (options, onProgress) {
      options = options || {};
      var batchSize = options.batchSize || 25;
      var concurrency = options.concurrency || 3;
      var handler = options.handler;
      if (running) { return Promise.resolve({ skipped: true, reason: "already running" }); }
      running = true;
      stats.done = 0; stats.failed = 0;

      return new Promise(function (resolve) {
        (async function () {
          var pending = queue.filter(function (q) { return q.status === "pending"; });
          var url = (cfg().queueEndpoint || cfg().appProxyBase + "/queue") + "/process";

          for (var i = 0; i < pending.length; i += batchSize) {
            var batch = pending.slice(i, i + batchSize);
            var chunks = [];
            for (var c = 0; c < batch.length; c += concurrency) {
              chunks.push(batch.slice(c, c + concurrency));
            }
            for (var ci = 0; ci < chunks.length; ci++) {
              await Promise.all(chunks[ci].map(async function (item) {
                try {
                  if (typeof handler === "function") {
                    await handler(item);
                  } else {
                    await window.CopyPilot.util.fetchJson(url, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ item: item })
                    }, function () { return { mock: true, ok: true }; });
                  }
                  item.status = "done";
                  stats.done++;
                } catch (e) {
                  item.status = "failed";
                  stats.failed++;
                }
                if (typeof onProgress === "function") {
                  onProgress(Object.assign({}, stats), item);
                }
              }));
            }
          }
          running = false;
          resolve(Object.assign({}, stats, { queue: queue.slice() }));
        })();
      });
    },

    clear: function () { queue = []; stats = { total: 0, done: 0, failed: 0 }; }
  };
})();
