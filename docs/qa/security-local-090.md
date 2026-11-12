# Local security hardening: MCP 0.9.0

Scope: Part 0 and Part 1 of the owner-provided security task. Branch `security/local-hardening`, based on released 0.8.2. Core 0.8.0 and renderer 4.43 are unchanged. No Part 2 implementation, push, PR, tag or release was performed.

## Per-item implementation

| Item | Result | Evidence |
| --- | --- | --- |
| P1 | Session-local `playbookHint` on connect/schema/preview/variants/commit until a successful playbook read; no tool is blocked. A new server starts with its own state. | Five-tool before/after integration test in `tests/server.test.ts`. |
| P2 | Model-neutral placeholders, sample-model attribution, conditional exclusions for non-physical/non-geographic members. Known-issues wording and reference title updated. All 17 Contoso reference JSON files unchanged. | `tests/playbook.test.ts`; zero diff for `docs/examples/contoso`. |
| P3 | Exact `nextStep` relay, first-visual versus later-Apply wording, readable dimensions/fonts/density and compact units applied once. | Skill/instruction delivery and core-size tests. Instructions 1,465 characters. Core 6,621 bytes (~1,656 tokens); full default response 7,793 bytes. |
| S1 | Shared local-path guard covers tool/prompt report paths, connections, images, template library, browser settings and skill-install targets. Rejects UNC, device/network namespace forms and URL paths before IO; examines link targets and validates resolved paths. Remote configured template/browser paths are ignored with startup stderr diagnostics. | `tests/paths.test.ts`: every MCP entry point, fake hosts, no filesystem/model calls on rejected inputs, link targets, post-realpath rejection and local paths. |
| S2 | Fabric and report `byConnection`/SSAS are rejected before core connector construction/auth. Local report definitions are inspected in MCP, and `byPath` targets validated. Exact `VILSEM_ENABLE_ONLINE=1` restores the old connector with a startup warning. | `tests/online-policy.test.ts`: connector factory spy, mocked auth boundary, Desktop/byPath, default refusal and exact opt-in. |
| S3 | `samples:false` or `VILSEM_SCHEMA_SAMPLES=0` omits column sample values from a copied response, preserving counts/ranges and the cached profile. Explicit true overrides the environment. Security policy discloses provider-bound results, DAX and samples. | `tests/context.test.ts`; packed stdio with synthetic schema. |
| S4 | Quote-aware comment removal supports `--`, `//`, block comments and preserves literal strings/identifiers. Cleaned queries pass through core 0.8.0's older prefix guard. XMLA/TMSL/plain text are refused before querying. | `tests/dax-guard.test.ts`; README and SECURITY policy. |
| S5 | Optional, dynamically imported Playwright. Static operations do not load it. Auto motion falls back with a warning; required browser motion reports its absence. Browser tests skip only when the browser/package is unavailable. | `tests/optional-playwright.test.ts`; actual browser suites; physical removal from isolated packed install. |
| S6 | Published shrinkwrap locks tested versions/integrity, including core. Windows/Node 24 CI, npm audit, OSV and ERROR-only Semgrep; SHA-pinned actions, pinned Semgrep container, weekly Dependabot. Tag workflow tests/builds/packs, creates SHA256SUMS, attests archive/checksums, attaches the provenance bundle and creates a prerelease below 1.0. | `npm ci`; package inventory and installed shrinkwrap; workflow YAML parse, actionlint 1.7.12, all action pins checked. |
| S7 | Version/lock/install/checksum URLs prepared for 0.9.0. Local verification script and this report supplied. | Full test report and packed acceptance below. |

## Verification actually executed

- `npm ci`: passed against the shrinkwrap, including its prepare/build step.
- `npm run build`: passed after runtime changes and again during final packing.
- `npm test -- --reporter=default --reporter=json --outputFile=test-results.json`: **380/380 tests passed across 23 files**, **587.92 seconds**, Node 24.14.0 on Windows. **0 skipped**. Browser tests ran: 20 native-renderer host checks and 3 browser-motion checks (the other 2 motion-browser tests are pure logic).
- Existing non-fatal ECharts warnings about z-levels and deprecated `api.style` appeared in rendering fixtures. No assertions failed; renderer fixes remain outside this task.
- Actual installed 0.9.0 stdio: **20 tools**; UNC report path refused; Fabric refused before authentication; playbook available.
- Actual installed code over stdio using a synthetic, read-only adapter: `get_schema samples:false` omits a known sentinel, keeps cardinality, and explicit true still returns samples. Static PNG preview passed.
- Experimental Fabric acceptance was verified with that mock adapter and `VILSEM_ENABLE_ONLINE=1`. No real online login, token cache, Scanner API, SSAS connection or network model query was attempted.
- Installed manifest and `npm ls playwright-core --json` show Playwright 1.64.1 declared optional. Removed only the resolved Playwright folder inside the task-owned temporary install; actual stdio startup and static PNG preview still passed. Other native optional dependencies, including rasterization binaries, were retained.
- Final verification archive contains `npm-shrinkwrap.json`, `SECURITY.md`, the path guard and all 17 reference examples; it excludes `codex-tasks/`. An initial archive check caught a missing shrinkwrap due to the package files allowlist. Explicit inclusion fixed it, and a fresh installation then verified the shipped lock and core integrity entry.
- Reusable acceptance: install a locally packed archive into a fresh OS-temp folder named `vilsem-090-*`, then run `node scripts/verify-packed-local.mjs <install-dir>`. Add `--without-playwright` to remove only that optional package inside the owned temp install and repeat. This helper uses fake model data and does not open Desktop or contact a real online model.

