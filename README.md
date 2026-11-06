# vilsem-mcp

Any visual, from a chat, into your existing Power BI report, with real data, with no executable code in the report.

vilsem-mcp doesn't make charts - Claude Code and Codex make charts; vilsem-mcp gives them your model, real data, eyes, and a safe pen. The MCP contains no model and needs no LLM API key. The calling agent's own service/account may have its own costs.

This is the custom-visual layer for agentic Power BI authoring. Use it alongside Microsoft's Power BI Report skill for native visuals and the Power BI Modeling MCP for model changes. The shared, installed renderer executes trusted application code; the authored spec is declarative JSON, not executable source.

## Why not just ask Claude Code / Codex directly?

For a custom visual outside Power BI's native catalog:

| Work | Agent without this custom-visual layer | With vilsem-mcp |
| --- | --- | --- |
| Understand the model | Find a connector, inspect fields and recover calculation context | get_schema summary/full with calculations, statistics and relationship context |
| Choose an analytical design | Work out question, grain, units and alternatives | Still the agent's decision; design_visual and design-guide supply a structured brief |
| Use real numbers | Implement a query bridge and field normalization | Read-only Desktop/Fabric DAX and actual field bindings |
| See and improve a draft | Build a renderer and screenshot pipeline | preview_visual, critique and shared-data preview_variants |
| Put it in a report | Implement/package/import a custom visual and configure queries | commit_visual writes one supported custom visual and missing renderer registration |
| Edit the visual a month later, in a new chat | Find the old source/chat, re-explain, rebuild, repackage, re-import and rebind | Read the report's spec: "make the Sankey labels bigger"; preview a small patch |
| What runs inside the report | Each separately authored compiled visual's implementation | One shared renderer plus plain declarative specifications |
| Security review | Review each executable implementation and its dependencies | Review the shared renderer/dependencies and the bounded format; report policies still apply |

The comparison does not imply native Power BI visuals require custom coding. Microsoft's companion Report skill handles those.

## Three authoring layers

1. **Composition:** a supported chart type and configuration; the smallest spec and maintenance cost.
2. **Template:** ECharts structure, declared slots, parameters and bounded transforms; more control, with explicit layout and unit responsibilities.
3. **Expression series (0.7 prerelease):** a closed JSON AST describes bounded custom geometry. One trusted interpreter runs it in previews and the renderer; arbitrary renderItem/JavaScript remains refused. See `vilsem://docs/expression-language` for operations, limits and security boundaries.

## Agent workflow

connect_model -> get_schema -> design_visual prompt -> validate_spec -> explain_visual -> preview_visual with critique -> compare variants/iterate -> list_pages -> commit_visual -> Desktop reload and native checks. **Never commit without a preview.** Read vilsem://docs/design-guide and vilsem://docs/workflow.

For edits: list_visuals -> read_visual -> update_visual(dryRun:true) -> inspect before/after and confirm when not already authorized -> update_visual(dryRun:false, etag) -> reload and verify. The report folder is the source of truth. Manual format-pane values win over authored formatting and survive updates unless resetFormatting:true is explicit.

## Install

Requires Node.js 22.12+, 24, or 26+. Install from GitHub or clone this repository and run `npm install`, then `npm test`. Its `prepare` step builds the server. All model connections run through `@vilsem/core/connect`; no Vilsem app checkout, Electron installation or application path configuration is needed.

The0.7 prerelease depends on the immutable public `core-v0.7.2` release tarball. For local core development only, install a locally packed core tarball; restore the public release URL before distributing. Native physical interaction/export acceptance is incomplete and the5000-point60fps target is not met; this release is for evaluation, not a production-readiness claim. The previous stable release remains0.6.

### Fresh Windows machine: recommended installation

You can use this with another report; the shipped examples are not tied to the QA model. Use your own model fields discovered by `get_schema`.

