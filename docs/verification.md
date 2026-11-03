# Verification - 2026-11-02, v0.2.0

## Release gates

- Core 0.2.0 installed from its public GitHub release artifact; no local file dependency.
- MCP TypeScript build: passed. Test suite: **29 passed**, including all 14 templates, explain_visual, deterministic PNGs, custom-only insertion and real stdio round trip.
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

The released-server checklist is next: auto connect, sampled schema, explain, model-backed PNG, additive commit, actual Desktop reload prompt, real-number render and cross-filter of a native visual. Until recorded below, host acceptance is not claimed by unit tests or a successful file write.

## Limits

- Device-code polling and private cache behavior have automated tests; an actual browser device login has not been performed in this cycle. Windows uses user-profile ACLs; POSIX mode bits are not Windows ACLs.
- Native tooltip, drill-through, bookmarks and cross-highlight contracts have renderer harness tests; exhaustive live host acceptance is outside the listed Desktop checklist.
- Previews show ECharts marks/options, not renderer card chrome or existing report filter context. DOM-adapter types do not resolve through this headless API.
- Microsoft excludes report-level report.json changes from live reload. First renderer registration may need a reopen; import/register the renderer in Desktop and save before a visual-only reload test.
- The app installer remains unsigned and its pre-existing dependency audit has 45 findings; those are not closed by core/MCP extraction.

## Work log

- Extracted model services; retained application registry caching and compatibility wrappers.
- Replaced MCP checkout adapter and added explain_visual; removed application-path setup from README client examples.
- Built and tested against the public core artifact. Tagged/pushed core-v0.2.0 in both app repositories. MCP merge/release and isolated GitHub install are recorded after their final gates.
