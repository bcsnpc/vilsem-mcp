# Test authoring a visual from scratch

Start MCP0.4 and open a saved enhanced PBIP report in Desktop. Keep Desktop's external-change detection enabled. Save any work before external edits. The MCP works only on Vilsem custom visuals; it does not create pages or edit native report objects. Create an empty page in Desktop first if needed, or use Microsoft's Power BI Report skill for page authoring.

Give your calling agent this request:

> Connect to my open Desktop model with auto-detection and call get_schema. Choose real category and numeric measure fields from that schema. Author a new .vilsem-visual.json from scratch, without loading a catalog template: a dark column chart with a readable title, category labels, turquoise bars and native formatted tooltips. Save the spec locally. Call validate_spec, explain_visual and preview_visual at900x600; inspect both the values and PNG. Use list_pages read-only to choose an empty900x600 position. Commit a new uniquely named visual, never overwrite an existing one. Do not change the model or native visuals, filters, bookmarks or themes. Show me the exact spec, bindings and DAX, and identify any preview row limit.

The expected tool order is connect_model -> get_schema -> validate_spec -> explain_visual -> preview_visual -> list_pages -> commit_visual. The same spec and binding order must be used throughout. With query-only spec.measures, also pass connectionId to validate/explain/commit so actual schema and DAX-engine validation runs.

Accept Desktop's external-change reload prompt. First-time renderer registration can require reopening the report; do not save stale Desktop state over external changes. An existing older renderer resource is deliberately refused when a new feature requires a newer runtime: import the supplied newer renderer explicitly and save/reopen rather than changing its GUID.

Check the resulting native visual: real numbers match the preview at the same data grain/window, labels fit, hover shows a tooltip, click selects, empty-area click clears, and another visual responds under the report's configured interaction. Power BI's Edit interactions distinguishes Filter, Highlight and None; unchanged totals under Highlight do not prove filtering is broken. A native slicer and Service/Fabric behaviour require separate host tests.

Then ask the agent to author another NEW spec, for example a dual-axis chart or a query-only margin measure using your actual profit/revenue fields. Ask it to change one colour/label/axis option and preview the result before committing a second uniquely named visual. The tools intentionally do not overwrite existing containers. Read [spec-format.md](spec-format.md) for exact slot/token/formatter syntax, bounds and measure semantics; do not treat arbitrary JavaScript callbacks as supported options.

The stress catalog is available for comparison after your scratch experiment. Its111 accepted new examples have real Desktop evidence in the [120-case report](https://github.com/bcsnpc/vilsem/blob/main/docs/qa/stress2/results.md). Those results do not establish every property, interaction, resize or cloud state of a new spec.
