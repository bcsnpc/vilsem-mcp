# vilsem-mcp

vilsem-mcp is the custom-visual layer for agentic Power BI authoring — use it alongside Microsoft's Power BI Report skill for native visuals and the Power BI Modeling MCP for model changes. It previews Vilsem visuals with model data and inserts them into an existing local PBIR report through the shared `@vilsem/core` package.

## Install

Requires Node.js 22.12+, 24, or 26+. Clone this repository and run `npm install`, then `npm test`. Its `prepare` step builds the TypeScript server. For model connections, install dependencies in a Vilsem source checkout and set `VILSEM_APP_PATH` to that checkout; the adapter reuses its Desktop bridge, Fabric introspection and authentication. Configure Fabric credentials/session using Vilsem's existing configuration. Model connection tools report missing configuration; templates, spec validation and local report tools work without a model connection.

The core dependency uses the immutable public `core-v0.1.1` release tarball. npm does not install a package from a monorepo subdirectory via a normal Git dependency URL. For local core development, replace it with `file:../semantic_app/packages/core`, build core there and run `npm install`; switch back to the release URL before distributing.

There is no npm-registry publication yet. After the GitHub push, the GitHub install form is:

```sh
npm install -g git+https://github.com/bcsnpc/vilsem-mcp.git
vilsem-mcp
# Or: npx --yes --package=git+https://github.com/bcsnpc/vilsem-mcp.git vilsem-mcp
```

The process serves stdio JSON-RPC; diagnostics go to stderr.

### Claude Desktop

Add to `claude_desktop_config.json`, replacing the paths:

```json
{"mcpServers":{"vilsem":{"command":"node","args":["D:/vilsem-mcp/dist/index.js"],"env":{"VILSEM_APP_PATH":"D:/semantic_app"}}}}
```

### Claude Code

```sh
claude mcp add --transport stdio --env VILSEM_APP_PATH=D:/semantic_app vilsem -- node D:/vilsem-mcp/dist/index.js
```

### Codex

Add to `~/.codex/config.toml` or a trusted project's `.codex/config.toml`:

```toml
[mcp_servers.vilsem]
command = "node"
args = ["D:/vilsem-mcp/dist/index.js"]

[mcp_servers.vilsem.env]
VILSEM_APP_PATH = "D:/semantic_app"
```

See the [official MCP configuration documentation](https://learn.chatgpt.com/docs/extend/mcp).

## Desktop setup and walkthrough

In Desktop, open File → Options and settings → Options → Preview features. Enable **“Detect and reload external PBIP changes”** and restart Desktop. Microsoft documents this exact preview feature in [external project editing](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-external-editing).

1. Open your semantic model in Desktop, then call `connect_model` with `source:{kind:"desktop"}`; provide a port if more than one engine is open. For Fabric, provide workspaceId and datasetId.
2. Call `get_schema` and choose existing dimensions/measures. Use `run_dax` to verify the data.
3. Call `list_templates`, read `vilsem://docs/spec-format`, then `validate_spec` and `preview_visual`. Check the PNG and option before writing.
4. Call `list_pages`, choose a position without overlap, then `commit_visual` with the report folder, page folder name, a new visualName, spec, bindings and layout.
5. Accept Desktop's external-change reload prompt. Avoid saving stale Desktop state over the external changes.
6. Inspect the rendered result and call `validate_visuals`. Save the report from Desktop when satisfied.

## Tools and resources

Tools: connect_model, get_schema, run_dax, list_templates, validate_spec, preview_visual, list_pages, commit_visual, validate_visuals. Resources: `vilsem://templates/<template-id>` and `vilsem://docs/spec-format`.

`list_pages` reads all visual positions to help avoid overlap. `validate_visuals` examines only the stable Vilsem Renderer GUID; it does not report native visual validation results. `commit_visual` adds one new visual, rejects collisions and updates only missing renderer resources/registration. It does not rebuild or serialize other report content.

## Interactions

Rendered Vilsem ECharts visuals cross-filter through Power BI selection IDs, accept cross-highlights, support drill-through/context menu requests, native tooltips and bookmark selection restoration. Those host interaction contracts have automated harness tests in Vilsem. Availability depends on bound field identities and report configuration; report-page tooltip resolution, drill-through destinations and bookmarks require testing in the actual report. A PNG preview is static and does not verify these interactions. DOM-adapter visuals and every possible template transform have not been certified for interaction parity.

## What this does NOT do

- Create, edit or validate native Power BI visuals.
- Create or edit slicers, filters, bookmarks or themes.
- Change semantic models, measures or model metadata.
- Read or write PBIX files. Existing enhanced PBIR report folders are required.

Desktop connections require Windows and Power BI Desktop. The current model adapter requires a Vilsem source checkout; this initial release does not independently decrypt Electron's saved workspace credentials. Configure its existing Fabric authentication for the server process. Column sampling can be expensive on large models and permission failures are returned per column.

Headless previews support the core ECharts composition types and declarative templates. DOM-adapter visual types are rejected by this resolver rather than emitted as empty or substituted charts. Previews render the chart marks and option; renderer-owned card chrome/title headers and existing report-level filters are not replayed. Fonts can differ between server PNGs and Desktop if the machines have different installed fonts. Preview data is capped at 200 rows; arbitrary DAX results default to 200 and are capped at 10,000 returned rows.

## Development and verification

Run `npm run build` and `npm test`. Tests cover spec resolution, deterministic SVG/PNG rendering, custom-only PBIR insertion/validation and a real stdio client/server round trip. Live Fabric credentials, Desktop query access, reload prompts and host interactions need environment-backed acceptance; passing fixture tests alone does not establish those results.
