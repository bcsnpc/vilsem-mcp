# Verification ? 2026-11-02

## Automated results
- `npm install` using the public core-v0.1.1 release artifact: passed.
- `npm run build`: passed.
- `npm test`: **27 passed**. Includes all 14 shared templates, visible deterministic PNG rendering, scalar-ratio evaluation, strict spec/token/formatter/field-role errors, additive PBIR insertion and preservation of native content, custom-only validation, model connection/query contracts and real stdio tool/resource calls.
- `npm audit`: **0 vulnerabilities** for the final server dependency tree, including development dependencies. This result does not describe Vilsem's older application dependency tree.
- Stdio discovery: 9 tools, 14 templates, 15 resources including spec documentation.
- GitHub `npx --package=git+https://github.com/bcsnpc/vilsem-mcp.git#v0.1.0 vilsem-mcp` install/stdio smoke: passed; list_templates returned all 14 templates.
- Actual Desktop auto-detection call returned the expected no-engine error, with instructions to open the model; no successful Desktop connection is claimed.

## Live Fabric acceptance
Using the existing Vilsem authentication and app-configured semantic model:
- Read-only DAX execution: passed.
- Schema: 20 tables and 97 measures.
- Column sampling: all 79 columns passed, maximum 10 values per column, no sample failures.
- Model-backed PNG preview: passed.
- Qualified measure DAX and scalar PNG preview after the core patch: passed.

No client sample values, credentials or model identifiers are included in this document. Private run evidence and previews are under ignored `test-results/`. The older QA model returned HTTP 404; it is not counted as a passing target.

## Application/core integration
Both Vilsem repository checkouts passed **788 tests**. Full renderer, UI, standalone, Fabric embed and Electron installer builds passed, including an actual Electron smoke loading core modules from the packaged application archive. Renderer 4.13.1.0 keeps the existing GUID and primitiveSpec property. Core releases 0.1.0 and 0.1.1 were tagged; 0.1.1 includes the package license, patched ZIP dependency and shared ordering/structured DAX fixes.

## Not verified / limitations
- No Desktop Analysis Services engine was running. Live Desktop query, external-change reload prompt and rendered PBIR acceptance remain unverified.
- New host-native tooltip/drill-through/bookmark/highlight interactions have renderer harness coverage, not live Service/Desktop acceptance in this cycle.
- PNG previews show ECharts marks/options, not renderer-owned title/card chrome or the target report's existing filter context. They do not test interactions.
- DOM-adapter visual types are outside the headless ECharts resolver and are rejected.
- Connections require a Vilsem source checkout and its existing auth/model adapters. Service-principal auth was tested; direct reuse of Electron's encrypted GUI workspace session is not implemented.
- The application installer remains unsigned; existing application dependency findings and broader visual-product backlog are not closed by this MCP delivery.
