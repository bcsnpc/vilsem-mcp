import {it,expect,vi} from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js'
import {getPlaybook,parseMarkdown,parseSkill,normalizeMarkdown,CORE_IDS} from '../src/playbook.js'
import {createServer} from '../src/server.js'
import {Models} from '../src/models.js'
const version=createRequire(import.meta.url)('../package.json').version
const skill=new URL('../skills/vilsem-powerbi-visuals/',import.meta.url)
it('returns the compact guarded core, package version, and retrievable indices',async()=>{
 const result=await getPlaybook();expect(result.text.startsWith(`vilsem-playbook ${version} · section: core\n`)).toBe(true)
 const sections=parseSkill(await fs.readFile(new URL('SKILL.md',skill),'utf8'))
 for(const id of CORE_IDS)expect(result.text).toContain(sections.find(s=>s.id===id)!.text)
 expect(result.coreBytes,'Trim the core markdown if it reaches 8,000 bytes').toBeLessThan(8000)
 for(const index of [result,await getPlaybook('cookbook'),await getPlaybook('art')])for(const match of index.text.matchAll(/^- `([^`]+)`/gm))expect((await getPlaybook(match[1])).text.length).toBeGreaterThan(80)
 expect((await getPlaybook('art')).text.match(/^- `art:/gm)).toHaveLength(8)
})
it('returns exact normalized files and identical canonical alias responses',async()=>{
 for(const [id,file] of [['all','SKILL.md'],['pbir-pages','references/pbir-pages.md']])expect((await getPlaybook(id)).text.split('\n').slice(1).join('\n')).toBe(normalizeMarkdown(await fs.readFile(new URL(file,skill),'utf8')))
 expect((await getPlaybook('9a')).text).toBe((await getPlaybook('9a-measures-for-shareable-reports')).text)
 for(const alias of ['commit','edit','known-issues','gotchas','cookbook:sankey'])expect((await getPlaybook(alias)).text).toContain('vilsem-playbook')
 expect((await getPlaybook('cookbook:cheap-previews')).text).toContain('preview_variants')
 expect((await getPlaybook('cookbook:overlay-bars')).text).toContain('yAxisIndex')
})
it('guards missing core headings, normalizes CRLF, ignores fenced headings and keeps nested sections',async()=>{
 const original=await fs.readFile(new URL('SKILL.md',skill),'utf8')
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'vilsem-playbook-'))
 try{const file=path.join(temp,'SKILL.md');await fs.writeFile(file,original.replace('## Ground rules','## Renamed rules'));const changed=await fs.readFile(file,'utf8');expect(()=>parseSkill(changed)).toThrow('Missing required core playbook heading: ground-rules')}finally{await fs.rm(temp,{recursive:true,force:true})}
 const sections=parseMarkdown('\uFEFF## Parent\r\n```md\r\n## Not a heading\r\n```\r\n### Child\r\nhello\r\n## Next\r\nbye\r\n')
 expect(sections.map(s=>s.id)).toEqual(['parent','child','next']);expect(sections[0].text).toContain('### Child\nhello');expect(sections[1].text).not.toContain('## Next')
 expect(()=>parseMarkdown('## Same\n## Same')).toThrow('Duplicate playbook heading')
})
it('delivers offline read-only results and precise unknown-id errors over MCP',async()=>{
 const adapter={connect:vi.fn(),query:vi.fn(),schema:vi.fn()},server=createServer(new Models(adapter as any)),client=new Client({name:'playbook-test',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair()
 const write=vi.spyOn(fs,'writeFile'),network=vi.spyOn(globalThis,'fetch')
 try{await server.connect(a);await client.connect(b)
 const tools=(await client.listTools()).tools;expect(tools).toHaveLength(20);expect(tools.find(t=>t.name==='get_playbook')?.annotations).toMatchObject({readOnlyHint:true,openWorldHint:false})
 const result:any=await client.callTool({name:'get_playbook',arguments:{}});expect(result.isError).not.toBe(true);expect(result.content[0].text).toContain('On-demand section index')
 const bad:any=await client.callTool({name:'get_playbook',arguments:{section:'does-not-exist'}});expect(bad.isError).toBe(true);expect(bad.content[0].text).toContain(`vilsem-playbook ${version}`);expect(bad.content[0].text).toContain('Valid ids:');expect(bad.content[0].text).toContain('9a')
 expect(adapter.connect).not.toHaveBeenCalled();expect(adapter.query).not.toHaveBeenCalled();expect(adapter.schema).not.toHaveBeenCalled();expect(write).not.toHaveBeenCalled();expect(network).not.toHaveBeenCalled()
 }finally{write.mockRestore();network.mockRestore();await client.close();await server.close()}
})
