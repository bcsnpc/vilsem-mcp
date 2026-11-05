# Browser motion capture design

The SVG sampler captures settled timeline states. It cannot truthfully depict
enter/update interpolation. A separate optional browser adapter renders the
same closed spec with the shared core resolver and ECharts canvas runtime.

The adapter launches a fresh headless Chromium profile, never the user's open
browser/profile or Power BI. It loads only a locally built, shipped runtime;
the spec and model rows cross the boundary as JSON, never script text. The core
grammar and expression budgets remain enforced. All page requests and service
workers are blocked; no connector, authentication module, Node bridge or model
credentials are exposed to the page. Only essential OS environment variables
are forwarded. The normal Chromium sandbox remains enabled.

A controlled browser clock advances requestAnimationFrame/timers to bounded
sample instants. Screenshots preserve animation; the APNG contains actual
canvas states, not fabricated fades or pixel interpolation. Capturing at a
virtual instant does not measure rendering FPS. Native performance and native
host interactions still require their own checks.

Limits: payload8MiB;2..12 frames;12million total decoded pixels;45-second wall
deadline;3-second APNG duration;2MiB output. Longer motion is explicitly sampled
and flagged. A final settled SVG PNG remains available for comparison. The
optional contact sheet continues to show labelled timeline states separately.

Default mode auto uses an installed Chrome/Edge/Chromium or an explicit
VILSEM_PREVIEW_BROWSER_PATH. States mode avoids browser launch. Explicit browser
mode requires a browser and reports failure if unavailable. Auto fallback is
labelled; it never claims state sampling captured browser interpolation.

playwright-core manages only this owned headless renderer. It downloads no
browser, depends on no Electron app, and does not attach to user browser tabs.
The build produces a static browser bundle from @vilsem/core/spec/resolve and
the pinned ECharts dependency. New renderer/runtime dependencies require the
same source/tests/build/audit gates as other code.
