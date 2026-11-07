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

Unverified: complete Windows 100%/150% native scaling comparison beside native cards/tables, native sub-300 ms zoom/no-flicker timing, full both-painter native Ctrl/filter/bookmark matrix, Service browser zoom 100%/150%, export fidelity. The independent Label issue remains open. This is an evaluation prerelease, not production or certification sign-off.
