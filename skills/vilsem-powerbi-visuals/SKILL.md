---
name: vilsem-powerbi-visuals
description: Build, preview and add custom Power BI visuals with the vilsem MCP server (tools named mcp__vilsem__* or vilsem.*). Use when the user wants a custom, complex or "website-style" visual in a Power BI report (Sankey, calendar heatmap, KPI hero, leaderboard, radar, funnel, small multiples, any ECharts-style chart), wants to edit an existing vilsem visual, or asks why a vilsem visual looks wrong in Power BI Desktop. Covers PBIP/PBIR project prep, model discovery, data checks with DAX, spec authoring, preview/critique loops, committing to pages, and known vilsem workarounds.
---

# Building Power BI visuals with vilsem

vilsem is the **custom-visual layer** for agentic Power BI authoring. It reads the model, runs read-only DAX, renders previews of a declarative ECharts-based spec, and writes **its own visuals** into PBIR pages.

It does **not** create pages, native visuals, slicers, bookmarks, filters or themes, and it never changes the semantic model. Do those yourself by editing the PBIR files (see `references/pbir-pages.md`) or with other tools, such as the Power BI Modeling MCP for model changes.

## Division of labour: vilsem draws, you do everything else

vilsem deliberately does one job: preview, validate and write its own visuals. Everything around that is **your** job as the agent. Don't stop and report "vilsem can't do X" when you can do X yourself:

| Need | Who does it |
|---|---|
| Find the project, the `.Report` folder and the Desktop port | You: file search, the Modeling MCP's `ListLocalInstances`, or `kind:"desktop"` |
| Read measure DAX, columns and relationships | You: the TMDL files, or the Modeling MCP |
| Check the data's grain, ranges and sanity | You: `run_dax` |
| Create pages | You: edit the PBIR files (`references/pbir-pages.md`) |
| Fix data problems for one visual | You: visual-scoped measures in the spec |
| Fix the model itself | The Modeling MCP, **only if the user asks** |
| Work around vilsem limitations | You: patterns in `references/spec-cookbook.md` |
| Preview, validate, commit and update visuals | vilsem |

When you work around something, tell the user what you did and why, in one line.

## Ground rules

- **Preview before commit, always.** Never commit a spec you have not rendered against real data.
- **Check the data before designing.** Most broken visuals come from grain, blanks or measure semantics, not chart code.
- **Never silently replace a business measure.** If a model measure looks wrong (e.g. a rate above 100%), say so and explain what you used instead.
- **Ask the user before touching the model.** Visual-scoped measures (in the spec) are fine; model changes are a separate, explicit request.
- **Keep the user's Desktop state safe.** After any file write, tell them to accept the reload prompt and not to save stale Desktop state over your changes.

## Workflow

### 1. Locate the project

- vilsem needs a **PBIP project** using enhanced PBIR. A `.pbix` must first be saved as PBIP in Desktop; vilsem cannot patch a PBIX.
- Pass the absolute path of the **`<Name>.Report` folder** (it contains `definition/pages/`), not the `.pbip` file.
- Recommend a test copy of the project for first experiments.

### 2. Connect

1. Try `connect_model` with `{"kind":"report","reportDir":...}`.
2. **Check `schemaOnly` in the result.** If it is `true`, previews and DAX will not work. Reconnect with `{"kind":"desktop","port":<port>}`. Get the port from the Modeling MCP's `ListLocalInstances`, or use `{"kind":"desktop"}` to auto-detect when only one model is open.
3. **Ports change every time Desktop reopens.** If calls fail with "A connection cannot be made", find the new port and reconnect. Old `connectionId`s are dead.

### 3. Understand the model cheaply

- **Do not run `get_schema` with full profiling on large models** (hundreds of columns). It profiles every column and can take minutes.
- Prefer, in order:
  1. The TMDL files under `<Name>.SemanticModel/definition/tables/` (column names; `grep` for `column` / `measure`).
  2. The Modeling MCP: list measures, get specific measure DAX, and `GetStats` for table and measure counts.
  3. Targeted `run_dax` queries for the tables you actually need.
- **Read the DAX of every measure you plan to bind.** Look for:
  - `COALESCE(..., 0)` or `+ 0`: the measure returns 0 instead of BLANK, so a date axis will include every date in the calendar table.
  - Text measures (`FORMAT(...)`): they cannot be plotted. Recompute the number in a visual-scoped measure.
  - Ratios: never sum or average them in the visual. Evaluate them at the right grain in DAX.
  - Measures on DirectQuery or remote tables, which may be unreachable. Test with `run_dax` first. If a table's source can't be reached (e.g. "workspace not found"), every visual using it will fail. Find an equivalent local table, or tell the user.
  - **Snapshot columns** (active clients, inventory, balances): summing them across days or weeks inflates the number. Take the latest snapshot in context instead, e.g. `CALCULATE(<ratio>, LASTNONBLANK(DimDate[FullDate], CALCULATE(SUM(<snapshot col>))))`.

