import {describe, expect, it} from 'vitest'
import {existsSync, readFileSync} from 'node:fs'
import path from 'node:path'
// @ts-expect-error plain ESM script without type declarations
import {differences} from '../scripts/sync-plugin-skill.mjs'

const root = path.resolve(__dirname, '..')
const json = (p: string) => JSON.parse(readFileSync(path.join(root, p), 'utf8'))
const launcher = readFileSync(path.join(root, 'claude-plugin', 'launcher.mjs'), 'utf8')
const launcherVersion = /const VERSION = '([^']+)'/.exec(launcher)?.[1]
const launcherHash = /const SHA256 = '([^']+)'/.exec(launcher)?.[1]

describe('Claude Code plugin', () => {
  it('keeps the plugin skill an exact copy of skills/vilsem-powerbi-visuals', () => {
    expect(differences()).toEqual([])
  })

  it('points the marketplace at the plugin folder with a matching name', () => {
    const market = json('.claude-plugin/marketplace.json')
    const plugin = json('claude-plugin/.claude-plugin/plugin.json')
    expect(market.plugins).toHaveLength(1)
    expect(market.plugins[0].source).toBe('./claude-plugin')
    expect(market.plugins[0].name).toBe(plugin.name)
    expect(existsSync(path.join(root, 'claude-plugin', '.claude-plugin', 'icon.png'))).toBe(true)
  })

  it('pins a released archive by version and SHA-256, matching plugin.json', () => {
    const plugin = json('claude-plugin/.claude-plugin/plugin.json')
    expect(launcherVersion).toMatch(/^\d+\.\d+\.\d+$/)
    expect(launcherHash).toMatch(/^[0-9a-f]{64}$/)
    expect(plugin.version).toBe(launcherVersion)
    expect(plugin.mcpServers.vilsem.args).toEqual(['${CLAUDE_PLUGIN_ROOT}/launcher.mjs'])
  })

  it('discloses the pinned download in the plugin README, matching the launcher', () => {
    const readme = readFileSync(path.join(root, 'claude-plugin', 'README.md'), 'utf8')
    expect(readme.split(/\s+/).length).toBeGreaterThan(40)
    expect(readme).toContain(`vilsem-mcp-${launcherVersion}.tgz`)
    expect(readme).toContain(`releases/download/v${launcherVersion}/`)
    expect(readme).toContain(`SHA256SUMS-${launcherVersion}.txt`)
  })

  it('has no package.json in the plugin folder (Claude Code would try to install it)', () => {
    expect(existsSync(path.join(root, 'claude-plugin', 'package.json'))).toBe(false)
  })
})

describe('Claude Desktop extension manifest', () => {
  it('is a Windows-only node bundle whose version and tools are filled at build time', () => {
    const m = json('mcpb/manifest.template.json')
    expect(m.manifest_version).toBe('0.3')
    expect(m.server).toMatchObject({type: 'node', entry_point: 'dist/index.js'})
    expect(m.server.mcp_config.args).toEqual(['${__dirname}/dist/index.js'])
    expect(m.compatibility.platforms).toEqual(['win32'])
    expect(m.version).toBe('__VERSION__')
    expect(m.tools).toBe('__TOOLS__')
    expect(existsSync(path.join(root, 'assets', 'icon.png'))).toBe(true)
  })
})
