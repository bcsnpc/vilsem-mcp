# Verification - 2026-11-02, v0.2.0 / v0.2.1 follow-up

## Release gates

- Core 0.2.0 installed from its public GitHub release artifact; no local file dependency.
- MCP TypeScript build: passed. Test suite: **30 passed**, including all 14 templates, explain_visual, deterministic PNGs, custom-only insertion and real stdio round trip.
- Dependency audit: zero findings, including development dependencies.
- Core/app suites: 797 passed in each of the private and sanitized public checkouts.
- Full renderer, UI, standalone, Fabric embed and Electron installer build: passed.
- Actual packaged Electron bridge: auto-detected Desktop port 61645 by the msmdsrv process workspace port file, read 13 tables / 39 measures and returned 42 from a real DAX query.
- Standalone core Fabric service-principal smoke: 20 tables, 97 measures, real DAX query returned 42. No credentials or model identifiers published.
- Nine connection/auth regressions cover ambiguous ports, schemas, row bounds, read-only query surface, independent Fabric targets/401 refresh, service principals, device-code pending/slow_down, refresh-token caching, runtime credential-mode changes and ESM/CommonJS exports.
- Model connection code imports only @vilsem/core/connect, with no Electron, IPC, app checkout lookup or application-path environment requirement. get_schema exposes fields and relationships, not raw model/data-source definitions.

## Issues found and corrected

- Desktop process inspection could abort report insertion on timeout. It is advisory and now returns a warning instead.
- Concurrent SSR work exceeded the former five-second test timeout on this laptop. Integration tests use a 30-second timeout; all assertions remain.
- Node's inferred CommonJS named exports omitted the direct connect function. Core now has explicit ESM/CommonJS entry points and a regression test.

## Live Desktop acceptance

The public GitHub v0.2.0 package was installed in a separate directory outside the application checkout, using core's public release artifact. Its actual stdio server exposed all ten tools with app-path and cloud credential variables absent.

- `connect_model {source:{kind:"desktop"}}`: passed, port **61645**, method **process-workspace-port-file** (CIM Desktop-parent msmdsrv process, its -s workspace, Unicode msmdsrv.port.txt).
- `get_schema`: read 13 tables / 39 measures / 96 columns. Live sampling exposed 13 unqueryable internal RowNumber identities and two field-parameter composite-key errors. v0.2.1 skips those engine-only identities explicitly and uses SELECTCOLUMNS/TOPN row projection for composite-key sampling. Live retest: **zero failures**, 13 explicit skips. Regression suite: 30 passed.
- `explain_visual`: passed, qualified existing Total Revenue measure and CategoryName binding, exact SUMMARIZECOLUMNS DAX, no model edits.
- `preview_visual`: passed, real Desktop data, three revenue categories, deterministic PNG saved privately.
- `commit_visual`: passed into the actually open report's new **Vilsem MCP QA** page beside a native Total Revenue card. Renderer was imported through Desktop and the page saved first. Hash comparison immediately after MCP insertion: **all 135 existing report files unchanged**; only the new visual was added.
- Desktop displayed **Apply external changes** and its overwrite confirmation. Both official Desktop bridge reload and the normal child-window confirmation completed. A native Microsoft Q&A retirement notice was closed without removing any Q&A visuals.
- Live Desktop screenshot confirms the chart's three real values and native revenue card. Clicking **Accessories** changed the native card from **$25M** to **$907K**; the native tooltip showed **906673.107**, matching the queried category value. Empty-area click restored the native card to $25M. This verifies actual host selection and deselection, not a simulated callback.
- `validate_visuals`: the inserted Vilsem visual passed schema/spec validation. Native visuals were not validated or rewritten by MCP.

Private evidence is under ignored `test-results/live-desktop-v020/`: stdio results, preview PNG, Desktop render and cross-filter PNGs, and patched schema results. No customer samples, model IDs or credentials are published here. The open project is a cache QA copy; the supplied source PBIP folder is untouched. Desktop save normalized its culture/synonym metadata; that file is backed up and restored after final verification.

## Limits

- Device-code polling and private cache behavior have automated tests; an actual browser device login has not been performed in this cycle. Windows uses user-profile ACLs; POSIX mode bits are not Windows ACLs.
- Cross-filter OUT is live verified. Drill-through, bookmarks, incoming cross-highlight and every tooltip configuration still need exhaustive live host acceptance.
- Previews show ECharts marks/options, not renderer card chrome or existing report filter context. DOM-adapter types do not resolve through this headless API.
- Microsoft excludes report-level report.json changes from live reload. First renderer registration may need a reopen; import/register the renderer in Desktop and save before a visual-only reload test.
- The app installer remains unsigned and its pre-existing dependency audit has 45 findings; those are not closed by core/MCP extraction.

## Work log

- Extracted model services; retained application registry caching and compatibility wrappers.
- Replaced MCP checkout adapter and added explain_visual; removed application-path setup from README client examples.
- Built and tested against the public core artifact. Tagged/pushed core-v0.2.0 in both app repositories. MCP v0.2.0 was merged, tagged and pushed; isolated GitHub install passed. v0.2.1 is the live-discovered schema-sampling correction, with a live zero-failure retest and 30 passing tests.
