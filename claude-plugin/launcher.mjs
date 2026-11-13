#!/usr/bin/env node
// Claude Code plugin launcher for vilsem-mcp. Dependency-free on purpose.
//
// Claude Code only installs npm-registry dependencies for plugins, and vilsem-mcp
// depends on @vilsem/core from a GitHub release. So on first start this script
// downloads the pinned, CI-built release archive, verifies its SHA-256 against the
// value below (the same value as SHA256SUMS-<version>.txt on the release page),
// installs it with its locked dependency tree into the plugin data directory, and
// then starts the server. Later starts reuse the verified install.
//
// stdout belongs to MCP JSON-RPC: all diagnostics go to stderr.
import {createHash} from 'node:crypto'
import {existsSync, mkdirSync, rmSync, renameSync, writeFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import {pathToFileURL} from 'node:url'

// Updated after each CI release (see README "Release checklist").
const VERSION = '0.9.2'
const SHA256 = '30fe6e988868d1453903cfe807dee37708e0d240d66b1aeb7f8e6a25867927f0'
const ARCHIVE = `vilsem-mcp-${VERSION}.tgz`
const URL = `https://github.com/bcsnpc/vilsem-mcp/releases/download/v${VERSION}/${ARCHIVE}`

const log = (...a) => console.error('[vilsem plugin]', ...a)
const dataRoot = process.env.CLAUDE_PLUGIN_DATA
  || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'vilsem-mcp', 'claude-plugin')
const installDir = path.join(dataRoot, `v${VERSION}`)
const entry = path.join(installDir, 'node_modules', 'vilsem-mcp', 'dist', 'index.js')

function npmCommand() {
  // Prefer npm-cli.js next to the running node: avoids spawning .cmd files through a shell.
  const cli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (existsSync(cli)) return {cmd: process.execPath, pre: [cli], shell: false}
  return {cmd: process.platform === 'win32' ? 'npm.cmd' : 'npm', pre: [], shell: process.platform === 'win32'}
}

async function install() {
  log(`first start: downloading ${ARCHIVE} (one time, about 30 seconds)`)
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status} for ${URL}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  const actual = createHash('sha256').update(bytes).digest('hex')
  if (actual !== SHA256) throw new Error(`checksum mismatch for ${ARCHIVE}: expected ${SHA256}, got ${actual}. Refusing to install.`)

  mkdirSync(dataRoot, {recursive: true})
  const staging = path.join(dataRoot, `.staging-${process.pid}-${Date.now()}`)
  mkdirSync(staging, {recursive: true})
  const tgz = path.join(staging, ARCHIVE)
  writeFileSync(tgz, bytes)
  writeFileSync(path.join(staging, 'package.json'), '{"name":"vilsem-mcp-plugin-install","private":true}\n')

  const npm = npmCommand()
  const quote = s => (npm.shell ? `"${s}"` : s)
  const args = [...npm.pre, 'install', '--prefix', quote(staging), quote(tgz), '--no-audit', '--no-fund', '--omit=dev', '--loglevel=error']
  const r = spawnSync(npm.cmd, args, {stdio: ['ignore', 2, 2], shell: npm.shell, windowsHide: true})
  if (r.status !== 0) {
    rmSync(staging, {recursive: true, force: true})
    throw new Error(`npm install failed (exit ${r.status ?? r.error?.message}). Is Node.js with npm installed?`)
  }
  rmSync(tgz, {force: true})
  try { renameSync(staging, installDir) }
  catch (e) {
    // Another session finished first: use its install.
    rmSync(staging, {recursive: true, force: true})
    if (!existsSync(entry)) throw e
  }
  log(`installed vilsem-mcp ${VERSION}`)
}

try {
  if (!existsSync(entry)) await install()
  await import(pathToFileURL(entry).href)
} catch (error) {
  log(error.message)
  process.exit(1)
}