### 4. Probe the data with `run_dax` before designing

Check four things:
- **Range and grain:** min and max dates, the number of categories, and which fact table the measures come from.
- **Whether dimensions are shared.** If each fact table has its own `appttype` column, filter only within one fact table.
- **What each column actually means.** For example, a "lead-time bucket" may be stored against the booking-creation date, not the appointment date.
- **Sanity of rates.** Rates above 100% or below 0 point to a broken measure.

Wrap `SUMMARIZECOLUMNS` in `FILTER(..., [m] > 0)` when measures return 0, or you will get thousands of empty rows.

**Check comparisons in total and within each group.** If an overall rate and the per-category rates point in opposite directions (Simpson's paradox), show both and say so. For example, one booking method had the lower no-show rate overall but the higher rate within the largest appointment type.

### 5. Pick the design

- Call `list_templates` once. **Its output is very large (about 550K characters):** save it to a file and extract `meta.id`, `meta.description` and `slots` with a script instead of reading it raw.
- Start from the closest shipped template and adapt it. For custom layouts, see `references/spec-cookbook.md`.
- **Limits:** at most 6 dimensions and 6 measures per visual. Power BI sends at most about 2,000 rows to the visual. Aggregate or limit with visual-scoped measures.

### 6. Author the spec

- Envelope: `{"version":1,"type":"custom","config":{"cardStyle":"plain"},"measures":{...},"template":{meta, slots, params, transforms, template}}`. Use `meta.formatVersion: 2`.
- **Slots fill in declaration order** from the bindings: dimensions first in the order bound, then measures in the order bound.
- Tokens must be the **entire string value**:
  - Slot data: `$slot.<name>.values`, `.categories`, `.pairs`, `.pairsSwapped`, `.dateRange`.
  - Slot summaries: `.last`, `.sum`, `.max`, and the `*Label` variants.
  - Theme: `$theme.palette.<i>`, `$theme.textPrimary`, `$theme.textMuted`, `$theme.gridStroke`, `$theme.background`, `$theme.font`.
  - Transform results: `$calc.<as>.*`.
- **Visual-scoped measures**, which keep the model untouched:
  - Shape: `"measures":{"name":{"expression":"DAX","format":"0.0%"}}`.
  - Names must not collide with model measures or columns.
  - Bind them with `{"table":"<an existing table>","name":"name"}`. Every scoped binding uses the first measure binding's table.
  - Use them for windows (return BLANK outside a date range), top-N (`IF([rank] <= 15, ...)`), constants broadcast to every row, and numeric copies of text measures.
- Formatting:
  - Use `formatterTemplate` with `{value:thousands}`, `{value:percent}`, `{value:date}`, `{name}`, `{label}`, `{d}`.
  - Functions and JavaScript strings are rejected.

### 7. Validate, preview and iterate

- Run `validate_spec` (it needs `connectionId` when the spec declares measures), then `preview_visual` with the visual's real `width` and `height`, `reportDir`, and enough `maxRows`.
- **Look at the PNG.** The critique catches truncation, contrast and missing formats.
  - Contrast warnings for white text on dark fills are usually false positives.
  - `all-zero` warnings usually mean a grain or filter problem.
- Iterate until the numbers in the image match your DAX probes.

### 8. Make sure the page exists

`commit_visual` only adds to **existing** pages. If the user wants a new page, create it in the PBIR files first (`references/pbir-pages.md`). Use the page's internal `name` (the folder id), not its display name, as `pageName`.

### 9. Commit

- Call `commit_visual` with the page, a unique `visualName`, the layout (page pixels; 16px margins on a 1280×720 page gives x=16, y=16, w=1248, h=688), the spec and the bindings.
- **Tell the user how to see the change in Desktop.** The step depends on whether this is the report's first vilsem visual:

  | Situation | What the user sees | What the user must do |
  |---|---|---|
  | **First vilsem visual in this report** (`commit_visual` returns `rendererRegistered: true`), or new pages were added | The visual fails to render: *"To see this custom visual, add it to this report first: semanticaRenderer…"* | **Close the report without saving and reopen the `.pbip`.** The renderer is registered in `report.json`, which Desktop only reads when it opens the project. |
  | **Every later commit or update** (`rendererRegistered: false`) | Desktop shows a prompt about external changes to the project files | Click **apply / reload external changes** in that prompt. No restart needed. |

  - In both cases: **don't save in Desktop before reloading or reopening**, or Desktop overwrites the new files with its stale state.
  - Alternative for the first time only: import `<install>/node_modules/@vilsem/core/assets/renderer.pbiviz` (Visualizations pane → ⋯ → Import a visual from a file), save, then commit.
  - Tell the user this **up front** with the first commit, so they don't think the visual is broken.

### 10. Edit later

Use `update_visual`:
1. Send an RFC 6902 patch with `dryRun:true` and review the before/after PNGs.
2. Send the same patch with `dryRun:false` and the returned `etag`.

Paths look like `/template/template/series/-`. Don't re-commit under the same name; it is refused.

### 11. Report back

Tell the user:
- Which page or pages changed, and what to do in Desktop (reload, or close and reopen).
- The key numbers the visual shows, so they can cross-check them.
- Any substitutions you made: measures you replaced, windows you applied, data you excluded.
- What is not verified: host interactions such as cross-filtering, and scoped measures inside Desktop.

## Working with the user

- **Don't run long exploration silently.** Full-model profiling or reading hundreds of templates can take minutes; users will interrupt. Do a fast, targeted look, then **propose 3–4 concrete visual ideas** with the fields they'd use, and let the user pick.
- For multi-visual requests, give a one-line update as each visual is previewed and committed.
- Show the key numbers from each preview, so the user can sanity-check them against what they know.
- When you change the design for data reasons (e.g. a "funnel" whose stages aren't sequential, or a measure above 100%), say what you changed and why before you commit.

## Environment and setup gotchas (Windows)

- **npm in PowerShell:** use `npm.cmd`, which avoids execution-policy errors. The warning `install-scripts … vilsem-mcp (prepare: npm run build)` is harmless for the release tarball, because `dist/` is prebuilt. Check that `node_modules/vilsem-mcp/dist/index.js` exists.
- **`claude` CLI not on PATH** (common with the VS Code extension): the extension bundles it at `%USERPROFILE%\.vscode\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe`. Use that to run `claude mcp add --scope user …`.
- **New MCP servers need a client restart** (VS Code: Developer: Reload Window) before their tools appear.
- **Python printing model data on Windows:** set `PYTHONIOENCODING=utf-8`, because template metadata contains emoji and the default code page will crash.
- **The Power BI Modeling MCP can drop its connection,** especially after Desktop restarts. Reconnect with `ListLocalInstances` → `Connect`. If the server itself is down, fall back to the TMDL files and `run_dax`.

## Known vilsem issues and workarounds (renderer 4.43 / core 0.8.x)

| Symptom | Cause | Workaround |
|---|---|---|
| First vilsem visual shows "To see this custom visual, add it to this report first" | Renderer registration in `report.json` isn't live-reloaded | Close the report without saving and reopen it (one time per report). After that, applying the external-changes prompt is enough. |
| Visual looks blurry in Desktop with an older renderer | Reports retain their registered renderer | Upgrade to renderer 4.43 (import the bundled renderer.pbiviz, save, close and reopen). Canvas accounts for page zoom; use `config.renderer:"svg"` or Appearance > Render mode for text-heavy layouts. Canvas-only trail/blend effects fall back with a warning. |
| KPI shows `0.04` instead of `4.2%` | `lastLabel`, `sumLabel` and `deltaPctLabel` ignore the measure format | Draw the number as a hidden gauge's `detail` with `formatterTemplate:"{value:percent}"` (see the cookbook), or show it in a formatted data or axis label |
| Previews have no data after connecting by `reportDir` | Silent fallback to `schemaOnly` | Reconnect with `kind:"desktop"` and the port |
| "Connection cannot be made" | Desktop was reopened and its port changed | List the instances and reconnect |
| `list_templates` overflows the context | Huge output | Parse it from a file with a script |
| `get_schema` takes minutes | Profiles every column | Use TMDL, the Modeling MCP or targeted DAX instead |

## References

- `references/pbir-pages.md`: creating pages, the PBIR layout and Desktop reload rules.
- `references/spec-cookbook.md`: proven layout patterns, each verified against a real model: KPI hero, formatted KPI numbers, sorted leaderboard, calendar heatmap, Sankey, funnel with donut, radar with company baseline, butterfly bars, date-window and top-N measures.