## Scanner results

Advisory/rule downloads use the network; automated tests do not contact real network/UNC hosts.

| Scanner | Scope | Result |
| --- | --- | --- |
| npm audit | `npm audit --omit=dev --audit-level=high --json` | Exit 0; **0 vulnerabilities** at every severity. |
| OSV-Scanner 2.7.1 | Explicit `npm-shrinkwrap.json`; **220 packages** | Exit 0; **0 vulnerability results**. Downloaded Windows binary matched the official release asset SHA-256. |
| Semgrep 1.185.0 | `p/javascript`, `p/typescript`, `p/nodejs`, `p/secrets`; `--severity ERROR --error --metrics=off --disable-version-check` | Exit 0; **60 ERROR rules on 233 files, 0 findings, 0 errors**. Untracked new source included using `--no-git-ignore`. |
| actionlint 1.7.12 | Both GitHub workflows | Exit 0. Workflow and Dependabot YAML also parsed, and every `uses:` reference was checked for a full SHA and version comment. Shellcheck/pyflakes integrations were disabled because those executables are not installed locally. |

Semgrep excludes `node_modules`, `.git`, generated `dist/motion-runtime.js` and the generated test JSON. Its ordinary rule ignore patterns also skip documentation/static files; this is not a scan of core/renderer source or a claim that lower-severity findings do not exist. Local scanner outputs and install logs are in task-owned OS temporary folders, outside the repositories.

## CI and release checks still unverified

GitHub Actions was **not run**: pushing and opening a PR require owner approval. Hosted Windows behavior and actual release/OIDC/provenance publication are therefore **not tested**. No tests are unconditionally disabled in CI. If the runner lacks Chrome/Edge/Chromium or optional Playwright, the 20 native-host and 3 browser-motion checks skip; `scripts/summarize-tests.mjs` writes their exact names and the dependency reason into the job summary. Local runs skipped none.

## Judgment calls

- Hints stop after a successful playbook retrieval, so an invalid section request does not suppress the nudge.
- Remote environment values are ignored, as requested; direct path parameters are rejected. Local extended drive paths are accepted, while UNC/device targets are refused. Mapped network drives and hostile filesystem changes racing a validated access have not been independently tested; use actual local drives.
- Sample opt-out suppresses returned values; profiling still occurs internally. This avoids a core change and preserves counts/ranges/cache behavior. That distinction is disclosed in SECURITY.md.
- Cleaned DAX is forwarded, rather than only checked, because the unchanged core connector otherwise rejects valid leading `--` comments. Quoted text remains intact.
- The 1,500-character initialization-instruction budget required removing the brief renderer-sharpness sentence; those details remain in the skill/cookbook. The save-before-write and untrusted-data rules remain intact.
- Product tests and npm audit use Windows. OSV's Docker action and the official Semgrep container use separate Linux jobs. Actions are pinned to verified release commits, and Semgrep's image is pinned by digest.
- The release job checks that the tag matches package/shrinkwrap versions and that its commit belongs to main. It creates GitHub release assets, not an npm registry publication.

## Part 2: owner follow-ups, no implementation here

- S8: renderer `renderHtml` / `renderHtmlWithSelection` raw-HTML fallback must be sanitized or gated; renderer 4.43 remains bundled. No new renderer/GUID/spec-format change.
- S9: core `src/connect/localBridge.ps1` must select the exact Desktop package/DLL instead of the broad Power BI match; script signing/bypass documentation remains separate.
- S10: core's online axios dependency can be replaced with fetch in a separate core release. It remains integrity-locked here.
- S11: Windows refresh-token persistence requires DPAPI or no persistence when online support returns. Default local mode cannot enter that auth path.
- Core's own DAX comment guard still lacks `--` handling; MCP normalizes queries before delegation. Direct core consumers need their own follow-up.

## Owner settings and manual checks

- [ ] After approving this branch: push/open a PR and observe the first real hosted CI run, including exact skipped-test reporting.
- [ ] Protect main: require a PR and the `Windows / Node 24`, `OSV dependencies`, and `Semgrep ERROR findings` checks before merge. This is a repository setting and was not changed.
- [ ] Enable/confirm private vulnerability reporting under GitHub Security so the SECURITY.md advisory link works for reporters.
- [ ] Confirm Actions policy permits the pinned actions/containers and the release job's contents/id-token/attestations permissions. Confirm Dependabot is enabled.
- [ ] Restrict release tag creation to trusted maintainers. After a separate merge/release approval, push the approved `v0.9.0` tag so CI builds the archive; do not upload a laptop-built release.
- [ ] Verify published archive SHA256SUMS and `gh attestation verify`; confirm the attached provenance bundle and prerelease status on the first workflow-built release.
- [ ] On a test report, manually verify Desktop connection/real data, first-registration reopen versus later Apply, sample opt-out and Copilot's playbook-hint/formatting behavior. No live Desktop report was altered for this task.
