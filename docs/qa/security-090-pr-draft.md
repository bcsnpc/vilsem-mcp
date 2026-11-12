# Draft PR: local MCP hardening for 0.9.0

Copilot could skip the playbook, and local tool inputs could reach UNC hosts or initiate online model authentication. This release adds tool-result nudges, rejects network paths before IO, and makes Desktop/byPath the supported model connections. Online access requires an unsupported explicit opt-in. It also adds sample-value opt-out, comment-safe read-only DAX, optional browser loading, locked installs and CI-built attested release assets.

Recipe fields and formatting/reload guidance are updated. Core 0.8.0 / renderer 4.43 and Part 2 findings remain separate.

Validation: build and npm ci pass; 380/380 tests, 0 skipped, across 23 files. Fresh packed installation exposes 20 tools, refuses UNC/Fabric by default, omits requested samples, retains counts and renders statically even after physical removal of optional Playwright. Experimental online dispatch was tested with a mock adapter only. npm audit: 0 vulnerabilities; OSV 2.7.1: 220 packages, 0 findings; Semgrep 1.185.0: 60 ERROR rules, 233 files, 0 findings/errors. actionlint and YAML/pin checks pass. Hosted CI and provenance publication await the first approved run.

Owner manual step before relying on these gates: protect main, require PRs and all three CI checks (Windows / Node 24, OSV dependencies, Semgrep ERROR findings). Enable private vulnerability reporting and confirm Actions/Dependabot settings. Release/tag creation needs separate approval; see security-local-090.md for exact manual checks and remaining Part 2 issues.
