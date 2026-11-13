# vilsem-mcp

Author Vilsem custom visuals from chat into an existing Power BI report, using real model data and declarative specifications.

vilsem-mcp doesn't make charts. Claude Code and Codex make charts; vilsem-mcp gives them your model, real data, eyes, and a safe pen. The MCP contains no model and needs no LLM API key. The calling agent's own service or account may have its own costs.

**See what it can build:** the [Vilsem Prompt Book](https://chiranjeevibhogireddy.com/vilsem-prompt-book/) has 104 visuals on Contoso, AdventureWorks and cricket data, each with the exact prompt that built it. Copy a prompt, point your agent at your own model and adapt the fields.

This is the custom-visual layer for agentic Power BI authoring. Use it alongside Microsoft's Power BI Report skill for native visuals and the Power BI Modeling MCP for model changes. The shared, installed renderer executes trusted application code; the authored spec is declarative JSON, not executable source.

**Contents**

- [Release status](#release-status-09-evaluation)
- [Quick start (Windows)](#quick-start-windows)
- [Connect your agent](#connect-your-agent) — [Claude Code plugin](#claude-code-plugin-easiest) · [Claude Code](#claude-code) · [Claude Desktop](#claude-desktop) · [Codex](#codex) · [GitHub Copilot](#github-copilot-vs-code-agent-mode) · [Other clients](#other-mcp-clients)
- [First test prompt](#first-test-generate-a-new-visual-from-scratch)
- [Measures: prototype vs publish](#measures-prototype-vs-publish)
- [Desktop setup and reload rules](#desktop-setup-and-reload-rules)
- [Agent workflow](#agent-workflow)
- [Tools and resources](#tools-and-resources)
- [Limitations](#current-report-and-visual-limitations) · [Known failures](#known-failures-and-workarounds) · [Open checks](#checks-that-remain-partial-or-not-tested)
- [Troubleshooting](#troubleshooting)
- [Release history](#release-history)

## Release status: 0.9 evaluation

Read [SECURITY.md](SECURITY.md) for local-mode boundaries, AI-provider disclosure, sample opt-out and vulnerability reporting.

Current release: **vilsem-mcp 0.9.1**, **@vilsem/core 0.8.1**, **Vilsem Renderer 4.44.0.0**. Releases are built and published by CI, with SHA-256 checksums and verifiable [build provenance](#3-verify-the-download-recommended). These are evaluation prereleases, suitable for testing on copies of your reports. **Production readiness, certification and exhaustive cross-target parity have not been established.** The previous stable release remains 0.6.

Read [what was verified](#what-was-verified-for-08), [known failures](#known-failures-and-workarounds) and [incomplete checks](#checks-that-remain-partial-or-not-tested) before relying on a result. Passing tests do not mean every visual, property, dataset, report interaction or export works. This README on `main` includes live checks performed after the original release archive was built; existing release tags and assets are not rewritten.

## Why not just ask Claude Code / Codex directly?

For a custom visual outside Power BI's native catalog:

| Work | Agent without this custom-visual layer | With vilsem-mcp |
| --- | --- | --- |
| Understand the model | Find a connector, inspect fields and recover calculation context | `get_schema` summary/full with calculations, statistics and relationship context |
| Choose an analytical design | Work out question, grain, units and alternatives | Still the agent's decision; `design_visual` and the design guide supply a structured brief |
| Use real numbers | Implement a query bridge and field normalization | Read-only local Desktop DAX and actual field bindings |
| See and improve a draft | Build a renderer and screenshot pipeline | `preview_visual`, critique and shared-data `preview_variants` |
| Put it in a report | Implement, package and import a custom visual and configure queries | `commit_visual` writes one supported custom visual and any missing renderer registration |
| Edit the visual a month later, in a new chat | Find the old source/chat, re-explain, rebuild, repackage, re-import and rebind | Read the report's spec: "make the Sankey labels bigger"; preview a small patch |
| What runs inside the report | Each separately authored compiled visual's implementation | One shared renderer plus plain declarative specifications |
| Security review | Review each executable implementation and its dependencies | Review the shared renderer/dependencies and the bounded format; report policies still apply |

This does not imply native Power BI visuals require custom coding. Microsoft's companion Report skill handles those.

### Three authoring layers

1. **Composition:** a supported chart type and configuration; the smallest spec and maintenance cost.
2. **Template:** ECharts structure, declared slots, parameters and bounded transforms; more control, with explicit layout and unit responsibilities.
3. **Expression series:** a closed JSON AST describes bounded custom geometry. One trusted interpreter runs it in previews and the renderer; arbitrary `renderItem`/JavaScript is refused. See `vilsem://docs/expression-language`.

## Quick start (Windows)

You can use this with any report; the shipped examples are not tied to the QA model. Use your own fields discovered by `get_schema`.

> **Using Claude Code? Install in two lines instead of steps 2–5.** In a Claude Code session:
>
> ```text
> /plugin marketplace add bcsnpc/vilsem-mcp
> /plugin install vilsem@vilsem-mcp
> ```
>
> **VS Code extension:** type `/plugins`, add `bcsnpc/vilsem-mcp` on the **Marketplaces** tab, then click **Install** on *vilsem*. **Claude desktop app (Code tab):** click **+** next to the prompt box → **Add plugins**. A plugin installed in any of these is available in the others on the same PC.
>
> This adds the MCP server and the Vilsem playbook skill. The first start downloads and verifies the pinned release (about 30 seconds, once). Then continue at [6. Prepare a test report](#6-prepare-a-test-report). Details: [Claude Code plugin](#claude-code-plugin-easiest).

### 1. Prerequisites

- Node.js **22.12+, 24, or 26+**
- Power BI Desktop (August 2026 or later recommended for live external reload)
- A local MCP-capable agent: Claude Code, Claude Desktop, Codex or GitHub Copilot

The MCP server and Desktop must run on the **same Windows machine** for Desktop mode. The Vilsem Electron app is not required. There is no npm-registry publication; always install a pinned GitHub release.

### 2. Install the pinned release

In PowerShell (no Git or source checkout needed):

```powershell
node --version
$vilsemDir = Join-Path $env:USERPROFILE 'vilsem-mcp'
New-Item -ItemType Directory -Force -Path $vilsemDir | Out-Null
npm.cmd install --prefix "$vilsemDir" "https://github.com/bcsnpc/vilsem-mcp/releases/download/v0.9.1/vilsem-mcp-0.9.1.tgz"
```

- `npm.cmd` avoids PowerShell execution-policy errors. If `node` is missing, reopen the terminal after installing Node.
- The warning `install-scripts … vilsem-mcp (prepare: npm run build)` is harmless for the release tarball: `dist/` is prebuilt.
- Installation downloads core 0.8.1 and renderer 4.44 automatically; no application-path environment variable is needed.

### 3. Verify the download (recommended)

Compare the archive against the published checksums for the release:

```powershell
$tgz = Join-Path $env:TEMP 'vilsem-mcp-0.9.1.tgz'
Invoke-WebRequest "https://github.com/bcsnpc/vilsem-mcp/releases/download/v0.9.1/vilsem-mcp-0.9.1.tgz" -OutFile $tgz
(Get-FileHash $tgz -Algorithm SHA256).Hash.ToLower()
# Compare with the vilsem-mcp-0.9.1.tgz line in SHA256SUMS-0.9.1.txt on the release page
# Optional, with the GitHub CLI: confirm the archive was built by this repository's release workflow
gh attestation verify $tgz --repo bcsnpc/vilsem-mcp
```

If you verified a local copy, you can install from it instead: `npm.cmd install --prefix "$vilsemDir" "$tgz"`.

### 4. Record the two paths your agent needs

```powershell
$server = (Join-Path $vilsemDir 'node_modules/vilsem-mcp/dist/index.js') -replace '\\','/'
$node   = (Get-Command node).Source -replace '\\','/'
Test-Path $server   # must be True
$server; $node
```

Use `$server` in the client configuration below. If the client cannot find `node`, use the full `$node` path as `command`.

### 5. Connect your agent

Pick your client in [Connect your agent](#connect-your-agent), then **restart the client** and confirm the Vilsem tools appear. Network/UNC paths and file URLs are refused in all path parameters; remote template/browser environment settings are ignored with a startup warning. Use local drive paths.

A stdio server does not open a website; the MCP client starts it.

### 6. Prepare a test report

- Save a **test copy of the complete report project**, preserving the relative report/model folder structure.
- A `.pbix` must first be saved as a **PBIP project** in Desktop. MCP does not patch a PBIX binary.
- The report must use **enhanced PBIR** (`<name>.Report/definition/pages/`). Convert it in Desktop if needed.
- Enable **Detect and reload external PBIP changes** (see [Desktop setup](#desktop-setup-and-reload-rules)) and restart Desktop.
- Optionally create an empty test page in Desktop, then save.
- **Keep only this report open in Power BI Desktop** while the agent works. With several Desktop windows open, 0.9.1 cannot always tell which model to use (see [Connecting from an existing report binding](#connecting-from-an-existing-report-binding)).
- On large models (10M+ rows) the first `get_schema` can take one to two minutes while it profiles columns. That is expected; see [Troubleshooting](#troubleshooting) if your client times out.

### 7. Build, commit and check

1. Give the agent the absolute **`.Report` folder** path (not the `.pbip` or `.pbix`) and use the [first test prompt](#first-test-generate-a-new-visual-from-scratch).
2. Inspect the real-data preview, then let the agent commit to an existing page.
3. Follow the [reload rules](#reload-rules): the **first** Vilsem visual in a report needs a close-and-reopen without saving; later commits only need the external-changes prompt.
4. Confirm real numbers, selection, slicers, hover/context menus, resize and save/reopen yourself. Existing native visuals should remain intact. `validate_visuals` checks Vilsem objects only.
5. **Before publishing or sharing**, make sure the report has no visual-scoped measures. See [Measures: prototype vs publish](#measures-prototype-vs-publish).

`playwright-core` is optional and loaded only for browser motion capture. If unavailable, static previews still work; `motion:auto` falls back to sampled states with a warning and `motion:browser` returns an explicit error.

For animated browser previews, install Chrome/Edge/Chromium or set `VILSEM_PREVIEW_BROWSER_PATH` in the MCP server environment. Static previews do not need a browser.

## Connect your agent

Vilsem is **not tied to one client**. The same installed server and prompts work with Claude Code, Claude Desktop and Codex. The agent designs the visual; Vilsem supplies model access, validation, previews and scoped report edits.

Vilsem is a **local stdio server**, not a hosted HTTP connector, because it must reach Power BI Desktop on your PC. For Claude Code there is a packaged install with no manual configuration: the [Claude Code plugin](#claude-code-plugin-easiest). Pasting a local path into a browser-only chat does not connect it. For Desktop mode the server must run on the Windows machine containing the open Power BI model; a cloud/remote agent needs a local execution connection. Client setup follows official documentation; not every client UI version has been tested end to end.

### Claude Code plugin (easiest)

Needs Windows, Node.js 22.12+ with npm, and Claude Code. The plugin installs the MCP server **and** the Vilsem playbook skill; quick-start steps 2–5 are not needed. In a Claude Code session:

```text
/plugin marketplace add bcsnpc/vilsem-mcp
/plugin install vilsem@vilsem-mcp
```

Or in one step on Claude Code 2.1.275 or later: `/plugin install vilsem --marketplace bcsnpc/vilsem-mcp`. From a terminal, use `claude plugin marketplace add bcsnpc/vilsem-mcp` then `claude plugin install vilsem@vilsem-mcp`. Restart Claude Code or run `/reload-plugins`, then check `/mcp`.

- **VS Code extension:** type `/plugins` in the prompt box to open **Manage plugins**. On the **Marketplaces** tab add `bcsnpc/vilsem-mcp`, then on the **Plugins** tab click **Install** on *vilsem*.
- **Claude desktop app, Code tab (local session):** click **+** next to the prompt box → **Add plugins** (or **Plugins → Browse plugins**). Plugins are not available in cloud or WSL sessions, and Vilsem needs Power BI Desktop on the same Windows PC anyway.
- The terminal, the VS Code extension and the desktop app's local sessions share the same settings, so a user-scope install in one is available in the others. Start a new session (or run `/reload-plugins`) to pick it up.

- On its **first start** the plugin downloads the pinned, CI-built release archive, verifies its SHA-256 against the value in [`claude-plugin/launcher.mjs`](claude-plugin/launcher.mjs) (the same value as the release's `SHA256SUMS` file), and installs it with its locked dependencies into the plugin's data folder. This takes about 30 seconds once; later starts take about 2. If `/mcp` reports a failed start the first time, reconnect it there.
- The skill is available as `/vilsem:vilsem-powerbi-visuals`.
- Update with `/plugin marketplace update vilsem-mcp`, then `/plugin update vilsem@vilsem-mcp`.
- If you also added Vilsem manually (below), remove one of them to avoid duplicate tools.

### Manual configuration

All examples use `C:/Users/YOUR_NAME/...`. Replace it with your profile path, or paste the `$server` value printed in step 4. Use forward slashes.

### Claude Code

**Option A — with the `claude` CLI:**

```sh
claude mcp add --scope user --transport stdio vilsem -- node "C:/Users/YOUR_NAME/vilsem-mcp/node_modules/vilsem-mcp/dist/index.js"
claude mcp list
```

`--scope user` makes it available in every project on this machine. Omit it to use the default local (current project) scope.

**`claude` not on PATH?** This is common when Claude Code is used only through the VS Code extension or desktop app. Either run the bundled binary directly:

```powershell
$claude = Get-ChildItem "$env:USERPROFILE\.vscode\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe" | Select-Object -Last 1
& $claude.FullName mcp add --scope user --transport stdio vilsem -- node "C:/Users/YOUR_NAME/vilsem-mcp/node_modules/vilsem-mcp/dist/index.js"
```

or use Option B.

**Option B — without the CLI (edit JSON):**

- *All projects (user scope):* add a **top-level** `mcpServers` key to `%USERPROFILE%\.claude.json`. The file already contains other settings; merge this key in and keep everything else. Close Claude Code before editing so it does not overwrite the file.
- *One project (shared):* create `.mcp.json` in the project root. Claude Code asks you to approve project servers the first time.

The entry is the same in both files:

```json
{
  "mcpServers": {
    "vilsem": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/Users/YOUR_NAME/vilsem-mcp/node_modules/vilsem-mcp/dist/index.js"]
    }
  }
}
```

If `mcpServers` already exists, add only the `"vilsem": {...}` entry inside it. Validate the file afterwards:

```powershell
Get-Content "$env:USERPROFILE\.claude.json" -Raw | ConvertFrom-Json | Select-Object -ExpandProperty mcpServers
```

> **Agents installing this for a user:** prefer Option A. If the CLI is unavailable, do a JSON parse → set `mcpServers.vilsem` → write, with a backup of the original file. Do not hand-build the file with string concatenation or escaped one-liners.

Restart Claude Code (VS Code: **Developer: Reload Window**), then run `/mcp` to confirm `vilsem` is connected. Run the server in Windows for Desktop model discovery; a WSL/container-only server is not the tested Windows ADOMD setup. See [Claude Code's MCP documentation](https://code.claude.com/docs/en/mcp).

### Claude Desktop

Use Claude Desktop's developer **Edit Config** control to open the actual `claude_desktop_config.json`, then merge this entry into `mcpServers`, keeping other servers:

```json
{"mcpServers":{"vilsem":{"command":"node","args":["C:/Users/YOUR_NAME/vilsem-mcp/node_modules/vilsem-mcp/dist/index.js"]}}}
```

Fully quit and reopen Claude, then check that the Vilsem tools appear. This is manual local-server configuration, not a remote connector or an extension. See the [local-server walkthrough](https://modelcontextprotocol.io/docs/develop/connect-local-servers) and [Claude's local MCP overview](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).

### Codex

Add to `~/.codex/config.toml` or a trusted project's `.codex/config.toml`:

```toml
[mcp_servers.vilsem]
command = "node"
args = ["C:/Users/YOUR_NAME/vilsem-mcp/node_modules/vilsem-mcp/dist/index.js"]
startup_timeout_sec = 60
tool_timeout_sec = 600
```

The longer tool timeout accommodates schema profiling and real-data previews on larger models. See the [Codex MCP configuration documentation](https://learn.chatgpt.com/docs/extend/mcp).

### GitHub Copilot (VS Code agent mode)

For VS Code's editor-managed MCP configuration, create `.vscode/mcp.json` in your workspace (or use the user-level MCP configuration). This file uses **`servers`**, not `mcpServers`:

```json
{
  "servers": {
    "vilsem": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/Users/YOUR_NAME/vilsem-mcp/node_modules/vilsem-mcp/dist/index.js"]
    }
  }
}
```

Trust the folder, start the server when VS Code asks, switch Copilot Chat to **Agent** mode, and check that the tools icon lists the Vilsem tools. Ask the agent to call `get_playbook` without arguments before authoring. Copilot does not read MCP resources automatically; the playbook comes through this tool.

Configuration compatibility: newer Copilot harnesses also have a native `.mcp.json` / user `mcp-config.json` format using `mcpServers`. Do not mix that format with `.vscode/mcp.json`. See [Microsoft's MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) for the active harness in your VS Code version.

| Client | Status | Coverage |
| --- | --- | --- |
| Claude Code | Partially tested | Contoso authoring field run. Fresh-install run of 0.9.1 on a blank 10M-row Contoso copy (2026-11-12): install, checksum, playbook, schema, previews with critique, two commits; first-visual close/reopen and later Apply both worked in Desktop. Exhaustive client/version coverage not established. |
| Codex | Partially tested | Recorded Desktop/Service QA workflows; exhaustive coverage not established. |
| Claude Desktop | Not fully tested | Setup documented; full current-version build run pending. |
| GitHub Copilot | Partially tested | 0.8.2 with the auto-selected model (GPT-6 Luna): connected, retrieved the playbook through `get_playbook` (when prompted), previewed before committing and bound model measures. It repeated the close-and-reopen step for later commits; 0.9.0 makes the returned `nextStep` the explicit instruction. |

### Other MCP clients

The client must support local stdio tools and image results. MCP resources are optional; `get_playbook` delivers the playbook through a tool. Use the same `node <server path>` command. Individual clients are not certified here.

### Optional: install the playbook as a native skill

Server instructions tell agents to call `get_playbook` without arguments first, then request on-demand sections. Existing `vilsem://skill/*` resources remain available for clients that can read them. To also install it as a native skill:

```powershell
node "$env:USERPROFILE/vilsem-mcp/node_modules/vilsem-mcp/dist/index.js" install-skill --target claude
node "$env:USERPROFILE/vilsem-mcp/node_modules/vilsem-mcp/dist/index.js" install-skill --target codex
node "$env:USERPROFILE/vilsem-mcp/node_modules/vilsem-mcp/dist/index.js" install-skill --target "C:/Team/agent-skills"
```

- `claude` → `~/.claude/skills/vilsem-powerbi-visuals`; `codex` → `~/.agents/skills/vilsem-powerbi-visuals` ([OpenAI documentation](https://learn.chatgpt.com/docs/build-skills)). Pass an explicit skills-root directory for older clients or custom locations.
- No target defaults to `claude`. With no subcommand, the CLI starts the MCP server.
- Existing skill folders are refused unless `--force` is supplied; force replaces only packaged files and keeps unrelated files. Linked/non-regular destinations are refused.
- No install hook writes into your home directory; only this explicit subcommand does. Skill installation does not configure the MCP connection.

One-shot from the pinned release without a prior install:

```powershell
npx.cmd --yes --package=https://github.com/bcsnpc/vilsem-mcp/releases/download/v0.9.1/vilsem-mcp-0.9.1.tgz vilsem-mcp install-skill --target claude
```

### Alternative: global install from the Git tag

```sh
npm install -g git+https://github.com/bcsnpc/vilsem-mcp.git#v0.9.1
vilsem-mcp
# Or: npx --yes --package=git+https://github.com/bcsnpc/vilsem-mcp.git#v0.9.1 vilsem-mcp
```

The process serves stdio JSON-RPC; diagnostics go to stderr. With a global install, point your client's `command` at `vilsem-mcp` instead of `node <path>`.

## First test: generate a new visual from scratch

Replace the path and analytical request, then send this to your agent:

```text
Use the vilsem MCP with my open test report:
C:/Reports/MyTest/MyTest.Report

Connect using this report's binding and inspect get_schema. Author a NEW
.vilsem-visual.json specification from scratch for a useful category-versus-
measure visual using actual fields from this model. Do not reuse a shipped
template or copy example business values. Explain the chosen grain and units.
Run validate_spec, explain_visual and preview_visual with real data. Inspect
and improve the result. Use list_pages to choose the existing test page and
avoid overlapping its visuals. Then commit the new Vilsem visual, read it back
and run validate_visuals. Preserve the model, native visuals and manual format
settings. Tell me when to accept reload/reopen and what to check in Desktop.
```

More prompts — trends with prior periods, dual-axis visuals, full pages, formatting edits, hierarchies, Sankey and custom geometry — are in the [prompt cookbook](docs/author-from-scratch.md). Replace only the marked placeholders and use fields from `get_schema`; no prompt relies on QA table names, a fixed Desktop port or embedded business values.

## Measures: prototype vs publish

A Vilsem spec can declare **visual-scoped measures** (`spec.measures`). They are ideal for iterating, because they need no model change and no Desktop reload. But once committed, Power BI stores them as report-level extensions on the visual, and that has consequences:

| Where the report is used | Visual-scoped measures | Model measures |
| --- | --- | --- |
| Desktop and Power BI Service (signed in) | Works | Works |
| Build pane field wells | **Empty** for those fields | Shown normally |
| **Publish to web (public embed)** | **Fails** with `PowerBIAnonymousExtensionSchemaException` on every affected visual | Works |
| Reuse in other visuals / by other authors | Not reusable | Reusable |

**Recommended practice:**

1. **Prototype** with `spec.measures` while designing and previewing.
2. **At commit time** (or before publishing), write each measure into a model measures table and bind the visual to the model measure (`Measure` field, not `NativeMeasure`). Do this in the same step, so nothing has to be reworked later.
3. Vilsem itself never writes the model. The agent adds the measures to the model's TMDL (with the user's agreement) or uses the Power BI Modeling MCP. Model changes need a Desktop **close and reopen** to load, so batch them: one reopen per batch of visuals, not per visual.

Call `get_playbook` with `section:"9a"` (or read `vilsem://skill/powerbi-visuals`, section "Measures for shareable reports") for the exact agent procedure.

## Desktop setup and reload rules

In Desktop, open **File → Options and settings → Options → Preview features**, enable **Detect and reload external PBIP changes**, and restart Desktop. Microsoft documents this preview feature and its limits in [external project editing](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-external-editing). Earlier Desktop versions require a close/reopen after every external change.

### Walkthrough

1. Open your semantic model in Desktop. Prefer `connect_model` with `source:{kind:"report",reportDir:"C:/Reports/MyTest/MyTest.Report"}` to follow the report's binding; otherwise use `source:{kind:"desktop"}` (pass a `port` if more than one model is open). Online models are disabled by default in 0.9.
2. Call `get_schema` and choose existing dimensions/measures, or declare query-only `spec.measures` for prototyping. With scoped measures, pass `connectionId` to validation, explanation and commit as well as preview. Use `run_dax` to verify the data.
3. Call `list_templates`, read `vilsem://docs/spec-format`, then `validate_spec`, `explain_visual` and `preview_visual`. Check the PNG and option before writing.
4. Call `list_pages`, choose a position without overlap, then `commit_visual` with the report folder, page folder name, a new `visualName`, spec, bindings and layout.
5. Reload Desktop (rules below), inspect the rendered result and call `validate_visuals`. Save from Desktop when satisfied.

### Reload rules

| Situation | What to do in Desktop |
| --- | --- |
| Before any external write | **Save** your Desktop work first. |
| First Vilsem visual in a report (`rendererRegistered:true`) | **Close without saving and reopen** the `.pbip`. Renderer registration lives in `report.json`, which Desktop does not live-reload. Alternative: import the bundled renderer in Desktop and save *before* the first commit. |
| New pages added outside Desktop | Try **Apply external changes** first; if the page does not appear, close without saving and reopen. |
| New or changed **model** measures (TMDL) | **Close without saving and reopen.** External-change reload covers report files, not the semantic model. |
| Later visual commits/updates | Accept the **external changes** prompt. |
| Always | Never save stale Desktop state over external changes. |

The bundled renderer is at `<vilsemDir>/node_modules/@vilsem/core/assets/renderer.pbiviz`.

### Experimental: online models (disabled by default)

0.9.x supports local Desktop models only. Fabric, Power BI Service, report `byConnection` and SSAS are disabled before any authentication or connector call. Open the model locally and use `kind:"report"` with a `byPath` report, or `kind:"desktop"`.

For developer investigation only, `VILSEM_ENABLE_ONLINE=1` restores the existing online connector and prints a startup warning. It is **unsupported/experimental** and can authenticate, cache tokens and contact Microsoft or the report endpoint.

**Desktop:** requires Windows and a running Power BI Desktop model. Core identifies the Desktop Analysis Services process and reads its workspace port file. Pass `source.port` if multiple instances are open. ADOMD/XMLA uses your Windows identity; no cloud login is needed. Ports change each time Desktop reopens; never reuse a port from another session.

**Fabric:** configure these environment variables on the MCP server process:

- Service principal: `AUTH_MODE=service_principal`, `FABRIC_TENANT_ID`, `FABRIC_CLIENT_ID`, `FABRIC_CLIENT_SECRET`.
- User login: `AUTH_MODE=device_code` (default). Login instructions go to stderr; complete Microsoft's device-code login in your browser. Only the refresh token is cached under `~/.vilsem/auth/`, scoped to tenant/client/resource, in a 0700 directory and atomic 0600 file. Windows uses the user-profile ACLs; POSIX modes are not Windows ACLs.
- Optional `FABRIC_ACCESS_TOKEN` for an externally supplied short-lived token. Refresh requires another configured credential flow.

No credentials are read from another repository's `.env` or Electron workspace store. Set credentials in your MCP client's server environment. Core also preserves `setInteractiveTokens` for Electron PKCE login. Fabric credentials do not transfer to a new machine.

### Connecting from an existing report binding

`connect_model` with `source:{kind:"report",reportDir:...}` follows the report's `definition.pbir` without changing it:

- `datasetReference.byPath`: core matches the local semantic-model path to an open Desktop session. With **one** Desktop model open this works automatically. With several open, 0.9.1 can fail with `Desktop must expose exactly one model` (or `Multiple Desktop models are open; specify source.port`); close the other reports, or connect with `source:{kind:"desktop",port:<port>}` using the port finder below. Automatic matching with several windows open is tracked for 0.9.2. With Desktop closed it reads the local TMDL or BIM definitions and returns `schemaOnly:true`. Schema-only connections cannot run DAX or preview live values; open the model and reconnect.
- `datasetReference.byConnection`: **disabled by default in 0.9**. With the unsupported `VILSEM_ENABLE_ONLINE=1` override, a Power BI XMLA URL identifies the workspace and semantic model. Core resolves them through the configured Fabric credentials. It does not try to discover a local Desktop port. The identity needs access to list the workspace and model, execute queries and inspect its definition. Windows-integrated SSAS bindings use the local ADOMD bridge and Windows identity; cloud credentials are never forwarded to arbitrary servers.

**Find the port of an open Desktop model** (the most recently opened report is listed first):

```powershell
Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Power BI Desktop\AnalysisServicesWorkspaces","$env:USERPROFILE\Microsoft\Power BI Desktop Store App\AnalysisServicesWorkspaces" -Directory -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | ForEach-Object {
    $f = Join-Path $_.FullName 'Data\msmdsrv.port.txt'
    if (Test-Path $f) { '{0}  opened {1}' -f (Get-Content $f -Encoding Unicode -Raw).Trim(), $_.LastWriteTime }
  }
```

Old workspace folders can remain after Desktop closes; if a port refuses the connection, try the next one. Ports change every time Desktop reopens.

Quoted connection-string values are supported. Passwords and impersonation settings embedded in the report are ignored; configure authentication on the MCP server. Missing or ambiguous targets fail explicitly. `commit_visual` writes only the Vilsem visual in the selected local report; it does not change the binding, semantic model, native visuals or report policies.

## Agent workflow

Until a session successfully calls `get_playbook`, results of `connect_model`, `get_schema`, `preview_visual`, `preview_variants` and `commit_visual` include a `playbookHint`. It does not block the tool.

`run_dax` only accepts DAX queries starting with EVALUATE/DEFINE; DAX queries cannot modify the model. XMLA/TMSL commands are rejected. Leading `--`, `//` and block comments are supported without altering quoted strings.

`connect_model` → `get_schema` → `design_visual` prompt → `validate_spec` → `explain_visual` → `preview_visual` with critique → compare variants/iterate → `list_pages` → `commit_visual` → Desktop reload and native checks. **Never commit without a preview.** Read `vilsem://docs/design-guide` and `vilsem://docs/workflow`.

For edits: `list_visuals` → `read_visual` → `update_visual(dryRun:true)` → inspect before/after and confirm when not already authorized → `update_visual(dryRun:false, etag)` → reload and verify. The report folder is the source of truth. Manual format-pane values win over authored formatting and survive updates unless `resetFormatting:true` is explicit.

## Tools and resources

**Tools (20):** `get_playbook`, `connect_model`, `get_schema`, `run_dax`, `list_templates`, `save_template`, `delete_template`, `validate_spec`, `explain_visual`, `preview_visual`, `preview_variants`, `list_pages`, `list_visuals`, `read_visual`, `diff_visual`, `update_visual`, `commit_visual`, `validate_visuals`, `extract_design_tokens`, `compare_preview`.
**Prompt:** `design_visual`.
**Resources:** `vilsem://skill/*`, `vilsem://templates/<template-id>`, `vilsem://docs/spec-format`, `vilsem://docs/design-guide`, `vilsem://docs/workflow`, `vilsem://docs/expression-language`.

- **get_playbook** is read-only and offline. No arguments returns a compact core plus an index. Fetch `9a`, `commit`, `edit`, `known-issues`, `gotchas`, `pbir-pages`, `cookbook:<slug>` or `art:<slug>` as needed. `cookbook` and `art` list available patterns; `all` returns the complete skill. Sections are read from packaged Markdown at runtime. The four skill resources remain available, including `vilsem://skill/data-art-recipes`.
- **get_schema** supports `samples:false` or the `VILSEM_SCHEMA_SAMPLES=0` environment default to omit column samples while preserving counts/ranges. It defaults to summary (no expressions or relationship graph); use `full` for business calculation and join semantics. Exact cardinality/BLANK share/ranges are cached for 60 seconds with at most 10 samples. Full profiling of large models can take minutes; prefer targeted `run_dax`. Permission/provider failures are explicit; internal engine row identities are skipped. `page`/`reportDir` adds read-only page query bindings without editing or validating native visuals.
- **Preview critique** checks measured SVG text bounds, ellipses, axis rotation, categorical palette size, null/zero series, empty required slots, missing formats, page-background text contrast, legend/plot intersections, pie slice count and dual-axis review, with actionable paths/fixes and explicit coverage limits. It is not analytical correctness, accessibility or host-interaction certification.
- **preview_variants** makes one identical data query for up to 4 candidate specs and returns compact results; scoped definitions must match. Prefer it to `preview_visual` when you don't need the full option JSON, which can be very large.
- **read_visual** returns the migrated spec, bindings, pane objects, layout, source-version provenance, etag and live PNG. **diff_visual** is read-only.
- **update_visual** accepts RFC 6902 operations, defaults to dry run, protects identity/prototype/version paths and checks intervening file changes. It preserves field queries for styling-only edits and refuses implicit rebinding. A legacy inline measure with no stored owning-table metadata returns `table:null`.
- **list_pages** reads all visual positions to help avoid overlap. **validate_visuals** examines only the stable Vilsem Renderer GUID. **commit_visual** adds one new visual, rejects collisions and updates only missing renderer resources/registration; it does not rebuild or serialize other report content.
- **list_templates** output is very large; save it to a file and extract `meta.id`, `meta.description` and `slots` with a script.

Commits always return `nextStep`: relay it verbatim. First renderer registration requires closing Desktop **without saving** and reopening the `.pbip`; later commits and non-dry-run updates require **Apply external changes**. `measureWarning` lists visual-scoped measures when present. `validate_visuals` returns its existing results array as the first text block, now with `nativeMeasures` on each visual; a second JSON text block contains `summary` (`visualCount`, `visualsWithNativeMeasures`, `nativeMeasureCount`). Counts cover Vilsem visuals only; no model changes are performed.

[Contoso reference examples](docs/examples/contoso/) and [data-art recipes](skills/vilsem-powerbi-visuals/references/data-art-recipes.md) are model-specific examples, not `list_templates` entries. Adapt bindings and calculations to your own schema. Native skill installation copies five skill files; the example JSON files stay in the installed MCP package's `docs/examples/contoso/`.

### Interactions

Rendered Vilsem ECharts visuals cross-filter through Power BI selection IDs, accept cross-highlights, support drill-through/context-menu requests, native tooltips and bookmark selection restoration. Those host contracts have automated harness tests. Availability depends on bound field identities and report configuration; report-page tooltips, drill-through destinations and bookmarks need testing in the actual report. A PNG preview does not verify interactions. DOM-adapter visuals and every template transform have not been certified for interaction parity.

### What this does NOT do

- Create, edit or validate native Power BI visuals.
- Create pages, slicers, filters, bookmarks or themes (the agent can create pages by editing PBIR; call `get_playbook` section `pbir-pages`, or read `vilsem://skill/pbir-pages`).
- Change semantic models or model metadata. To persist measures, the agent edits TMDL with the user's agreement or uses Microsoft's Power BI Modeling MCP — see [Measures: prototype vs publish](#measures-prototype-vs-publish).
- Read or write PBIX files. Existing enhanced PBIR report folders are required.

Headless previews support the core ECharts composition types and declarative templates. DOM-adapter visual types are rejected rather than emitted as empty or substituted charts. Previews render chart marks and option; renderer-owned card chrome/title headers and existing report-level filters are not replayed. Fonts can differ between server PNGs and Desktop. Preview queries and arbitrary DAX default to 200 rows and accept `maxRows` up to 10,000. Desktop's categorical host reduction is 2,000 rows.

## Current report and visual limitations

**Local Desktop models only in 0.9.** Online models are disabled by default. See the experimental section above.

This table describes **MCP 0.9.1 with core 0.8.1 / renderer 4.44**. A tool PASS or saved `visual.json` is not evidence that every report, visual state or Power BI target works.

| Area | Current boundary / what to check |
| --- | --- |
| Report files | Requires an existing enhanced PBIR `.Report` folder with `definition/pages/`. Does not read/write PBIX, create reports/pages, or edit a report directly in Power BI Service. |
| Scope | Authors/edits Vilsem Renderer visuals only. `list_pages` is read-only; `validate_visuals` leaves native objects unreported. |
| Local Desktop models only in 0.9 | Fabric/Service, `byConnection` and SSAS are disabled by default. `VILSEM_ENABLE_ONLINE=1` is an unsupported experimental override. |
| Model access | Desktop mode requires Windows, an accessible open model and local ADOMD. Offline local bindings can return `schemaOnly:true`, which cannot supply live previews. Online connections are disabled by default; the escape hatch is unsupported. |
| Preview data coverage | Query/preview defaults are 200 rows, configurable to 10,000; existing-visual edit previews use 1,000. Reaching a cap is not proof of complete data. Desktop's categorical reduction is 2,000 rows. Never infer population totals/statistics from an incomplete window. |
| Filter context | A standalone preview does not replay the report's slicers, page/report filters or selections. Compare numbers only at matching grain and filter context. |
| Calculations | Ratios, distinct counts, time intelligence and totals must be evaluated at the intended grain. Summing displayed ratios/distinct counts is generally incorrect. Use model measures or validated `spec.measures`. |
| Visual-scoped measures | Not shown in the Build pane field wells and **fail under Publish to web**. Promote to model measures before publishing (see [Measures](#measures-prototype-vs-publish)). |
| Formatting and fonts | Model-format conversion is a bounded subset. Manual format-pane values override authored defaults and survive edits unless explicitly reset. Arbitrary report-font inheritance in Desktop is unverified. |
| Expressiveness | Closed JSON templates/expression AST only; no arbitrary JavaScript or callbacks. Unshipped map/geo assets, 3D and exact area-proportional Euler fitting are unsupported. Venn circles are schematic. |
| Interactions | Native selection/highlight/tooltip/context-menu/bookmark routes exist with harness coverage but depend on report configuration and source identities. End-to-end native gestures, bookmarks and all transform combinations are not signed off. |
| Cross-target fidelity | Current commits/previews do not certify Desktop, Service, embedded/Fabric, PDF or subscriptions. No guarantee every state is pixel-identical across hosts. |
| Performance | The 5,000-point animated frame-rate target **FAILS**: canvas measured roughly 9–12 fps in the recorded actual-bundle run (not 57+ fps); SVG roughly 4 fps. This is not a Power BI host benchmark. Test realistic sizes on your machine. |
| Existing renderer/schema | A spec can require a newer renderer; older registered resources are refused rather than silently replaced. Some newer 2.x container declarations pass the known 2.7 field contract with a compatibility warning. Do not change GUID/schema tags to bypass guards. |
| Reload and recovery | Save Desktop changes before external edits; follow the [reload rules](#reload-rules). Stale Desktop saves can overwrite external work. Edits use ETags/locks, but Desktop does not honor MCP's lock. Test on a copy. |
| Distribution and acceptance | Evaluation prereleases. Desktop 4.43 manual upgrade and three real-data layouts were checked; Service comparison pages at browser 100%/150% were checked. Full native interactions and Windows scaling remain incomplete. No signed app installer is included. |

For this release, see [skill and renderer verification](docs/qa/skill-renderer-080.md). For earlier evidence, see the [Round 3 QA follow-up](https://github.com/bcsnpc/vilsem/blob/main/docs/qa/stress3/round3-follow-up.md) and [native interaction checklist](https://github.com/bcsnpc/vilsem/blob/main/docs/qa/stress3/native-interaction-checklist.md). When a test cannot run, record **Not tested / Blocked**, not PASS.

### What was verified for 0.8

Evidence is scoped to the tested builds and QA reports on one Windows laptop, as of **November 6, 2026**. A browser fixture is not Power BI; browser zoom is not Windows display scaling.

| Check | Status | What the evidence establishes |
| --- | --- | --- |
| App/core regression suites | Tested | 1,367 tests passed in each private/public app-core checkout, across 118 files. Not an exhaustive visual/host acceptance matrix. |
| MCP regression suite | Tested | 338 tests passed across 17 files against the public core 0.8 archive. The 20 packaged-renderer browser tests are a subset. |
| Native renderer builds | Tested | Both native builds succeeded; packaged JavaScript/CSS hashes match. GUID and `semantica.primitiveSpec` preserved. |
| Fresh public package | Tested | Public archive SHA matched; installation, stdio, three skill resources, opt-in skill CLI, overwrite refusal/force and unrelated-file retention passed. npm install left home skill folders unchanged; the isolated dependency set reported npm audit 0. |
| Actual agent client | Tested, limited | A fresh Claude Code session received initialization instructions and read all three skill resources. Not every client UI version, OS or permission setup. |
| Desktop renderer upgrade | Tested, limited | Imported 4.43 over 4.42, saved, closed and reopened an owned QA report. Hero, leaderboard and calendar rendered real values; SVG calendar mode/zoom/context menu and a canvas native tooltip were observed. |
| Service layouts and browser zoom | Tested, limited | Hero, leaderboard and calendar in canvas and SVG at Edge zoom 100% and 150%: 12 inspections, no blank/error visual or obvious escape. |
| Numeric reconciliation | Tested, limited | Hero total and all four leaderboard values matched a separate live DAX query. Calendar's 45 cells were not individually reconciled. |
| Service interactions | Partially tested | Leaderboard painters selected/dimmed marks, cleared on blank click, showed native tooltips and opened Include/Exclude menus. Menu actions, drill-through and cross-filtering to native visuals not verified. |
| Ordinary chart animation | Tested, limited | Bar, yearly line, donut and scatter had browser motion previews; Service page re-entry replayed entrances. Not all-series/all-state certification. |
| Timeline animation | Tested, limited | An annual bar/donut/line QA page advanced through real 2020–2026 values with playback controls. Long playback, every race transform and bookmark state not certified. |
| Model preservation | Tested, limited | No model-write operations were used; all 21 baseline model files remained byte-identical. |
| Publish to web | Field report | Reports whose Vilsem visuals bind **model** measures rendered in a public embed; visual-scoped measures failed with `PowerBIAnonymousExtensionSchemaException`. |

See [release evidence and live follow-up](docs/qa/skill-renderer-080.md) and [the core QA record](https://github.com/bcsnpc/vilsem/blob/main/docs/qa/skill-sharpness-080.md).

### Known failures and workarounds

| Issue | Current result | Practical guidance |
| --- | --- | --- |
| Dense animated charts | **FAIL:** 5,000-point smooth animation not met. One run: 4.42 canvas 11.84 fps, 4.43 canvas 9.07, 4.43 SVG 4.11 (browser RAF, not Service). | Test realistic sizes. Aggregate or use a smaller disclosed window. Do not silently drop points or disable requested motion. |
| Canvas text at small Fit-to-page sizes | **Partially improved:** zoom-aware density implemented, but tiny canvas labels still looked soft in Service. | For text-heavy layouts, try SVG or larger chart/text sizes. Browser zoom alone does not enlarge chart labels. |
| Summary Label formatting | **Open:** `lastLabel`, `sumLabel`, `deltaPctLabel` ignore measure formats. | Use an explicit formatter, a formatted data/axis label, or the hidden-gauge workaround in [the cookbook](skills/vilsem-powerbi-visuals/references/spec-cookbook.md). |
| Publish to web shows errors on every Vilsem visual | Visual-scoped measures are report extensions, unsupported for anonymous embed. | Promote measures to the model and rebind; republish. See [Measures](#measures-prototype-vs-publish). |
| Build pane shows no fields for a Vilsem visual | Same cause: visual-scoped measures. | Same fix. |
| Existing report keeps old renderer | Intentional; installing MCP/core does not upgrade registered report resources. | Import bundled `renderer.pbiviz`, accept Update, save, close and reopen. See [upgrade steps](#upgrading-an-existing-report). |
| Canvas-only effects under SVG | Explicit fallback to canvas with a warning. | Remove unsupported blending/trail effects if SVG is essential. |

### Checks that remain partial or not tested

These are **open acceptance items**, not implied passes:

| Area | What still needs checking |
| --- | --- |
| Complete visual inventory | Every composition, template and expression visual in every state, on every target. |
| Formatting controls | Every exposed property on every visual, including manual-pane precedence/reset. |
| Data and clipping | Empty/null/zero/negative/extreme/duplicate/Unicode/long-label/high-cardinality data, tiny containers, extreme aspect ratios, large fonts, tooltip edge placement. |
| Native/report interactions | Full custom↔native filter/highlight matrix, slicers, physical Ctrl-click, deselection/reset, aggregated mark provenance. |
| Context menus and drill-through | Include/Exclude results and configured drill-through/report-page tooltip destinations. |
| Bookmarks and recovery | Bookmark data state, save/reopen, timeline/pause state, undo/recovery, concurrent Desktop/external editing. |
| Scaling and timing | Windows display scaling beside native visuals, multiple DPIs, native zoom recovery, long resize sessions. |
| Animation | Every series/effect in both painters, reduced-motion in actual hosts, hidden-tab pause/resume, frame-rate budgets. |
| Other output targets | Embedded/Fabric app runtime, standalone web, PDF/PowerPoint/image export, subscriptions, printing. |
| Clients and environments | End-to-end authoring in every Claude/Codex client, other laptops/OSes, tenant policies, proxies, locked-down installs. |
| Distribution/security | Full app dependency remediation, signed installer, Power BI certification, complete security/accessibility review. |

### Acceptance checklist for your own report

1. Work on a recoverable copy; preserve its report/model folder structure. Save Desktop work before external writes and follow the reload rules.
2. Discover actual fields; run DAX at the intended grain/filter context. Compare preview and host values, including totals, ratios and distinct counts.
3. Validate the spec, inspect the real-data preview and critique, commit to an existing page, then reload the actual report.
4. Check the visual in its intended painter, at normal and extreme sizes, with long labels, empty/filter states and real data volume.
5. Test beside a native visual and slicer: filter/highlight both ways, multi-select/clear, tooltips, context actions, bookmarks.
6. Promote any visual-scoped measures to the model before sharing; then test the actual deployment target (Service, Publish to web, export). A successful upload or PNG is not final acceptance.
7. Record **Tested**, **Partially tested**, **Not tested**, **Blocked** or **Fail**, with versions, platform, data/filter context and evidence.

## Rendering: canvas, SVG and animation

Canvas and SVG are **drawing modes for the same visual**, not different visual types. **Canvas is the default** and generally better for dense or heavily animated scenes. SVG can keep text and fine lines sharper under zoom; dense scenes may be slower.

In Power BI, select a Vilsem visual, then **Format visual > Appearance > Render mode** (renderer 4.43+):

| Setting | Behavior |
| --- | --- |
| Automatic (spec) | Uses `config.renderer` if authored; otherwise canvas. |
| Canvas | Explicit override to canvas. |
| SVG | Requests SVG; canvas-only effects can trigger an explicit fallback. |

Renderer 4.43 accounts for Power BI page zoom in the canvas backing store, clamps the effective pixel ratio to 1–4, and debounces surface recreation. Manually saved pane values override authored defaults; reset that override if a prompt change seems ineffective.

Ordinary charts can animate their **entrance and data updates** without a race. Declarative `template.animation` requires `template.meta.formatVersion:4`; use the contracts in `vilsem://docs/spec-format`. Timeline/race animation changes the displayed period and has playback controls. Animations respect reduced-motion settings; static previews and exports do not prove live motion.

### Upgrading an existing report

Save Desktop work first. With no pending external changes, use **Home > More visuals > From my files**, select `<vilsemDir>/node_modules/@vilsem/core/assets/renderer.pbiviz`, accept **Update**, then save, close and reopen. The GUID and `objects.semantica.primitiveSpec` stay unchanged. `commit_visual` intentionally preserves a registered renderer; installing a new MCP/core package alone does not upgrade old reports.

### Theme, formatting and preview locale

- Visual backgrounds default to transparent and use the report/host foreground and palette. `canvasTheme` is an explicit override. `preview_visual` accepts `theme:"report"|"light"|"dark"|<theme JSON>`; a supplied `reportDir` selects the referenced registered theme.
- Directly bound model and query-scoped measure formats apply to labels, value axes and native tooltips. Percent, grouping, currency, decimal precision, comma scaling and date patterns use a bounded converter — a supported subset, not every conditional/scientific/dynamic format.
- Derived counts, densities, coordinates and ratios need an authored formatter when units change.
- Desktop uses the host viewer locale. Previews default to `locale:"en-US"`; pass the viewer locale (e.g. `"en-IN"`, `"de-DE"`) to match separators and month names.
- Contrast feedback uses 4.5 for normal text and 3 for text estimated at 24 px or larger, informed by [W3C guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). It is review assistance, not a WCAG compliance result.

## Editable specifications and governance

- New commits carry `specVersion` 0.7; readers migrate specs from 0.1 onward. `version:1` remains the separate wire envelope. Migrations are pure, forward-only and tested; unknown future versions are rejected.
- The 0.7 shared formatting contract has 71 properties (theme/background, animation/reduce motion, title, chart text, palette, labels, legend, axes, lines, border). Desktop pane objects override only the corresponding properties. Legacy DOM adapters expose only Appearance, Title and Border.
- Queries and committed bindings use their connecting/viewing identities; Power BI owns RLS, workspace access, sensitivity labels, report filters and refresh.
- The write flow stores bindings and specifications, not model rows. Author literals are possible in JSON, so review specs before sharing. The spec lives in PBIR and can be versioned with the report in git.
- The template library uses OS user data, or an approved shared `VILSEM_TEMPLATES_DIR` folder.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `claude: command not found` | Use the bundled `claude.exe` or the JSON method in [Claude Code](#claude-code). |
| Vilsem tools missing in the agent | Check the server path exists (`Test-Path`), restart/reload the client, run `/mcp` (Claude Code). Use the full `node.exe` path if `node` is not found. |
| `npm` fails in PowerShell | Use `npm.cmd`. |
| `schemaOnly:true` / previews have no data | Open the model in Desktop and reconnect with `kind:"desktop"` (and `port`). |
| "A connection cannot be made" | Desktop was reopened and its port changed; reconnect. Old `connectionId`s are dead. |
| `Desktop must expose exactly one model` / `Multiple Desktop models are open; specify source.port` | Several Desktop windows are open. Close the other reports, or connect with `kind:"desktop"` and the port from the [port finder](#connecting-from-an-existing-report-binding). |
| `get_schema` takes minutes or the client times out | Column profiling on a large model (about 110 s on 10M rows). Raise the client's tool timeout (Codex: `tool_timeout_sec`; Claude Code: `MCP_TOOL_TIMEOUT` in milliseconds) and let the agent probe with targeted `run_dax`. A faster no-profiling mode is planned for 0.9.2. |
| Agent context fills up after `list_templates` | Its output is about 550 KB. Ask the agent to author from `get_schema` instead, or to save the output to a file and read only ids and descriptions. A compact list is planned for 0.9.2. |
| Label on a `[value, category]` point shows the category | Use `{value.0}` (or `{value.0:percent}`) in `formatterTemplate` to pick the numeric part of the pair. |
| "To see this custom visual, add it to this report first" | First Vilsem visual: close without saving and reopen the `.pbip`. |
| Visual blurry in Desktop | Upgrade the report's renderer to 4.43 or later; try SVG render mode for text-heavy visuals. |
| Publish to web: `PowerBIAnonymousExtensionSchemaException` | Visual-scoped measures. Promote to model measures and republish. |
| Build pane shows no fields | Same cause and fix. |
| Python crashes printing template metadata | Set `PYTHONIOENCODING=utf-8`. |
| Renderer-version refusal | Upgrade the registered renderer; do not change its GUID. |
| Custom visuals blocked | An administrator policy may restrict custom visuals; use the approved policy rather than bypassing it. |

## Development and verification

Use `npm ci` for the exact tested dependency tree in `npm-shrinkwrap.json`. `npm-shrinkwrap.json` ships in the tarball and includes integrity hashes for the core archive and transitive dependencies. Releases are built and attested by [.github/workflows/release.yml](.github/workflows/release.yml) from approved `v*` tags on main; do not upload laptop-built release archives. Verify provenance with `gh attestation verify ./vilsem-mcp-0.9.1.tgz --repo bcsnpc/vilsem-mcp` as well as checking SHA256SUMS.

CI runs Windows/Node 24 build/tests/npm audit plus Linux OSV and Semgrep scans; the latter Docker tools require Linux runners. Actions use commit SHA pins. Browser tests run with the runner's installed Chrome/Edge, and exact skipped test names are reported when the browser or optional Playwright is unavailable.

Clone the repository, run `npm install` (its `prepare` step builds the server), then `npm run build` and `npm test`. Tests cover spec resolution, deterministic SVG/PNG rendering, custom-only PBIR insertion/validation and a real stdio client/server round trip. Live Fabric credentials, Desktop query access, reload prompts and host interactions need environment-backed acceptance.

**Claude packaging.**
- `node scripts/build-mcpb.mjs` (after `npm run build`) stages the built server with `npm ci --omit=dev --ignore-scripts`, lists the tools from the staged server into `manifest.json` (template: [`mcpb/manifest.template.json`](mcpb/manifest.template.json)) and packs `artifacts/vilsem-mcp-<version>.mcpb` with the pinned `@anthropic-ai/mcpb` CLI. The release workflow runs it and checksums and attests the bundle.
- The Claude Code plugin lives in [`claude-plugin/`](claude-plugin/), listed by [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json). Its skill is an exact copy of `skills/vilsem-powerbi-visuals`: run `node scripts/sync-plugin-skill.mjs` after editing the skill (tests fail if the copies differ).
- **Release checklist:** after CI publishes `vX.Y.Z`, update `VERSION` and `SHA256` in `claude-plugin/launcher.mjs`, `version` in `claude-plugin/.claude-plugin/plugin.json` and the version in `claude-plugin/README.md` to the new release, taking the hash from its `SHA256SUMS` file, and merge that as a follow-up. Plugin users stay on the previous verified release until then.

This release depends on the immutable public `core-v0.8.1` release tarball. For local core development only, install a locally packed core tarball; restore the public release URL before distributing.

- `npm run thumbnails` rebuilds the shipped light-theme example PNGs from synthetic fixtures; `node scripts/render-thumbnails.mjs --dark` checks the dark background. Each theme directory under `templates/thumbnails/` includes a manifest with source/PNG hashes.
- Motion benchmark: `npm run build` then `node scripts/benchmark-motion.mjs`. It launches only an owned sandboxed headless browser, queries no model, keeps 5,000 points and animation enabled, and writes `test-results/benchmarks/motion-options.json`. Exit code 1 means the 57 fps / 20 ms p95 tolerance was not met. Not a Power BI host benchmark.

For an independent test, follow [author a visual from scratch](docs/author-from-scratch.md).

## Release history

**0.9.1** — Depends on **core 0.8.1 / renderer 4.44** (security Part 2): the renderer sanitizes the legacy raw-HTML measure fallback with an explicit allowlist (no scripts, event handlers, frames or navigation/resource markup), and the local Desktop bridge loads ADOMD only from the official Power BI Desktop package or its standard Program Files install. GUID, spec format and tools unchanged. Release checksum files now use LF endings so `sha256sum -c` works on Linux/macOS. **Existing reports keep their registered renderer:** to get the renderer fix, [re-import the bundled renderer](#upgrading-an-existing-report) (accept Update, save, close and reopen). New reports get 4.44 on their first `commit_visual`. Live check: all 20 visuals of a 5-page report rendered and cross-filtered on 4.44 in Desktop.

**0.9.0** — Local Desktop models only by default; online connectors require the unsupported `VILSEM_ENABLE_ONLINE=1` escape hatch. Network-path rejection, schema sample opt-out, read-only DAX comment handling, optional lazy Playwright, locked dependencies, CI scanners and CI-built releases with provenance/checksums. Tool results nudge agents to fetch the playbook; recipes use model-neutral placeholders; guidance reinforces exact reload steps, readable sizing and compact units applied once. Core 0.8.0 / renderer 4.43 unchanged; Part 2 hardening remains separate. See [verification and owner steps](docs/qa/security-local-090.md).

**0.8.2** — Adds `get_playbook` so clients without MCP resource support (e.g. GitHub Copilot) receive the playbook; compact core + on-demand sections. Explicit commit/reload and visual-scoped-measure guidance, validation counts, Copilot setup, and Contoso cookbook/data-art lessons. Core 0.8.0 / renderer 4.43 unchanged. See [verification and remaining manual checks](docs/qa/playbook-082.md).

**0.8.1** — documentation and skill update; no runtime, renderer or spec-format changes (core 0.8.0 / renderer 4.43 unchanged). Clearer install guide, including Claude Code setup without the `claude` CLI and download checksum verification. The skill now steers shareable reports toward **model measures** instead of visual-scoped measures, which fail under Publish to web and hide fields in the Build pane (new section 9a), and bundles `scripts/promote-measures.py` to move existing visual-scoped measures into the model. 344/344 tests pass.

<details>
<summary>0.7.x — expression language, motion, templates, viewport panels, container declarations</summary>

**0.7 (Group C prerelease).** Bounded expression series language, declarative race/timeline motion, reusable user/shared template memory and image-statistics reference workflows. Expression `renderItem` is a closed JSON AST sharing one bounded interpreter between renderer and previews. The 11 former (c) visual families have real-model tool passes, including weighted Voronoi. `preview_visual` `motion:auto` can capture enter/stagger/timeline animation in a fresh headless Chrome/Edge/Chromium profile with a controlled clock and blocked network; `motion:states` avoids a browser launch; APNG ≤ 3 seconds / 2 MiB. See `docs/motion-capture.md`. The real-clock 5,000-point probes missed 60 fps (about 25 fps headless). Native gestures, motion/export acceptance and the final currency-axis native recheck remained UNVERIFIED. Renderer 4.40 completes hidden Sankey entry clips and includes exact-group context-menu fixes. See the [verification ledger](https://github.com/bcsnpc/vilsem/blob/main/docs/qa/stress3/candidate-verification.md).

**0.7.1.** `viewportWidth` and `viewportHeight` expression operations for resize-aware panels (renderer 4.41). 300/300 MCP tests; 1,355 app-core tests each; fresh archive install with audit 0, SDK handshake, 19 tools / 1 prompt. Benchmark still failing: canvas 11.22 fps, dirty-rectangle 12.52, SVG 8.62 vs idle 60.42.

**0.7.2.** Axis-label/name contrast fix for light reference cards in dark reports; core 0.7.2 / renderer 4.42 preserves authored opacity for silent annotation leaves during selection. 303/303 MCP tests; 1,357 app-core tests each. Static viewport decorations no longer produce phantom zero-measure feedback.

**0.7.3.** Desktop can save visuals with a newer 2.x schema declaration. Read/edit/validation preserve it; payloads are accepted only when their full field structure passes the bundled 2.7 contract, with an explicit diagnostic. New commits keep the vendored 2.7 schema.
</details>

<details>
<summary>0.6 and earlier — stable line, stress rounds, original examples</summary>

**0.6.** Core 0.6.0 / renderer 4.35. Existing reports keep the same GUID and `primitiveSpec` property; new features enforce renderer version floors. `list_templates` includes `exampleSpec`. Verification: [Round 3 Group B log](https://github.com/bcsnpc/vilsem/blob/main/docs/qa/stress3/group-b-status.md). Final native Sankey/manual-pane acceptance was UNVERIFIED.

**0.5 native verification limits.** Light/dark rendering, percentage tooltips, currency labels and treemap headers checked against an owned AdventureWorks QA report. Physical Ctrl-click and the stale-selection-to-slicer transition still need manual verification.

**PNG typography.** The PNG worker expands ECharts pixel-font shorthand to CSS longhand before rasterizing ([resvg-js #404](https://github.com/thx/resvg-js/issues/404)). Default treemap labels choose black/white text from the actual opaque node fill.

**0.4.0 (stress round 2).** 111 freshly authored stress examples passed validate/explain/preview/commit and Desktop inspection at 900×600; nine capabilities remain explicit refusals. See the [120-case results](https://github.com/bcsnpc/vilsem/blob/main/docs/qa/stress2/results.md) and [format additions](https://github.com/bcsnpc/vilsem/blob/main/docs/qa/stress2/format-additions.md). Failed probes are kept under `docs/expressiveness/`.

**0.3.0.** Nine standalone `.vilsem-visual.json` specs in `templates/`: Sankey, Gantt, running-total waterfall, sunburst, bullet, radial progress, dual-axis reference measures, facets and a relationship network. Core 0.3.0 / renderer 4.14.2.0+. See the [expressiveness report](docs/expressiveness-gaps.md).
</details>
