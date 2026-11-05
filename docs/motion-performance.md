# Reproducing the Group C motion measurements

These are QA probes, not a production batching feature or native Power BI
measurements. Run from a source checkout after npm install/build, with an
installed Chrome/Edge/Chromium and other builds/tests stopped:

```sh
node scripts/round3-chromium-idle-cadence.mjs
node scripts/round3-chromium-performance.mjs
node scripts/round3-batch-probe-builder.mjs
node scripts/round3-chromium-batch-probe.generated.mjs
```

JSON evidence is written under test-results/stress3/browser-motion. Preserve
prior files before repeating. `budgetPassed` requires >=57 RAF fps and <=20ms
p95 intervals. The probes report measurements; inspect this field rather than
treating a successful process exit as a performance PASS. Paint callbacks are
not display frames. The normal probe retains all5,000 stable point IDs and
explicitly enables animation above ECharts' default animation threshold.

The batch experiment animates an internal ECharts path. It is not imported by
any product renderer, and it does not establish per-point style/selection,
keyboard, tooltip, context, resize or export parity. Its hit-index sample is
only a sample. Do not enable it based on speed alone.

Final laptop repeat: idle54.79 RAF fps; normal20.36fps/107.8ms p95;
prototype55.12fps/18.2ms p95. Both chart runs FAIL. Earlier results are retained:
normal24.92fps/72.2ms and prototype55.95fps/18.2ms. Browser-clock APNG capture is
a separate deterministic preview facility and never serves as FPS evidence.
