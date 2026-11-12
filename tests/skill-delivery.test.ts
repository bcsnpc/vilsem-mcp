import {it,expect,afterEach}from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {execFile}from 'node:child_process'
import {promisify}from 'node:util'
import {Client}from '@modelcontextprotocol/sdk/client/index.js'
import {StdioClientTransport}from '@modelcontextprotocol/sdk/client/stdio.js'
import {AGENT_INSTRUCTIONS,SKILL_FILES}from '../src/agent-instructions.js'
import {skillDestination,skillSource}from '../src/skill-cli.js'
const exec=promisify(execFile),temporary:string[]=[]
afterEach(async()=>{const temp=await fs.realpath(os.tmpdir());for(const dir of temporary.splice(0)){const real=await fs.realpath(dir);if(!real.startsWith(temp+path.sep)||!path.basename(real).startsWith('vilsem-skill-'))throw Error('Unsafe test cleanup');await fs.rm(real,{recursive:true,force:true})}})
async function folder(){const root=await fs.mkdtemp(path.join(os.tmpdir(),'vilsem-skill-'));temporary.push(root);return root}
const cli=(...args:string[])=>exec(process.execPath,[path.resolve('dist/index.js'),...args])
it('delivers short instructions and all packaged skill resources over actual stdio',async()=>{
 const client=new Client({name:'skill-delivery-test',version:'1'}),transport=new StdioClientTransport({command:process.execPath,args:[path.resolve('dist/index.js')],stderr:'pipe'})
 try{await client.connect(transport);expect(client.getInstructions()).toBe(AGENT_INSTRUCTIONS);expect(AGENT_INSTRUCTIONS.length).toBeLessThan(1500);expect(AGENT_INSTRUCTIONS.split('\n').length).toBeLessThanOrEqual(15)
 const resources=await client.listResources()
 for(const [name,file]of [['powerbi-visuals','SKILL.md'],['pbir-pages','references/pbir-pages.md'],['spec-cookbook','references/spec-cookbook.md'],['data-art-recipes','references/data-art-recipes.md']]){const uri='vilsem://skill/'+name;expect(resources.resources).toContainEqual(expect.objectContaining({uri,mimeType:'text/markdown'}));const read=await client.readResource({uri});expect(read.contents[0]).toMatchObject({mimeType:'text/markdown',text:await fs.readFile(path.join(skillSource,file),'utf8')});expect((read.contents[0] as any).text).toMatch(/^(---|#)/)}
 const tools=(await client.listTools()).tools;expect(tools).toHaveLength(20);expect(tools.map(t=>t.name)).toContain('get_playbook');const core=await client.callTool({name:'get_playbook',arguments:{}});expect((core.content as any)[0].text).toContain('section: core');expect((await client.callTool({name:'get_playbook',arguments:{section:'9a'}})).isError).not.toBe(true)
 }finally{await client.close();await transport.close()}
})
it('copies all five skill files including the Python helper, refuses overwrite and allows force without deleting extra files',async()=>{
 expect(SKILL_FILES).toEqual(['SKILL.md','references/pbir-pages.md','references/spec-cookbook.md','scripts/promote-measures.py','references/data-art-recipes.md'])
 const root=await folder(),destination=skillDestination(root),first=await cli('install-skill','--target',root);expect(first.stdout).toBe('');expect(first.stderr).toContain(destination)
 for(const file of SKILL_FILES)expect(await fs.readFile(path.join(destination,file))).toEqual(await fs.readFile(path.join(skillSource,file)))
 await fs.writeFile(path.join(destination,'SKILL.md'),'User modified');await fs.writeFile(path.join(destination,'keep.txt'),'Keep')
 await expect(cli('install-skill','--target',root)).rejects.toMatchObject({code:1,stdout:''});expect(await fs.readFile(path.join(destination,'SKILL.md'),'utf8')).toBe('User modified')
 const forced=await cli('install-skill','--target',root,'--force');expect(forced.stdout).toBe('');expect(await fs.readFile(path.join(destination,'keep.txt'),'utf8')).toBe('Keep');expect(await fs.readFile(path.join(destination,'SKILL.md'))).toEqual(await fs.readFile(path.join(skillSource,'SKILL.md')))
})
it('uses documented current native roots and treats custom target as a skills root',()=>{
 const home=path.resolve('fake-home');expect(skillDestination('claude',home)).toBe(path.join(home,'.claude/skills/vilsem-powerbi-visuals'));expect(skillDestination('codex',home)).toBe(path.join(home,'.agents/skills/vilsem-powerbi-visuals'));expect(skillDestination('~/team',home)).toBe(path.join(home,'team/vilsem-powerbi-visuals'))
})
it('rejects unknown CLI arguments before creating anything and keeps stdout clean',async()=>{
 const root=await folder();for(const args of [['unknown'],['install-skill','--target'],['install-skill','--target',root,'--unknown']])await expect(cli(...args)).rejects.toMatchObject({code:1,stdout:''});expect(await fs.readdir(root)).toEqual([]);const help=await cli('--help');expect(help.stdout).toBe('');expect(help.stderr).toContain('install-skill')
})
it('refuses a file destination even with force without changing its bytes',async()=>{
 const root=await folder(),destination=skillDestination(root);await fs.writeFile(destination,'Keep');await expect(cli('install-skill','--target',root,'--force')).rejects.toMatchObject({code:1});expect(await fs.readFile(destination,'utf8')).toBe('Keep')
})
