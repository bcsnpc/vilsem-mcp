// Copies the playbook skill into the Claude Code plugin folder.
// The plugin is a subdirectory (so Claude Code does not try to npm-install the
// repo's GitHub-tarball dependency), and plugin paths cannot reach outside it,
// so the skill is kept as an exact copy. `--check` exits 1 if the copies differ.
import {cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'skills', 'vilsem-powerbi-visuals')
const dst = path.join(root, 'claude-plugin', 'skills', 'vilsem-powerbi-visuals')

const list = dir => readdirSync(dir, {recursive: true}).map(String).filter(f => statSync(path.join(dir, f)).isFile()).map(f => f.split(path.sep).join('/')).sort()
export function differences() {
  if (!existsSync(dst)) return ['plugin skill copy is missing']
  const a = list(src), b = list(dst), out = []
  for (const f of new Set([...a, ...b])) {
    if (!a.includes(f)) out.push(`extra in plugin: ${f}`)
    else if (!b.includes(f)) out.push(`missing in plugin: ${f}`)
    else if (!readFileSync(path.join(src, f)).equals(readFileSync(path.join(dst, f)))) out.push(`differs: ${f}`)
  }
  return out
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const d = differences()
    if (d.length) { console.error(d.join('\n') + '\nRun: node scripts/sync-plugin-skill.mjs'); process.exit(1) }
    console.log('plugin skill copy is in sync')
  } else {
    rmSync(dst, {recursive: true, force: true})
    cpSync(src, dst, {recursive: true})
    console.log(`synced ${list(dst).length} files to ${path.relative(root, dst)}`)
  }
}
