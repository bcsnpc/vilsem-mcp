import {it,expect,afterEach,vi} from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js'
import {createServer} from '../src/server.js'
import {saveUserTemplate,readUserTemplate,listUserTemplates,deleteUserTemplate,templatesDirectory} from '../src/templateLibrary.js'
const roots:string[]=[]
afterEach(async()=>{vi.unstubAllEnvs();for(const root of roots.splice(0))await fs.rm(root,{recursive:true,force:true})})
async function directory(){const root=await fs.mkdtemp(path.join(os.tmpdir(),'vilsem-library-'));roots.push(root);return root}
it('uses an OS user directory and an explicit team-library override',()=>{
 expect(templatesDirectory({VILSEM_TEMPLATES_DIR:'D:/team/templates'})).toBe(path.resolve('D:/team/templates'))
 expect(templatesDirectory({})).not.toContain('semantic_app')
})
it('round-trips complete specs, tags and metadata across fresh reads and deletes only user entries',async()=>{
 const root=await directory(),spec={type:'bar',config:{title:'Saved design'},measures:{Revenue:{expression:'1',format:'$#,0'}}}
 await saveUserTemplate({name:'revenue-bar',description:'A reusable design',spec,tags:['approved','approved']},root)
 expect(await readUserTemplate('revenue-bar',root)).toMatchObject({spec,tags:['approved'],source:'user'})
 expect(await listUserTemplates(root)).toHaveLength(1)
 await expect(saveUserTemplate({name:'revenue-bar',spec},root)).rejects.toThrow(/EEXIST/)
 await deleteUserTemplate('revenue-bar',root);expect(await listUserTemplates(root)).toEqual([])
})
it.each(['../report','a/b','C:evil','CON','nul','valid.json',''])('refuses unsafe names %j',async name=>{
 const root=await directory();await expect(saveUserTemplate({name,spec:{type:'bar'}},root)).rejects.toThrow(/slug/)
 expect(await fs.readdir(root)).toEqual([])
})
it('refuses native/executable specs and oversized files; reports corrupt files without hiding valid ones',async()=>{
 const root=await directory()
 await expect(saveUserTemplate({name:'bad',spec:{type:'slicer'}},root)).rejects.toThrow()
 await expect(saveUserTemplate({name:'huge',spec:{type:'bar',note:'x'.repeat(1048576)}},root)).rejects.toThrow(/1 MiB/)
 await saveUserTemplate({name:'good',spec:{type:'bar'}},root)
 await fs.writeFile(path.join(root,'broken.vilsem-visual.json'),'{')
 const entries=await listUserTemplates(root);expect(entries.find(t=>t.name==='broken')).toMatchObject({unreadable:true,source:'user'});expect(entries.find(t=>t.name==='good')).toMatchObject({spec:{type:'bar'}})
})
it('exposes save/list/read/delete and expression docs through the actual MCP SDK',async()=>{
 const root=await directory();vi.stubEnv('VILSEM_TEMPLATES_DIR',root)
 const server=createServer(),client=new Client({name:'memory-qa',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair()
 await server.connect(a);await client.connect(b)
 try{
  const saved:any=await client.callTool({name:'save_template',arguments:{name:'sdk-bar',spec:{type:'bar'},tags:['team']}});expect(saved.isError).not.toBe(true)
  const listed:any=await client.callTool({name:'list_templates',arguments:{}}),items=JSON.parse(listed.content[0].text)
  expect(items.some(t=>t.source==='shipped')).toBe(true);expect(items.find(t=>t.name==='sdk-bar')).toMatchObject({source:'user',spec:{type:'bar'}})
  const resource:any=await client.readResource({uri:'vilsem://templates/user/sdk-bar'});expect(JSON.parse(resource.contents[0].text).name).toBe('sdk-bar')
  const docs:any=await client.readResource({uri:'vilsem://docs/expression-language'});expect(docs.contents[0].text).toContain('vilsem-expression')
  const deleted:any=await client.callTool({name:'delete_template',arguments:{name:'sdk-bar'}});expect(JSON.parse(deleted.content[0].text).deleted).toBe(true)
 }finally{await client.close();await server.close()}
})
it('commits a report visual and saves its reusable spec; a library collision never rolls back the report',async()=>{
 const root=await directory(),library=path.join(root,'library'),reportDir=path.join(root,'Owned.Report');vi.stubEnv('VILSEM_TEMPLATES_DIR',library)
 const write=async(file,value)=>{const target=path.join(reportDir,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,JSON.stringify(value))}
 await write('definition/report.json',{resourcePackages:[]});await write('definition/pages/pages.json',{pageOrder:['page']});await write('definition/pages/page/page.json',{name:'page',displayName:'QA',width:1280,height:720})
 const server=createServer(),client=new Client({name:'commit-memory-qa',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);await client.connect(b)
 const spec={type:'bar'},args={reportDir,pageName:'page',visualName:'first',spec,bindings:{dimensions:[{table:'Products',column:'Category'}],measures:[{table:'Measures',name:'Revenue'}]},saveAs:'committed-bar',layout:{x:0,y:0,width:500,height:300}},unpack=r=>JSON.parse(r.content[0].text)
 try{
  const first=await client.callTool({name:'commit_visual',arguments:args});expect(first.isError).not.toBe(true);expect(unpack(first).savedTemplate.name).toBe('committed-bar');expect((await readUserTemplate('committed-bar',library)).spec).toEqual(spec)
  const second=await client.callTool({name:'commit_visual',arguments:{...args,visualName:'second',layout:{...args.layout,y:320}}});expect(second.isError).not.toBe(true);expect(unpack(second).templateSaved).toBe(false);expect(unpack(second).templateError).toMatch(/EEXIST/);expect(JSON.parse(await fs.readFile(path.join(reportDir,'definition/pages/page/visuals/second/visual.json'),'utf8')).name).toBe('second')
 }finally{await client.close();await server.close()}
})
