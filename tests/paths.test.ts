import {it,expect,vi,afterEach} from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js'
import {createServer} from '../src/server.js'
import {Models} from '../src/models.js'
import {assertLocalPath,localRealpath,checkPathEnvironment} from '../src/paths.js'
import {referenceImage} from '../src/referenceImages.js'
import {skillDestination} from '../src/skill-cli.js'
import {templatesDirectory} from '../src/templateLibrary.js'
import {browserCandidates} from '../src/motionBrowser.js'
afterEach(()=>vi.restoreAllMocks())
const remote=['\\\\evil\\share\\x','//evil/share/x','\\\\?\\UNC\\evil\\x']
const connectionId='12345678-1234-4234-8234-123456789012',bindings={dimensions:[],measures:[{table:'Measures',name:'Sales'}]}
it.each([...remote,'\\\\.\\device','file:///C:/Reports/x','file://evil/share/x','https://evil/share/x'])('refuses network/device/URL input before any filesystem access: %s',async value=>{
 const stat=vi.spyOn(fs,'lstat'),real=vi.spyOn(fs,'realpath')
 expect(()=>assertLocalPath(value,'reportDir')).toThrow('Network paths are not allowed (reportDir)')
 await expect(localRealpath(value)).rejects.toThrow('Network paths are not allowed')
 expect(stat).not.toHaveBeenCalled();expect(real).not.toHaveBeenCalled()
})
it.each(remote)('rejects every MCP path entry point without accessing a fake host: %s',async value=>{
 const adapter={connect:vi.fn(),query:vi.fn(),schema:vi.fn()},server=createServer(new Models(adapter as any)),client=new Client({name:'paths-test',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair()
 await server.connect(a);await client.connect(b)
 const probes=['stat','lstat','realpath','readFile'].map(name=>vi.spyOn(fs,name as 'stat'))
 try{
  const target={reportDir:value,pageName:'page',visualName:'visual',connectionId}
  const calls:[string,any][]=[
   ['connect_model',{source:{kind:'report',reportDir:value}}],['get_schema',{connectionId,page:'page',reportDir:value}],
   ['list_pages',{reportDir:value}],['list_visuals',{reportDir:value}],['read_visual',target],['diff_visual',{...target,spec:{type:'bar'}}],['update_visual',{...target,patch:[{op:'add',path:'/config',value:{}}]}],
   ['validate_visuals',{reportDir:value}],['commit_visual',{...target,spec:{type:'bar'},bindings,layout:{x:0,y:0,width:400,height:300}}],
   ['preview_visual',{connectionId,spec:{type:'bar'},bindings,reportDir:value}],['preview_variants',{connectionId,specs:[{type:'bar'}],labels:['Bar'],bindings,reportDir:value}],
   ['compare_preview',{connectionId,spec:{type:'bar'},bindings,reference_image:value}],['extract_design_tokens',{image:value}]]
  for(const [name,args]of calls){const result:any=await client.callTool({name,arguments:args});expect(result.isError,name).toBe(true);expect(result.content[0].text,name).toContain('Network paths are not allowed')}
  await expect(client.getPrompt({name:'design_visual',arguments:{intent:'Chart',connectionId,reportDir:value}})).rejects.toThrow('Network paths are not allowed')
  await expect(client.getPrompt({name:'design_visual',arguments:{intent:'Chart',connectionId,reference_image:value}})).rejects.toThrow('Network paths are not allowed')
  await expect(referenceImage(value)).rejects.toThrow('Network paths are not allowed');expect(()=>skillDestination(value)).toThrow('Network paths are not allowed')
  for(const probe of probes)expect(probe).not.toHaveBeenCalled()
  for(const call of Object.values(adapter))expect(call).not.toHaveBeenCalled()
 }finally{for(const probe of probes)probe.mockRestore();await client.close();await server.close()}
})
it('checks symlink targets before following them and checks the final realpath',async()=>{
 const lstat=vi.spyOn(fs,'lstat').mockResolvedValue({isSymbolicLink:()=>true} as any),link=vi.spyOn(fs,'readlink').mockResolvedValue('\\\\evil\\share\\x'),real=vi.spyOn(fs,'realpath')
 await expect(localRealpath(path.join(os.tmpdir(),'fake-link'))).rejects.toThrow('Network paths are not allowed');expect(real).not.toHaveBeenCalled()
 lstat.mockResolvedValue({isSymbolicLink:()=>false} as any);link.mockRestore();real.mockResolvedValue('\\\\evil\\share\\x')
 await expect(localRealpath(os.tmpdir())).rejects.toThrow('Network paths are not allowed')
})
it('keeps local paths usable and ignores remote environment settings with startup diagnostics',async()=>{
 expect(assertLocalPath('C:\\Reports\\Report')).toBe('C:\\Reports\\Report');expect(assertLocalPath('\\\\?\\C:\\Reports\\Report')).toContain('C:')
 expect(await localRealpath(os.tmpdir())).toBe(await fs.realpath(os.tmpdir()))
 const env={VILSEM_TEMPLATES_DIR:remote[0],VILSEM_PREVIEW_BROWSER_PATH:remote[1]},warn=vi.fn(),stat=vi.spyOn(fs,'lstat')
 await checkPathEnvironment(env,warn);expect(env).toEqual({});expect(warn).toHaveBeenCalledTimes(2);expect(stat).not.toHaveBeenCalled()
 expect(templatesDirectory({VILSEM_TEMPLATES_DIR:remote[0]} as any)).not.toContain('evil')
 expect(browserCandidates({VILSEM_PREVIEW_BROWSER_PATH:remote[0]})).not.toContain(remote[0])
})
