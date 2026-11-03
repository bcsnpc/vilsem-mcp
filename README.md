# vilsem-mcp

vilsem-mcp is the custom-visual layer for agentic Power BI authoring — use it alongside Microsoft's Power BI Report skill for native visuals and the Power BI Modeling MCP for model changes. It previews Vilsem visuals with model data and inserts them into an existing local PBIR report through the shared `@vilsem/core` package.

## Install

Requires Node.js 22.12+, 24, or 26+. Install from GitHub or clone this repository and run `npm install`, then `npm test`. Its `prepare` step builds the server. All model connections run through `@vilsem/core/connect`; no Vilsem app checkout, Electron installation or application path configuration is needed.

The dependency is the immutable public `core-v0.3.0` release tarball. For local core development only, install a locally packed core tarball; restore the public release URL before distributing.

### Model authentication

Desktop requires Windows and a running Power BI Desktop model. Core identifies the Desktop Analysis Services process and reads its workspace port file. Pass `source.port` if multiple instances are open. ADOMD/XMLA uses your Windows identity; no cloud login is needed.

For Fabric, configure these environment variables on the MCP server process:

- Service principal: `AUTH_MODE=service_principal`, `FABRIC_TENANT_ID`, `FABRIC_CLIENT_ID`, `FABRIC_CLIENT_SECRET`.
- User login: `AUTH_MODE=device_code` (default). Login instructions go to stderr; complete Microsoft's device-code login in your browser. Only the refresh token is cached under `~/.vilsem/auth/`, scoped to tenant/client/resource, in a 0700 directory and atomic 0600 file. Windows uses the user-profile ACLs; POSIX modes are not Windows ACLs.
- Optional `FABRIC_ACCESS_TOKEN` for an externally supplied short-lived token. Refresh requires another configured credential flow.

No credentials are read from another repository's `.env` or Electron workspace store. Set credentials in your MCP client's server environment. Core also preserves `setInteractiveTokens` for Electron PKCE login.

There is no npm-registry publication. Install the tagged GitHub release:

```sh
npm install -g git+https://github.com/bcsnpc/vilsem-mcp.git#v0.3.0
vilsem-mcp
# Or: npx --yes --package=git+https://github.com/bcsnpc/vilsem-mcp.git#v0.3.0 vilsem-mcp
```

The process serves stdio JSON-RPC; diagnostics go to stderr.

### Claude Desktop

Add to `claude_desktop_config.json`, replacing the paths:

```json
{"mcpServers":{"vilsem":{"command":"node","args":["D:/vilsem-mcp/dist/index.js"]}}}
```

### Claude Code

```sh
claude mcp add --transport stdio vilsem -- node D:/vilsem-mcp/dist/index.js
```

### Codex

Add to `~/.codex/config.toml` or a trusted project's `.codex/config.toml`:

```toml
[mcp_servers.vilsem]
command = "node"
args = ["D:/vilsem-mcp/dist/index.js"]

```

See the [official MCP configuration documentation](https://learn.chatgpt.com/docs/extend/mcp).

## Desktop setup and walkthrough

In Desktop, open File → Options and settings → Options → Preview features. Enable **“Detect and reload external PBIP changes”** and restart Desktop. Microsoft documents this exact preview feature in [external project editing](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-external-editing).

1. Open your semantic model in Desktop, then call `connect_model` with `source:{kind:"desktop"}`; provide a port if more than one engine is open. For Fabric, provide workspaceId and datasetId.
2. Call `get_schema` and choose existing dimensions/measures. Use `run_dax` to verify the data.
3. Call `list_templates`, read `vilsem://docs/spec-format`, then `validate_spec`, `explain_visual` and `preview_visual`. Check the PNG and option before writing.
4. Call `list_pages`, choose a position without overlap, then `commit_visual` with the report folder, page folder name, a new visualName, spec, bindings and layout.
5. Accept Desktop's external-change reload prompt. Avoid saving stale Desktop state over external changes. Microsoft excludes report-level `report.json` changes from live reload: first-time custom-visual registration can require reopening the project. For visual-only reload, first import the renderer package in Desktop and save the project, then commit a visual.
6. Inspect the rendered result and call `validate_visuals`. Save the report from Desktop when satisfied.

## Tools and resources

Tools: connect_model, get_schema, run_dax, list_templates, validate_spec, explain_visual, preview_visual, list_pages, commit_visual, validate_visuals. Resources: `vilsem://templates/<template-id>` and `vilsem://docs/spec-format`.

`list_pages` reads all visual positions to help avoid overlap. `validate_visuals` examines only the stable Vilsem Renderer GUID; it does not report native visual validation results. `commit_visual` adds one new visual, rejects collisions and updates only missing renderer resources/registration. It does not rebuild or serialize other report content.

## Interactions

Rendered Vilsem ECharts visuals cross-filter through Power BI selection IDs, accept cross-highlights, support drill-through/context menu requests, native tooltips and bookmark selection restoration. Those host interaction contracts have automated harness tests in Vilsem. Availability depends on bound field identities and report configuration; report-page tooltip resolution, drill-through destinations and bookmarks require testing in the actual report. A PNG preview is static and does not verify these interactions. DOM-adapter visuals and every possible template transform have not been certified for interaction parity.

## What this does NOT do

- Create, edit or validate native Power BI visuals.
- Create or edit slicers, filters, bookmarks or themes.
- Change semantic models, measures or model metadata.
- Read or write PBIX files. Existing enhanced PBIR report folders are required.

Desktop connections require Windows and Power BI Desktop. Column sampling can be expensive on large models and permission failures are returned per column.

Headless previews support the core ECharts composition types and declarative templates. DOM-adapter visual types are rejected by this resolver rather than emitted as empty or substituted charts. Previews render the chart marks and option; renderer-owned card chrome/title headers and existing report-level filters are not replayed. Fonts can differ between server PNGs and Desktop if the machines have different installed fonts. Preview data is capped at 200 rows; arbitrary DAX results default to 200 and are capped at 10,000 returned rows.

## Development and verification

Run `npm run build` and `npm test`. Tests cover spec resolution, deterministic SVG/PNG rendering, custom-only PBIR insertion/validation and a real stdio client/server round trip. Live Fabric credentials, Desktop query access, reload prompts and host interactions need environment-backed acceptance; passing fixture tests alone does not establish those results.

## Expressiveness examples (0.3.0)

Nine new standalone `.vilsem-visual.json` specs ship in `templates/` and are listed by `list_templates`. They cover Sankey, Gantt, running-total waterfall, sunburst, bullet, radial progress, dual-axis reference measures, facets and a relationship network. Bind their declared slots to your own schema; no model data is embedded. Use core 0.3.0 / renderer 4.14.2.0+. The [expressiveness report](docs/expressiveness-gaps.md) records the live workflow, bounds and the deliberately unsupported Marimekko custom callback.
