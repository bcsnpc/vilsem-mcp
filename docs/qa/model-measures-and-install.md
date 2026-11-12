# Model-measure guidance and skill packaging verification

Scope: README replacement, skill guidance, the short server instruction and the opt-in promotion helper. No renderer, spec-format, MCP tool behavior or security-audit fixes are included.

## Automated checks

- `npm install`: passed after retrying a transient `ECONNRESET`; 163 packages audited, 0 vulnerabilities reported. No dependency or lockfile change intended.
- `npm run build`: passed.
- README: exact copy of the supplied replacement; all six local file links resolve, including the five specifically requested documentation paths.
- Release metadata: `bcsnpc/vilsem-mcp` release `v0.8.0` publishes **SHA256SUMS-0.8.0.txt**, exactly as documented. No release asset was changed.
- Claude configuration: checked against [current official MCP documentation](https://code.claude.com/docs/en/mcp). It documents user-scoped `~/.claude.json`, project `.mcp.json`, and an explicit `"type":"stdio"` JSON entry. This is documentation verification, not a fresh no-CLI client test.
- Python helper fixture tests: dry run writes nothing; apply creates original-file backups and rewires model bindings; native visuals remain unchanged; a second application writes nothing; business-measure collisions are refused; identical owned expressions can be reused.
- A regression test exposed an existing helper bug: DAX substring matching treated `SUM(...)` and `SUM(...) * 2` as identical. The shipped helper now compares the expression itself, excluding TMDL properties; inline and fenced owned-expression reuse are covered.
- Full `npm test`: **344/344 tests passed across 18 files**, 613.62 seconds, Node 24.14.0 / Python 3.13.5 on Windows. Existing stdio resource tests still read all three skill resources; installation tests copy all four packaged files including the script.
- `npm pack --dry-run`: passed. A JSON manifest inspection confirms `skills/vilsem-powerbi-visuals/scripts/promote-measures.py` is packaged and no `codex-tasks/` input files are included. A follow-up manifest-only run used `--ignore-scripts` to inspect the already built package without rerunning prepare.
- `git diff --check`: passed. All 31 README in-page links also resolve.

Fixtures are disposable local PBIP-shaped folders under the OS temporary directory. Their helper `--apply` tests do not edit any user model or report. They do not prove Desktop TMDL loading or Power BI host behavior.

The helper requires Python 3.9+ and only the standard library. Its tests require Python on PATH (`python` on Windows, `python3` elsewhere), or the `PYTHON` environment variable naming the interpreter.

## Manual checklist — Power BI Desktop / Service

Run on a **complete test project copy**, keeping its relative report/model layout. Save existing Desktop work before external edits. Do not perform these checks on a production report.

- [ ] **Unloaded model-measure acceptance:** with the test report open in Desktop, add a uniquely named measure to an existing TMDL measures table without reopening Desktop. Bind a Vilsem spec to that new model measure, with no `spec.measures`. Record `validate_spec`, `commit_visual` and `validate_visuals` results separately (including exact errors). If unknown-field rejection occurs, use **write TMDL → close without saving/reopen → rediscover the port/reconnect → preview → commit**. If accepted, record which operations accepted the binding and retain the batch-before-one-reopen guidance. No acceptance result is assumed in section 9a.
- [ ] **Model-bound preview after reopen:** reconnect to the new Desktop port, run DAX for the persisted measure, and run `preview_visual` on a spec that has no `measures`. Confirm actual numbers and formats match the DAX result.
- [ ] **Promoted-copy Desktop load:** dry-run the bundled helper against a copy containing scoped measures; approve and apply it to that copy only. Inspect the backup, close without saving, reopen and run `validate_visuals`. Confirm no `NativeMeasure` remains in the promoted Vilsem visuals and inspect the Build pane. Do not assume the fixture tests prove Desktop acceptance.
- [ ] **Publish to web comparison:** in the test report, put one model-measure Vilsem visual and one scoped-measure visual on a page. Publish and inspect an anonymous public embed. Record whether the model-bound visual renders and whether the scoped visual fails with `PowerBIAnonymousExtensionSchemaException`. Only after reproducing this change README's Publish to web row from **Field report** to **Tested, limited**, with the observed scope. Publishing publicly is a user action; do not publish sensitive report data.
- [ ] **Normal signed-in Service:** inspect the same report signed in and record which visuals render. Do not infer this result from the anonymous embed.

## Manual checklist — no-CLI Claude Code installation

- [ ] On a machine where `claude` is absent from PATH and no bundled binary is being used, close Claude Code, back up the existing config, parse/merge/write the supplied entry into top-level `mcpServers` in `~/.claude.json`, or a test project's `.mcp.json`. Preserve other keys and servers. Validate the JSON.
- [ ] Restart the client, approve the project server if needed, and confirm Vilsem tools and the skill resources are available. Record the client version and config scope. Existing CLI/client acceptance from an earlier release is not this no-CLI check.

## Change boundaries

`codex-tasks/` remains outside the change set. `SECURITY-AUDIT-2026-11-08.md` is not implemented. Live report/model migration and public publishing have not been executed in this documentation PR. The separate `D:\vilsem-mcp` worktree's deleted `dist/` files and untracked round-three scripts must remain untouched.
