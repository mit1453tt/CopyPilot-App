/* CopyPilot AI — Self-Healing Catalog Agent (scheduled audit→fix→publish) */
(function () {
  "use strict";
  window.CopyPilot = window.CopyPilot || {};

  var agentState = {
    enabled: false,
    intervalHours: 24,
    lastRun: null,
    nextRun: null,
    timerId: null,
    runs: []
  };

  window.CopyPilot.agent = {
    getState: function () { return Object.assign({}, agentState, { runs: agentState.runs.slice(-10) }); },

    configure: function (opts) {
      opts = opts || {};
      if (typeof opts.enabled === "boolean") { agentState.enabled = opts.enabled; }
      if (opts.intervalHours) { agentState.intervalHours = opts.intervalHours; }
      return agentState;
    },

    /** One autonomous cycle: audit → enrich → generate → publish → re-audit. */
    runCycle: function (ctx, onStep) {
      var step = function (name, detail) {
        if (typeof onStep === "function") { onStep(name, detail); }
      };
      return new Promise(function (resolve) {
        (async function () {
          var run = { startedAt: Date.now(), steps: [], success: false };
          try {
            step("audit", "Scanning catalog…");
            var auditRes = await window.CopyPilot.audit.runAutonomousStoreAudit();
            run.steps.push({ name: "audit", flagged: auditRes.flagged.length });

            step("enrich", "Enriching flagged products…");
            var enriched = await window.CopyPilot.enrichment.enrichBulk(
              auditRes.flagged.slice(0, 5).map(function (p) { return { id: p.id, title: p.title }; })
            );
            run.steps.push({ name: "enrich", count: enriched.length });

            step("fix", "Auto-fixing with AI…");
            var fixed = await window.CopyPilot.audit.autoFixSelected(auditRes.flagged.slice(0, 5));
            run.steps.push({ name: "fix", count: fixed.length });

            step("publish", "Publishing to Shopify…");
            var pub = await window.CopyPilot.sync.publishBulk(fixed);
            run.steps.push({ name: "publish", count: pub.published });

            step("re-audit", "Re-scanning…");
            var reAudit = await window.CopyPilot.audit.runAutonomousStoreAudit();
            run.steps.push({ name: "re-audit", flagged: reAudit.flagged.length });

            run.success = true;
            run.finishedAt = Date.now();
            agentState.lastRun = run.finishedAt;
            agentState.runs.push(run);
            step("done", run);
            resolve(run);
          } catch (err) {
            console.error("[CopyPilot Error]: Agent cycle failed —", err.message);
            run.error = err.message;
            run.finishedAt = Date.now();
            agentState.runs.push(run);
            resolve(run);
          }
        })();
      });
    },

    /** Start scheduled agent (mock cron via setInterval). */
    startScheduler: function (ctx, intervalHours, onStep) {
      this.stopScheduler();
      intervalHours = intervalHours || agentState.intervalHours || 24;
      agentState.enabled = true;
      agentState.intervalHours = intervalHours;
      var ms = Math.max(60000, intervalHours * 3600 * 1000); // min 1 min for demo
      var demoMs = 300000; // 5 min demo interval when hours >= 24
      var tick = intervalHours >= 24 ? demoMs : ms;
      agentState.nextRun = Date.now() + tick;
      agentState.timerId = setInterval(function () {
        window.CopyPilot.agent.runCycle(ctx, onStep);
        agentState.nextRun = Date.now() + tick;
      }, tick);
      return agentState;
    },

    stopScheduler: function () {
      if (agentState.timerId) { clearInterval(agentState.timerId); agentState.timerId = null; }
      agentState.enabled = false;
      return agentState;
    }
  };
})();
