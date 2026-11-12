# Security policy

## Supported versions

0.9.x is the local-only evaluation line receiving this hardening work. 0.9.0 is prepared, not yet published. Earlier evaluation releases do not receive these protections automatically; upgrade when the release is published. Production certification and exhaustive host validation have not been established.

## What Vilsem reads and writes

The MCP reads report files in the supplied `.Report` folder and runs read-only DAX against a Power BI Desktop model on the same machine. It writes only Vilsem visual files, missing renderer registration/resources and the user template library. The optional `install-skill` CLI copies packaged skill files into the selected local skills folder. The separately invoked promotion script changes model files only when the user authorizes it with `--apply`; MCP tools never perform that operation.

Network/UNC paths, device paths and file URLs are refused at MCP path boundaries, including resolved links. Use a local drive path. Online Fabric/Service, report `byConnection` and SSAS connections are disabled by default, before invoking the connector or authentication. `VILSEM_ENABLE_ONLINE=1` restores the existing connector as an **unsupported experimental escape hatch** and prints a startup warning. It may authenticate, contact online endpoints and cache credentials. This policy does not claim that the underlying Power BI model's own data-source connections are disabled.

## What leaves the machine

Vilsem itself has no telemetry and makes no outbound network requests in supported local mode. The optional motion browser uses a fresh profile with requests and WebSockets blocked. Package installation, updates, advisory scanners and explicitly enabled online connections use the network separately.

**Tool results, query rows, column samples and measure DAX go to the AI provider of whichever agent calls the tools.** Review that provider's data-handling and retention settings before connecting sensitive data. `get_schema` defaults to a summary without measure DAX; `detail:"full"` includes expressions and relationships. Previews also return real data/labels in images and options.

Use `get_schema` with `samples:false`, or set `VILSEM_SCHEMA_SAMPLES=0` in the MCP process environment, to omit distinct sample values from every returned column. Counts, blank shares and min/max ranges remain; these can also be sensitive. The option suppresses sample values in responses, not internal profiling or explicitly requested `run_dax` results. Explicit `samples:true` overrides the environment default. Cached profiles are copied before omission, so one caller does not change later responses.

## Read-only queries

`run_dax` only accepts DAX queries starting with EVALUATE/DEFINE; DAX queries cannot modify the model. XMLA/TMSL commands are rejected. Leading block, `//` and `--` comments are supported. The prefix guard is a boundary check, not a complete DAX parser; the model engine validates query syntax.

## Verify release artifacts

Install a pinned release archive. Compute its SHA-256 digest with `Get-FileHash -Algorithm SHA256` and compare it with the matching `SHA256SUMS-<version>.txt` asset. From 0.9.0, the release workflow builds the archive and generates GitHub build-provenance attestations; verify a downloaded archive with:

```powershell
gh attestation verify ./vilsem-mcp-0.9.0.tgz --repo bcsnpc/vilsem-mcp
```

A checksum verifies matching bytes; provenance additionally identifies the repository/workflow/commit that built them. Neither proves that every dependency or behavior is safe. Installed dependency versions and integrity hashes are locked by `npm-shrinkwrap.json`.

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/bcsnpc/vilsem-mcp/security/advisories/new). Include the affected version, reproducible steps using synthetic data, expected/actual behavior and relevant logs with credentials and business data removed. Do not publish an exploit or secret in a public issue. The repository owner must enable private vulnerability reporting in GitHub settings.

## Core and renderer follow-ups

This MCP release retains core 0.8.0 and renderer 4.43. Their raw-HTML fallback, PowerShell bridge package selection, online refresh-token storage and axios dependency are separate Part 2 work and are not fixed here. Use declarative Vilsem specs; this release does not certify the renderer's raw-HTML fallback.