1. Install a supported Node.js version (for example, Node.js 24), Power BI Desktop, and a local MCP-capable agent such as Codex or Claude Code. The MCP and Desktop must run on the **same Windows machine** for Desktop mode. The Vilsem Electron app is not required.
2. In PowerShell, install the pinned, prebuilt public release (no Git/source checkout required):

   ```powershell
   node --version
   $vilsemDir = Join-Path $env:USERPROFILE 'vilsem-mcp'
   New-Item -ItemType Directory -Force -Path $vilsemDir | Out-Null
   npm.cmd install --prefix "$vilsemDir" "https://github.com/bcsnpc/vilsem-mcp/releases/download/v0.7.3/vilsem-mcp-0.7.3.tgz"
   Join-Path $vilsemDir 'node_modules/vilsem-mcp/dist/index.js'
   (Get-Command node).Source
   ```

   Keep the printed server and Node paths. If Node is missing, reopen the terminal after installing it. `npm.cmd` avoids PowerShell script execution-policy issues. Installation downloads core 0.7.2 and renderer 4.42 automatically; no application-path environment variable is needed.
3. Configure your agent using one client example below. Replace `YOUR_NAME` with your actual Windows profile path, or use the printed server path with forward slashes. If the client cannot find `node`, use the printed full Node executable path as `command`. Restart/reconnect the client and confirm that the Vilsem tools are available. A stdio server does not open a website; the MCP client starts it.
4. Save a **test copy of the complete report project**, preserving the relative report/model folder structure. Open it in Desktop. A `.pbix` must first be saved as a PBIP project using Desktop; MCP does not patch a PBIX binary. The target must use enhanced PBIR with `<name>.Report/definition/pages/`. If needed, convert the report using Desktop first. Create an empty page in Desktop if you want a dedicated test page, then save.
5. For live external reload, use Desktop August 2026 or later, enable **Detect and reload external PBIP changes** under Preview features and restart Desktop. Earlier versions require a close/reopen workflow. See [Microsoft's prerequisites and reload limits](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-external-editing). Save Desktop changes before external edits.
6. Give the agent the absolute **`.Report` folder** path, not the `.pbip` or `.pbix` file, and use the starter prompt below. Prefer `source:{kind:"report",reportDir:"C:/Reports/MyTest/MyTest.Report"}` to follow that report's binding. For a local model it must be open in Desktop for real-data previews. If discovery is ambiguous, open only the intended model or supply its port. Never reuse port 62071 from this repository's QA session; ports are machine/session-specific.
7. Inspect the real-data preview, then commit to an existing page. Accept Desktop's external-change prompt. First-time renderer registration can require closing/reopening the project because `report.json` does not support live external reload. Alternatively import the bundled renderer in Desktop and save before committing; its installed path is `<vilsemDir>/node_modules/@vilsem/core/assets/renderer.pbiviz`.
8. Confirm real numbers, selection, slicers, hover/context menus, resize and save/reopen yourself. Existing native visuals should remain intact. `validate_visuals` checks Vilsem objects only; it does not certify native behavior or model semantics.

For animated browser previews, install Chrome/Edge/Chromium or set `VILSEM_PREVIEW_BROWSER_PATH` in the MCP server environment. Static previews do not require that browser. Model connection/preview permissions still apply; see Fabric authentication below for remote models. Moving to a different machine does not transfer Fabric credentials.

### First test: generate a new visual from scratch

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

If `schemaOnly:true`, open the model in Desktop and reconnect before requesting real values. If tools are missing, check the client configuration/server path and restart it. For a renderer-version refusal, review and upgrade the registered renderer rather than changing its GUID. An administrator's custom-visual restrictions can prevent rendering; use the report's approved policy rather than bypassing it. A successful preview is not proof of native rendering. This is an evaluation release: native acceptance remains incomplete and the 5,000-point animated frame-rate target is not met.

### Model authentication

Desktop requires Windows and a running Power BI Desktop model. Core identifies the Desktop Analysis Services process and reads its workspace port file. Pass `source.port` if multiple instances are open. ADOMD/XMLA uses your Windows identity; no cloud login is needed.

For Fabric, configure these environment variables on the MCP server process:

- Service principal: `AUTH_MODE=service_principal`, `FABRIC_TENANT_ID`, `FABRIC_CLIENT_ID`, `FABRIC_CLIENT_SECRET`.
- User login: `AUTH_MODE=device_code` (default). Login instructions go to stderr; complete Microsoft's device-code login in your browser. Only the refresh token is cached under `~/.vilsem/auth/`, scoped to tenant/client/resource, in a 0700 directory and atomic 0600 file. Windows uses the user-profile ACLs; POSIX modes are not Windows ACLs.
- Optional `FABRIC_ACCESS_TOKEN` for an externally supplied short-lived token. Refresh requires another configured credential flow.

No credentials are read from another repository's `.env` or Electron workspace store. Set credentials in your MCP client's server environment. Core also preserves `setInteractiveTokens` for Electron PKCE login.

### Connect from an existing report binding

Call `connect_model` with `source:{kind:"report",reportDir:"/path/to/Example.Report"}` to follow that report's `definition.pbir` without changing it:

- `datasetReference.byPath`: core matches the local semantic-model path to an open Desktop session, even when another model is open. With Desktop closed it reads the local TMDL or BIM definitions and returns `schemaOnly:true`. Schema-only connections cannot run DAX or preview live values; open the model and reconnect first.
- `datasetReference.byConnection`: a Power BI XMLA URL identifies the workspace and semantic model. Core resolves them through the configured Fabric credentials and uses the existing Fabric query/introspection adapter. It does not try to discover a local Desktop port. The connecting identity needs access to list the workspace and model, execute queries and inspect its definition. Windows-integrated SSAS server bindings use the local ADOMD bridge and Windows identity; cloud credentials are never forwarded to arbitrary servers.

Quoted connection-string values are supported. Passwords and impersonation settings embedded in the report are ignored; configure authentication on the MCP server. Missing or ambiguous targets fail explicitly. `commit_visual` still writes only the Vilsem visual in the selected local report; it does not change the binding, semantic model, native visuals or report policies.

There is no npm-registry publication. Install the tagged GitHub release:

```sh
npm install -g git+https://github.com/bcsnpc/vilsem-mcp.git#v0.7.3
vilsem-mcp
# Or: npx --yes --package=git+https://github.com/bcsnpc/vilsem-mcp.git#v0.7.3 vilsem-mcp
```

The process serves stdio JSON-RPC; diagnostics go to stderr.

### Claude Desktop

Add to `claude_desktop_config.json`. These examples use the recommended local release installation above; replace the profile path:

```json
{"mcpServers":{"vilsem":{"command":"node","args":["C:/Users/YOUR_NAME/vilsem-mcp/node_modules/vilsem-mcp/dist/index.js"]}}}
```

### Claude Code

```sh
claude mcp add --transport stdio vilsem -- node "C:/Users/YOUR_NAME/vilsem-mcp/node_modules/vilsem-mcp/dist/index.js"
```

### Codex

Add to `~/.codex/config.toml` or a trusted project's `.codex/config.toml`:

```toml
[mcp_servers.vilsem]
command = "node"
args = ["C:/Users/YOUR_NAME/vilsem-mcp/node_modules/vilsem-mcp/dist/index.js"]
startup_timeout_sec = 60
tool_timeout_sec = 600

```

The longer tool timeout accommodates schema profiling and real-data previews on larger models. See the [official MCP configuration documentation](https://learn.chatgpt.com/docs/extend/mcp).

## Desktop setup and walkthrough

In Desktop, open File → Options and settings → Options → Preview features. Enable **“Detect and reload external PBIP changes”** and restart Desktop. Microsoft documents this exact preview feature in [external project editing](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-external-editing).

1. Open your semantic model in Desktop, then call `connect_model` with `source:{kind:"desktop"}`; provide a port if more than one engine is open. For Fabric, provide workspaceId and datasetId.
2. Call `get_schema` and choose existing dimensions/measures, or declare query-only `spec.measures`. With scoped measures pass `connectionId` to validation, explanation and commit as well as preview. Use `run_dax` to verify the data.
3. Call `list_templates`, read `vilsem://docs/spec-format`, then `validate_spec`, `explain_visual` and `preview_visual`. Check the PNG and option before writing.
4. Call `list_pages`, choose a position without overlap, then `commit_visual` with the report folder, page folder name, a new visualName, spec, bindings and layout.
5. Accept Desktop's external-change reload prompt. Avoid saving stale Desktop state over external changes. Microsoft excludes report-level `report.json` changes from live reload: first-time custom-visual registration can require reopening the project. For visual-only reload, first import the renderer package in Desktop and save the project, then commit a visual.
6. Inspect the rendered result and call `validate_visuals`. Save the report from Desktop when satisfied.

## Tools and resources

Tools: connect_model, get_schema, run_dax, list_templates, validate_spec, explain_visual, preview_visual, preview_variants, list_pages, list_visuals, read_visual, diff_visual, update_visual, commit_visual, validate_visuals. Prompt: design_visual. Resources: vilsem://templates/<template-id>, vilsem://docs/spec-format, vilsem://docs/design-guide and vilsem://docs/workflow.

get_schema defaults to summary (no expressions or relationship graph); use full for business calculation and join semantics. Exact cardinality/BLANK share/ranges are cached60seconds with at most10samples. Permission/provider failures are explicit; internal engine row identities are skipped. page/reportDir adds read-only page query bindings without editing or validating native visuals.

Preview critique checks measured SVG text bounds, ellipses, axis rotation, categorical palette size, null/zero series, empty required slots, missing formats, page-background text contrast, legend/plot intersections, pie slice count and dual-axis review. It includes actionable paths/fixes and explicit coverage limits. It is not analytical correctness, accessibility or host-interaction certification. preview_variants makes one identical data query for up to4candidate specs; scoped definitions must match.

read_visual returns the migrated spec, bindings, pane objects, layout, source-version provenance, etag and live PNG. diff_visual is read-only. update_visual accepts RFC6902operations, defaults to dry run, protects identity/prototype/version paths and checks intervening file changes. It preserves field queries for styling-only edits and refuses implicit rebinding. A legacy inline measure with no stored owning-table metadata returns table:null; the temporary preview namespace is disclosed, not invented as original provenance.

`list_pages` reads all visual positions to help avoid overlap. `validate_visuals` examines only the stable Vilsem Renderer GUID; it does not report native visual validation results. `commit_visual` adds one new visual, rejects collisions and updates only missing renderer resources/registration. It does not rebuild or serialize other report content.

## Interactions

Rendered Vilsem ECharts visuals cross-filter through Power BI selection IDs, accept cross-highlights, support drill-through/context menu requests, native tooltips and bookmark selection restoration. Those host interaction contracts have automated harness tests in Vilsem. Availability depends on bound field identities and report configuration; report-page tooltip resolution, drill-through destinations and bookmarks require testing in the actual report. A PNG preview is static and does not verify these interactions. DOM-adapter visuals and every possible template transform have not been certified for interaction parity.

## What this does NOT do

- Create, edit or validate native Power BI visuals.
- Create or edit slicers, filters, bookmarks or themes.
- Change semantic models or model metadata.
- Persist measures to the model; declare a visual-scoped measure instead, or use Microsoft's Power BI Modeling MCP to add one to the model.
- Read or write PBIX files. Existing enhanced PBIR report folders are required.

Desktop connections require Windows and Power BI Desktop. Column sampling can be expensive on large models and permission failures are returned per column.

Headless previews support the core ECharts composition types and declarative templates. DOM-adapter visual types are rejected by this resolver rather than emitted as empty or substituted charts. Previews render the chart marks and option; renderer-owned card chrome/title headers and existing report-level filters are not replayed. Fonts can differ between server PNGs and Desktop if the machines have different installed fonts. Preview queries and arbitrary DAX default to200 rows and accept `maxRows` up to10000. Choose a complete bounded window for population statistics; Desktop's categorical host reduction is2000 rows.

## Development and verification

Run `npm run build` and `npm test`. Tests cover spec resolution, deterministic SVG/PNG rendering, custom-only PBIR insertion/validation and a real stdio client/server round trip. Live Fabric credentials, Desktop query access, reload prompts and host interactions need environment-backed acceptance; passing fixture tests alone does not establish those results.

For an independent test, follow [author a visual from scratch](docs/author-from-scratch.md).

## Stress round2 examples (0.4.0)

111 freshly authored stress examples passed the actual validate/explain/preview/commit
workflow and individual Desktop rendering inspection at900x600. Nine capabilities
remain explicit refusals, documented with sandbox/asset requirements. This is not
exhaustive formatting, resize, cloud-target or interaction certification.
See the [120-case results](https://github.com/bcsnpc/vilsem/blob/main/docs/qa/stress2/results.md)
and [format additions](https://github.com/bcsnpc/vilsem/blob/main/docs/qa/stress2/format-additions.md).

Use core0.6.0 and the bundled renderer4.35. Existing reports keep the same GUID
and primitiveSpec property. New features enforce renderer version floors rather
than silently replacing an existing report resource. `list_templates` retains
the template contract and includes `exampleSpec`: use that complete envelope to
preserve query-only `measures`, theme and instance parameters.

The catalog includes the nine original examples below plus111 stress examples.
Failed authored probes are kept under `docs/expressiveness/`, never listed as
working templates. Word packing, swarm and partition label bounds require their
declared fixed plot dimensions; density/cohort/statistical assumptions and limits
are documented in `vilsem://docs/spec-format`.

## Original expressiveness examples (0.3.0)

Nine new standalone `.vilsem-visual.json` specs ship in `templates/` and are listed by `list_templates`. They cover Sankey, Gantt, running-total waterfall, sunburst, bullet, radial progress, dual-axis reference measures, facets and a relationship network. Bind their declared slots to your own schema; no model data is embedded. Use core 0.3.0 / renderer 4.14.2.0+. The [expressiveness report](docs/expressiveness-gaps.md) records the live workflow, bounds and the deliberately unsupported Marimekko custom callback.

### Theme, formatting and preview locale

Visual backgrounds default to transparent and use the report/host foreground and
palette. `canvasTheme` is an explicit override. `preview_visual` accepts
`theme:"report"|"light"|"dark"|<theme JSON>`; a supplied reportDir selects the
referenced registered theme by default. Desktop's Appearance pane can override
the background/transparency or force report-theme inheritance.

Directly bound model and query-scoped measure formats apply to labels, value axes and
native tooltips, including heatmap cell labels and bound-field tooltips. Percent, grouping, currency, decimal precision, comma scaling
and date patterns use the same bounded converter in core. This is a supported
subset of Excel/Power BI formatting, not a claim to implement every conditional,
scientific or dynamic model-format expression.

Derived counts, densities, coordinates and ratios can have different units from
their input measure. They require an authored formatter when units change;
the renderer does not blindly apply the source currency/percent format to them.
SSR can read the report JSON's font family. Automatic inheritance of an arbitrary
report font in Desktop is not yet verified; the current native default is Segoe UI.

Desktop uses the host viewer locale. SSR defaults to `locale:"en-US"`; pass the
viewer locale (for example `"en-IN"` or `"de-DE"`) to preview_visual when matching
regional grouping, decimal separators or month names. The result reports
formattingLocale. A report's model culture alone does not determine each
viewer's regional display settings. Values and calculations are unchanged.

`preview_visual.interactions` describes supported host routes and known limits;
it is not evidence that SSR exercised native selection, report-page tooltips or
bookmarks. Native acceptance is recorded separately in the QA interaction log.

### Deterministic template thumbnails

`npm run thumbnails` rebuilds all shipped light-theme example PNGs using the same
synthetic fixtures as the rendering regressions. `node scripts/render-thumbnails.mjs
--dark` checks the alternative host background. Each theme directory under
`templates/thumbnails/` includes a manifest with source/PNG hashes and failures.
These thumbnails contain synthetic demonstration values, not model/client data.


### PNG typography

The isolated PNG worker expands the pixel-font shorthand emitted by ECharts to
CSS longhand before rasterizing. This preserves requested font sizes, weight and
style in previews (including large KPI callouts). Unknown shorthand is left
unchanged; literal chart text is never rewritten. Installed fonts still determine
font fallback. The SVG option and native chart typography are unchanged. The adapter workaround
addresses [resvg-js font shorthand support](https://github.com/thx/resvg-js/issues/404).


Default plain treemap labels use padded top-left placement and black/white text
chosen from the actual mapped opaque node fill, including rgba colours with
alpha1. Explicit label colours, authored positions/alignment and existing rich
markup retain their authored treatment. Unknown/translucent paints require an
explicit readable text style; no automatic contrast guarantee is claimed for them.

### Core0.5 native verification limits

Light/dark native rendering, percentage host tooltips, full currency labels and
plain treemap headers were checked against the owned AdventureWorks QA report.
The complete source suites pass. Physical mouse Ctrl-click and the final
stale-selection-to-slicer transition still need manual verification: Windows
Computer Use lost its native pipe and could not recover after retry/reset.
Keyboard additive selection and the other documented native interactions passed;
Ctrl/clear/highlight/stale-identity paths also have host regression coverage.
These are explicit verification limits, not claims that every native interaction,
report font, Service/Fabric target or historical screenshot was retested.


## Editable specifications and governance

New commits carry specVersion0.7; readers migrate specs from0.1 onward, including round2 string measure definitions into {expression,format} objects. version:1 remains the separate wire envelope. Migrations are pure, forward-only and tested; unknown future versions are explicitly rejected. Maintaining readable historical specs is a release requirement, not a guarantee that unknown future formats run in an older renderer.

The0.7 shared formatting contract has71properties: theme/background, animation/reduce motion, title, chart text, series palette, labels, legend, category/primary/secondary axes, lines and border. Author spec.formatting or patch individual properties; separate Desktop pane objects override only the corresponding properties. Changing secondary-axis percentage formatting preserves a primary currency axis. Common controls apply to ECharts compositions/templates; legacy DOM adapters currently expose only Appearance, Title and Border. Native pane controls do not yet cover every specialized ECharts property. Series palette input currently accepts comma-separated hex colours.

Visual-scoped measures: **yes**. Persistent model measures/changes: **via Microsoft's Power BI Modeling MCP**. Queries and committed bindings use their respective connecting/viewing identities; Power BI owns RLS, workspace access, sensitivity labels, report filters and refresh. A preview query does not replay report-level filters or certify policies.

The write flow stores bindings/specifications, not returned model rows. Author literals/annotations are possible in JSON, so review specs before sharing. The plain spec lives in PBIR and can be versioned with the report in git; ownership belongs to the report, rather than a lost chat or developer's compiled project. The0.7 template library uses OS user data, or an approved shared VILSEM_TEMPLATES_DIR folder. The MCP does not add a second manifest or list_recent tool.

Core0.6 and MCP0.6 verification is recorded in the [Round3 GroupB log](https://github.com/bcsnpc/vilsem/blob/main/docs/qa/stress3/group-b-status.md). Source/host and real-data SSR editing pass; final native Sankey/manual-pane acceptance is UNVERIFIED because ComputerUse cannot connect and Desktop snapshots are blank/time out. Automatic common-axis bounds can be reset with autoMin/autoMax. Native aggregate-column bindings outside the supported Measure/NativeMeasure shapes are reported as unsupported rather than guessed.


Contrast feedback uses4.5for normal text and3for text estimated at24px or larger, informed by [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). It deliberately does not relax the threshold for smaller bold text, and it compares against the preview page rather than proving the paint behind every label. This is review assistance, not a WCAG compliance result.

## GroupC0.7 prerelease status and limits

This prerelease implements the bounded expression series language, declarative
race/timeline motion, reusable user/shared template memory, and image-statistics
reference workflows. Published0.6 releases retain their documented0.6 behavior.

Install the tagged prerelease with its matching core dependency. Source, host,
real-data previews and installed-package checks are separate from native
interaction, export and performance acceptance. See the [verification ledger](https://github.com/bcsnpc/vilsem/blob/main/docs/qa/stress3/candidate-verification.md).

Expression renderItem is a closed JSON AST, not arbitrary JavaScript. It shares
one bounded interpreter between renderer and previews. The11 former(c) visual
families have real-model tool passes, including weighted Voronoi. Venn circles
are schematic; arbitrary exact area-proportional Euler fitting is still absent.
Native Desktop acceptance is separate from SSR and successful commits.

preview_visual motion:auto can capture actual enter/stagger/timeline canvas
animation in a fresh headless Chrome/Edge/Chromium profile. It uses the same
shipped core resolver, a controlled clock and blocked page HTTP/WebSocket
requests/service workers. No model credentials/Node bridge enter the page.
Install no browser through this package: use an installed browser, or set
VILSEM_PREVIEW_BROWSER_PATH to its executable. It never attaches to user tabs.
motion:states avoids browser launch; motion:browser requires it. Auto fallback
is explicit. APNG <=3seconds/2MiB; contact sheets label timeline states, rather
than claiming they are captured interpolation. Capture is not an FPS benchmark.
See docs/motion-capture.md. No app checkout or VILSEM_APP_PATH is required.

The separate real-clock5000-point animated-canvas probes missed60fps on this
laptop (about25RAFfps in normal headless Chromium; also failed Electron
offscreen). This target remains OPEN. The owned Desktop report has been reopened
with clean state. Native static captures were inspected for all11 expression
examples and the reference examples; this does not verify physical interactions.
Sankey motion captures remain partial or blank despite visible charts reported
by the user. Window automation is unavailable (native pipe, os error2), so native
gestures, motion/export acceptance and the final currency-axis native recheck
remain UNVERIFIED. Renderer4.40 completes hidden Sankey entry clips through the
engine's completion callbacks; a real-browser regression compares the result
pixel-for-pixel with a settled static graph. It preserves permanent clips and
includes exact-group context-menu fixes; those tests are distinct from native
acceptance. Physical click/Ctrl-click, native slicer/highlight, drill-through,
report-page tooltips, bookmarks and Edit Interactions None still need the
Desktop checklist. Do not interpret this prerelease as certification or
production-readiness completion.

To reproduce the synthetic motion benchmark from a source checkout:

```sh
npm run build
node scripts/benchmark-motion.mjs
```

It launches only an owned sandboxed headless browser, queries no model, keeps
5000points and animation enabled, and records idle/canvas/dirty-rectangle/SVG
measurements in `test-results/benchmarks/motion-options.json`. Exit code1 means
the57RAFfps/20ms-p95 tolerance was not met. This is not a Power BI host benchmark.

### Responsive reference panels in0.7.1

Two bounded expression operations, viewportWidth and viewportHeight, let an agent draw resize-aware panels using the same interpreter in preview and renderer4.41. The shipped Figma reference example includes its inset rounded white card. A real browser test checks resize/tiny bounds and confirms that the decoration cannot intercept bar clicks. This does not resolve the native-automation or5000-point animation limits above.

Verification for0.7.1:300/300 MCP tests pass against the downloaded public core0.7.1 package; private/public app-core each1355tests pass. The complete app/native/UI/Fabric/Electron/NSIS build passes. Fresh standalone archive install has audit0 and passes the SDK handshake,19tools/1prompt, viewport-spec validation and documentation-resource checks without an app path or development link. The repeated real-clock benchmark still fails: canvas11.22RAFfps, dirty-rectangle12.52fps, SVG8.62fps versus idle60.42; all5000points and animation remain enabled. These are browser measurements, not native-host acceptance.

MCP0.7.2 corrects axis-label/name contrast when the explicitly light reference card is previewed in a dark report. It uses core0.7.2 / renderer4.42, which also preserves authored opacity for explicitly silent annotation leaves during selection/highlight. Ordinary marks still dim; no native interaction claim changes.

Final0.7.2 validation:303/303 MCP tests pass against the published core0.7.2 archive with unchanged30second test deadlines. Both app/core checkouts pass1357tests. Static viewport decorations no longer produce phantom zero-measure/extra-series feedback; genuine zero data and data-driven annotations remain checked. Explicit opaque chart backgrounds are used for global contrast. Native physical acceptance remains blocked and the5000-point60fps target still fails; this remains an evaluation prerelease.

### Desktop container declarations in0.7.3

Desktop can save an existing visual with a newer2.x schema declaration before that schema is published. Read/edit/validation preserve the declaration. Existing payloads are accepted only when their complete field structure passes the bundled2.7 contract; an explicit known-2.7-contract diagnostic discloses that full validation against the declared schema was not performed. Unknown fields, malformed structures, other hosts/major versions and non-Vilsem visuals are refused. No remote schema is fetched and no fields are stripped. New commits continue using the vendored2.7 schema. Core0.7.2 / renderer4.42 remain the matching runtime.
