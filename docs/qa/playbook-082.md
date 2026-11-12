# MCP 0.8.2: playbook and commit-guidance verification

## Scope

Adds runtime Markdown retrieval (`get_playbook`), explicit post-write guidance, NativeMeasure reporting, Copilot setup and supplied Contoso lessons/examples. Core 0.8.0, renderer 4.43, GUID, spec format and model-write boundaries are unchanged. Security-audit follow-ups are excluded.

## Automated checks

- Build: passed.
- Focused playbook/skill-delivery checks: 9/9 passed; actual stdio returns 20 tools and four skill resources. Native skill installation copies five files.
- Core: **6,190 UTF-8 bytes**, **~1,548 tokens** using ceil(bytes/4), below the 8,000-byte guard. Complete default response (core + index + version header): **7,362 bytes**. These are estimates, not tokenizer counts.
- Skill validator: passed.
- All 17 JSON references match the supplied task examples byte-for-byte and parse as JSON.
- Full `npm test`: **349/349 passed across 19 files**, 338.60 seconds (Windows / Node 24.14.0). This includes first/subsequent commits, model-only versus scoped warnings, committed-update guidance, malformed-container handling, real stdio and existing regressions.
- Initial full run: 348 passed, one resource-count assertion failed because the new fourth skill resource adds one entry. Corrected that assertion; focused check and full rerun passed. The new scoped-measure fixture also needed its owning table added to the mock schema; its focused integration check then passed.
- `npm pack --dry-run`: passed. Actual final verification package: 504 entries, all 17 Contoso JSON examples, new playbook code/reference and existing promotion helper included; `codex-tasks/` excluded.
- Installed the local archive into a fresh temporary directory with `npm install`; actual installed stdio server returned **20 tools**, the default core and section 9a successfully. Four skill resources were readable. Repeated the fresh install after final runtime changes; counts and sizes unchanged.
- Verification archives/installations are under the OS temporary folder, outside both repositories. No release/tag/checksum publication was performed.

## Compatibility decisions

- Alias responses use the canonical section ID in the header so `9a` and its long slug return identical text. Explicit `core` and `cookbook:sankey` are supported convenience aliases.
- `validate_visuals` preserves its existing first text block (the results array); the additive summary is a second JSON text block. NativeMeasure counts use actual query projections, deduplicated by name per visual, including invalid Vilsem containers when readable. Native report visuals remain ignored.
- `update_visual` does not register a renderer, so committed updates always return Apply guidance; dry runs return no post-commit instruction.
- Runtime Markdown is read on every tool call, without persistent caches or filesystem writes. Missing required headings fail explicitly.
- Copilot instructions retain the requested editor-managed `.vscode/mcp.json` / `servers` example. A note distinguishes newer harness-native `.mcp.json` / `mcpServers` configuration per current Microsoft documentation.
- Native skill installation includes the recipes reference, but the example JSON remains in the MCP package under `docs/examples/contoso`; this is explicitly documented beside the links.
- README labels 0.8.2 as prepared, awaiting approval. Its pinned installation/checksum URLs target the planned release and are not claimed to be published yet.

## Manual checks remaining

- [ ] GitHub Copilot 0.8.2: trust/start server, confirm tool list, call default playbook and section 9a, then perform a full real-data author/preview/commit run.
- [ ] Power BI Desktop: verify first-registration close-without-saving/reopen and subsequent Apply external changes on a test copy; preserve existing work before writes.
- [ ] Desktop: verify actual rendering, numbers, native filtering/highlighting, tooltips, resize and save/reopen for the new examples after adapting real bindings.
- [ ] Power BI Service / Publish to web: use model measures and verify shared report behavior; no new live host claims are made for these documentation changes.
- [ ] After approval: push branch/open PR, publish release archive/tag/checksums; then test public release download links.
