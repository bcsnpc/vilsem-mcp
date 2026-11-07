# MCP 0.8 evaluation: agent skills and native sharpness

## Changes

The package ships the supplied `vilsem-powerbi-visuals` playbook and two references. Initialization supplies a short pointer and workflow rules; `design_visual` points to the same resource. Read `vilsem://skill/powerbi-visuals`, `vilsem://skill/pbir-pages`, and `vilsem://skill/spec-cookbook`. Model/report/image content remains untrusted.

`vilsem-mcp install-skill [--target claude|codex|<skills-root>] [--force]` explicitly installs the three skill files. Claude uses `~/.claude/skills`; current Codex uses `~/.agents/skills`. Existing folders are refused without force; unrelated files are retained with force; linked/non-regular destinations are refused. No install hook writes home skills. No arguments still start the MCP stdio server.

Core 0.8 / renderer 4.43 adds bounded zoom-aware canvas density and optional SVG. Use `config.renderer:"svg"`, or the Desktop Appearance > Render mode dropdown; Automatic follows the spec. Canvas remains the default. Canvas-only trail/blending effects fall back with an explicit critique and host warning. SSR PNG/SVG preview output remains unchanged by this native-only setting.

**Existing reports must explicitly upgrade:** save Desktop work before external edits. With no pending external changes, import installed `@vilsem/core/assets/renderer.pbiviz` via Home > More visuals > From my files, accept Update, save, close and reopen. The GUID and semantica.primitiveSpec property remain unchanged. Commits preserve registered renderer resources.

The supplied markdown was initially copied byte-for-byte. Only the blur known-issue entry and its cookbook renderer guidance were then updated for the separate renderer task; older pattern provenance was clarified. The unrelated Label-token formatting bug is not fixed; its workaround is preserved. Original bundle files were not edited.

## Verification

- Initial skill integration: full 316/316 MCP tests passed against the prior public core archive.
- Final public-core 0.8 full MCP suite: **338/338 tests passed across 17 files** (682.21 seconds).
- Focused native policy/skill tests: 7/7 passed. Actual packaged native renderer browser tests: 20/20 passed across canvas/SVG, two pixel densities, four layouts, pointer/Ctrl/clear/tooltip/context menu, zoom recreation, highlight and expression motion. These are browser fixtures, not native-host certification.
- Fresh packed installation: public core 0.8 resolved, npm audit 0, all three skill resources byte-match packaged markdown, stdio lists 19 tools, explicit CLI copies/refusal/force/preserved unrelated file/stdout cleanliness pass. Existing home skill folders are unchanged by npm install.
- Actual Claude Code connected to the freshly installed package without global client configuration edits: initialization instructions visible and all three resources read successfully; no permission denials, no subagents or model/report writes. The first draft check caught a duplicated cookbook section; it was removed, repacked and the second client check confirmed exactly one section.
- Private/public app/core: each 1,367/1,367 tests across 118 files; both native builds succeed with matching bundled JS/CSS hashes.
- Desktop: manual 4.42 -> 4.43 import/save/reopen succeeded; real-data hero, leaderboard and calendar rendered. SVG calendar dropdown, page zoom and native Include/Exclude context menu observed. Canvas native tooltip observed. Original model's 21 baseline files remain byte-identical.
- A separate six-page QA report was successfully created through the Fabric report API with the configured existing model: hero/leaderboard (four real rows), calendar (45 real dates), each in canvas/SVG. No semantic-model edits. Successful API creation is not a rendering PASS. Browser access host/URL enforcement prevents automated Service inspection. On 2026-11-06 the user confirmed seeing all six Service QA pages. This is user-reported page availability; numeric correctness, every chart element, interactions and browser zoom are not independently verified.

## Remaining acceptance limits

Dense 5,000-point animated scatter target still FAILS. A single synthetic actual-bundle browser run at host scale 1.5/device DPR 1 measured old canvas 11.84 RAF fps/p95 516 ms, new canvas 9.07/816 ms, new SVG 4.11/1,216 ms, retaining every mark and animation. These are real-clock browser measurements, not Power BI Service/hardware certification. Canvas now rasterizes more pixels. SVG is an option for crisp fine text, not a performance promise.

Unverified: complete Windows 100%/150% native scaling comparison beside native cards/tables, native sub-300 ms zoom/no-flicker timing, full both-painter native Ctrl/filter/bookmark matrix, full cross-visual Service interaction coverage, export fidelity. The later Edge follow-up below verifies the six-page browser zoom matrix. The independent Label issue remains open. This is an evaluation prerelease, not production or certification sign-off.


## Live Edge Service follow-up (2026-11-06)

The already-open Edge window exposed its current app.powerbi.com URL through supported Computer Use. Earlier browser-access errors did not recur on this surface. Twelve visual inspections completed: hero, leaderboard and calendar in canvas/SVG, each at browser zoom 100% and 150%. Browser zoom 150% was explicitly visible in Edge; it is distinct from Power BI Fit-to-page scaling (59% at browser 100%, 31% at browser 150%). The full plot/title/legend remained inside the visible chart areas, and no error placeholder or blank visual was observed. Evidence: live screenshots and accessibility states in the session transcript, not headless-browser screenshots.

Both hero variants displayed 1,556,641. Both leaderboard variants displayed 859,980 / 374,283 / 201,258 / 121,120, also present in SVG accessibility text. A separate live read-only DAX query confirmed those four values and grand total. Calendar SVG exposed all 45 numeric labels; the painted calendar canvas showed the corresponding arrangement. This is not an independent cell-by-cell reconciliation.

Canvas and SVG leaderboard click selection visibly dimmed other marks; empty-area clicks restored all marks. Both displayed native tooltips with category and measure values and native Include/Exclude context menus on right-click. Only menu presence was tested; Include/Exclude actions were not applied. No report edits were saved. Browser zoom was restored to 100%, the SVG hero page was restored, and selection was cleared.

Sharpness remains partially accepted: SVG text was visibly cleaner; tiny canvas labels were still soft at small Fit-to-page scales, especially the 31% page scale at browser 150%. No claim of equal-to-native sharpness or universal clipping coverage is made. This follow-up clears the six-page Service rendering/zoom blocker and simple selection/tooltip/context/clear checks. It does NOT close cross-filtering to another/native visual (these six pages contain a single visual), physical Ctrl-click, bookmarks, drill-through, native Windows scaling 100%/150%, export checks, measured sub-300 ms timing or the failing 5,000-point performance target.


## Ordinary-chart motion follow-up (2026-11-06)

After the user clarified entrance animation rather than racing, a separate Normal chart motion page was added to the same owned Service QA report. It contains fixed-data bar (4 rows), annual line (7 rows, 2026 marked partial), donut (4 rows) and scatter (4 rows). All use canvas and declarative formatVersion 4 motion, with no race transform, timeline or frame options. MCP validation/explanation and actual-browser motion previews passed for each; the previews had no critique findings and their final images were inspected. The initial caller spec used formatVersion 2 and was correctly refused, then corrected to 4; this was not a product fix.

A guarded Fabric definition update preserved 22 original parts and the seven existing pages, adding four custom visuals on the eighth page. The operation succeeded. Live Edge showed all four settled charts, and page re-entry captured a partially drawn line and entering scatter points followed by settled marks. This confirms ordinary animation exists; it is not every-series/host/reduced-motion/frame-rate acceptance. No model edits were made. Preview/evidence artifacts remain local QA files; the README's generic recipes do not depend on this model.

For installation, drawing/animation choices, known failures, and the complete current partial/untested acceptance checklist, read the [release README](../../README.md#release-status-08-evaluation).
