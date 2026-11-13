# Vilsem for Power BI (Claude Code plugin)

Vilsem lets Claude author **custom Power BI visuals** on the semantic model you have open in Power BI Desktop. Claude probes the data with read-only DAX, renders a preview of the visual on your real values with an automatic critique (overlapping labels, contrast, ordering, empty data), fixes its own mistakes, and then adds the visual to your PBIP report. Later you can ask for edits in plain language ("make the labels bigger") and Claude updates the same visual.

This plugin adds:

- the **`vilsem` MCP server** (20 tools: `get_playbook`, `connect_model`, `get_schema`, `run_dax`, `preview_visual`, `commit_visual`, `update_visual`, `validate_visuals` and others), and
- the **`vilsem-powerbi-visuals` skill**: the playbook Claude follows (workflow, reload rules, measures for shared reports, cookbook). It includes `scripts/promote-measures.py`, which Claude runs only with your permission.

Full documentation: https://github.com/bcsnpc/vilsem-mcp

## Install

```text
/plugin install vilsem --marketplace bcsnpc/vilsem-mcp
```

Or add the marketplace first: `/plugin marketplace add bcsnpc/vilsem-mcp`, then `/plugin install vilsem@vilsem-mcp`. In the VS Code extension, type `/plugins` and use the **Marketplaces** tab.

## Requirements

- Windows, with **Power BI Desktop** on the same PC
- **Node.js 22.12+ with npm** (used to start and install the server)
- A report saved as a **PBIP project** (enhanced PBIR format)

Vilsem works with local Desktop models only. Online Power BI Service / Fabric connections are disabled.

## What this plugin runs, fetches and writes

**On first start (one time, about 30 seconds).** The MCP server is started as `node ${CLAUDE_PLUGIN_ROOT}/launcher.mjs`. Because the server depends on a package that is published on GitHub rather than npm, the launcher:

1. downloads the pinned release archive `vilsem-mcp-0.9.2.tgz` from `https://github.com/bcsnpc/vilsem-mcp/releases/download/v0.9.2/` (built and published by GitHub Actions, with build provenance);
2. verifies its **SHA-256** against the value hard-coded in `launcher.mjs` (identical to the release's `SHA256SUMS-0.9.2.txt`), and refuses to install on any mismatch;
3. runs `npm install` of that verified archive, using the dependency versions and integrity hashes locked in its `npm-shrinkwrap.json`, into the plugin data folder (`${CLAUDE_PLUGIN_DATA}`). This downloads those exact dependencies from the npm registry and from the `@vilsem/core` GitHub release;
4. starts the installed server. Later starts reuse the verified install and make no downloads.

**While running.** The server:

- reads files in the `.Report` folder you give it, and runs **read-only** DAX queries (`EVALUATE`/`DEFINE` only) against the Power BI Desktop model on this PC;
- writes only Vilsem visual files into that report (plus, for the first visual, the Vilsem renderer's registration and resource files), and saved templates in your user template folder;
- **never changes your semantic model**. Network and UNC paths are refused;
- has **no telemetry** and makes **no network requests** in this local mode.

**What Claude sees.** Tool results, including query rows, column sample values, measure formulas and preview images of your data, are returned to Claude and therefore go to Anthropic as part of your conversation, under your Claude data settings. To omit column sample values, ask Claude to call `get_schema` with `samples:false`. Use copies of reports when trying it on sensitive data.

## Getting started

After installing, open your PBIP report in Power BI Desktop (keep only that report open) and ask Claude, for example:

> Use Vilsem with my open report at `C:/Reports/Sales/Sales.Report`. Build a visual comparing net sales and margin by product category, preview it on real data, then add it to the first page.

The **first** Vilsem visual in a report registers the renderer: close Power BI Desktop **without saving** and reopen the project. For later visuals and edits, click **Apply** on Desktop's external-changes prompt.

This is an evaluation release: try it on copies of your reports.

## Support, privacy and license

- Issues: https://github.com/bcsnpc/vilsem-mcp/issues
- Security and data handling: https://github.com/bcsnpc/vilsem-mcp/blob/main/SECURITY.md (report vulnerabilities privately as described there)
- License: MIT
