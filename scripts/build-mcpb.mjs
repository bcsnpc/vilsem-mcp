// Builds the Claude Desktop extension bundle: artifacts/vilsem-mcp-<version>.mcpb
// Usage: npm run build && node scripts/build-mcpb.mjs
//
// The bundle carries the built server and its exact locked dependency tree
// (npm-shrinkwrap.json, production only, no install scripts). The optional
// playwright-core is left out: motion capture falls back to sampled states.
import {cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {buildNotices} from './notices-lib.mjs'
import {spawn, spawnSync} from 'node:child_process'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const MCPB_CLI = '@anthropic-ai/mcpb@2.1.2'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const stage = path.join(root, 'build', 'mcpb')
const out = path.join(root, 'artifacts', `vilsem-mcp-${pkg.version}.mcpb`)

const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
function npm(args, cwd) {
  const r = existsSync(npmCli)
    ? spawnSync(process.execPath, [npmCli, ...args], {cwd, stdio: 'inherit'})
    : spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {cwd, stdio: 'inherit', shell: process.platform === 'win32'})
  if (r.status !== 0) throw new Error(`npm ${args.join(' ')} failed (${r.status})`)
}

// List tools from the staged server itself, so the manifest never drifts from the code.
function listTools(entry) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [entry], {stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true})
    let buf = ''
    const timer = setTimeout(() => { p.kill(); reject(new Error('tools/list timed out')) }, 30000)
    p.stdout.on('data', d => {
      buf += d
      for (let k; (k = buf.indexOf('\n')) >= 0;) {
        const line = buf.slice(0, k); buf = buf.slice(k + 1)
        let m; try { m = JSON.parse(line) } catch { continue }
        if (m.id === 1) {
          p.stdin.write(JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n')
          p.stdin.write(JSON.stringify({jsonrpc: '2.0', id: 2, method: 'tools/list', params: {}}) + '\n')
        } else if (m.id === 2) {
          clearTimeout(timer); p.kill()
          resolve(m.result.tools.map(t => {
            const first = t.description.split(/(?<=\.)\s/)[0]
            return {name: t.name, description: first.length > 200 ? first.slice(0, 197) + '...' : first}
          }))
        }
      }
    })
    p.stdin.write(JSON.stringify({jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'build-mcpb', version: '1'}}}) + '\n')
  })
}

if (!existsSync(path.join(root, 'dist', 'index.js'))) throw new Error('dist/ missing: run npm run build first')
rmSync(stage, {recursive: true, force: true})
mkdirSync(stage, {recursive: true})
for (const f of ['dist', 'docs', 'templates', 'skills', 'SECURITY.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md', 'package.json', 'npm-shrinkwrap.json'])
  cpSync(path.join(root, f), path.join(stage, f), {recursive: true})
cpSync(path.join(root, 'assets', 'icon.png'), path.join(stage, 'icon.png'))

npm(['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=error'], stage)
rmSync(path.join(stage, 'node_modules', 'playwright-core'), {recursive: true, force: true})

// Complete notices for everything this bundle redistributes: every package in its
// node_modules plus what the motion runtime bundles. Replaces the package-level file.
function packageDirs(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue
    const full = path.join(dir, name)
    if (name.startsWith('@')) { packageDirs(full, out); continue }
    if (existsSync(path.join(full, 'package.json'))) out.push(full)
    packageDirs(path.join(full, 'node_modules'), out)
  }
  return out
}
const motionList = path.join(root, 'build', 'motion-runtime.packages.json')
if (!existsSync(motionList)) throw Error('build/motion-runtime.packages.json missing: run npm run build first')
const bundleNotices = buildNotices([...packageDirs(path.join(stage, 'node_modules')), ...JSON.parse(readFileSync(motionList, 'utf8'))], {
  title: `Third-party notices: vilsem-mcp ${pkg.version} Claude Desktop extension`,
  intro: 'vilsem-mcp is MIT-licensed (see LICENSE). This extension bundle redistributes the third-party components below: every package in its node_modules folder and everything bundled into dist/motion-runtime.js. Each component remains under its own license. The Power BI renderer inside node_modules/@vilsem/core carries its own NOTICE and THIRD_PARTY_NOTICES.md.',
  exclude: ['vilsem-mcp', '@vilsem/core'],
})
writeFileSync(path.join(stage, 'THIRD_PARTY_NOTICES.md'), bundleNotices.text)
console.log(`bundle notices: ${bundleNotices.packages.length} packages`)

const tools = await listTools(path.join(stage, 'dist', 'index.js'))
const manifest = JSON.parse(readFileSync(path.join(root, 'mcpb', 'manifest.template.json'), 'utf8'))
manifest.version = pkg.version
manifest.tools = tools
writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
writeFileSync(path.join(stage, '.mcpbignore'), ['build/', 'artifacts/', 'tests/', '*.map', 'node_modules/.package-lock.json', ''].join('\n'))
console.log(`staged ${tools.length} tools, version ${pkg.version}`)

mkdirSync(path.dirname(out), {recursive: true})
rmSync(out, {force: true})
npm(['exec', '--yes', `--package=${MCPB_CLI}`, '--', 'mcpb', 'validate', path.join(stage, 'manifest.json')], root)
npm(['exec', '--yes', `--package=${MCPB_CLI}`, '--', 'mcpb', 'pack', stage, out], root)
console.log(`built ${path.relative(root, out)}`)
