import {it,expect,vi} from 'vitest'
import {existsSync} from 'node:fs'
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js'
import {createServer} from '../src/server.js'
import {Models} from '../src/models.js'
import {browserCandidates,browserEnvironment,motionCapturePlan} from '../src/motionBrowser.js'
it('keeps browser configuration independent of the app and strips model/LLM credentials',()=>{
 expect(browserCandidates({VILSEM_PREVIEW_BROWSER_PATH:'C:/owned/chrome.exe'} as any,'win32')).toHaveLength(1);expect(browserCandidates({},'linux')).toContain('/usr/bin/chromium')
 const env=browserEnvironment({SystemRoot:'C:/Windows',PATH:'bin',TEMP:'temp',AZURE_CLIENT_SECRET:'secret',POWERBI_TOKEN:'token',OPENAI_API_KEY:'key',VILSEM_APP_PATH:'repo'});expect(env).toEqual({SystemRoot:'C:/Windows',PATH:'bin',TEMP:'temp'})
})
it('bounds decoded pixels, frame count and virtual duration while including stagger time',()=>{
 const spec={template:{animation:{enter:{duration:600,delayByIndex:{milliseconds:25,max:1225}}}}},plan=motionCapturePlan(spec,{series:[{data:Array(50).fill(1)}]},800,500,8)
 expect(plan.duration).toBe(1857);expect(plan.times[0]).toBe(16);expect(plan.times.at(-1)).toBe(1857)
 expect(motionCapturePlan({template:{animation:{enter:{duration:30000}}}},{},800,500,2).duration).toBe(3000);expect(()=>motionCapturePlan({}, {},2400,2400,12)).toThrow(/pixels/)
})
it.runIf(browserCandidates().some(file=>existsSync(file)))('returns actual browser APNG through the MCP SDK and labels/refuses missing-browser fallback',async()=>{
 const models=new Models({connect:async()=>({}),query:async()=>[{'Products[Category]':'A','[Revenue]':10},{'Products[Category]':'B','[Revenue]':20}],schema:async()=>({tables:[{name:'Products',columns:[{name:'Category',dataType:'string'}]}],measures:[{table:'Measures',name:'Revenue',formatString:'$#,0'}]})}),server=createServer(models),client=new Client({name:'browser-sdk-qa',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);await client.connect(b)
 const unpack=r=>JSON.parse(r.content.find(c=>c.type==='text').text)
 try{
  const {connectionId}=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop'}}})),spec={type:'custom',template:{meta:{id:'browser-sdk',formatVersion:4},slots:{category:{kind:'dimension'},revenue:{kind:'measure'}},animation:{enter:{duration:500,easing:'linear'}},template:{xAxis:{type:'category',data:'$slot.category.categories'},yAxis:{type:'value'},graphic:[{type:'image',style:{image:'https://example.invalid/blocked.png',width:1,height:1}}],series:[{type:'bar',data:'$slot.revenue.values'}]}}},args={connectionId,spec,bindings:{dimensions:[{table:'Products',column:'Category'}],measures:[{table:'Measures',name:'Revenue'}]},motion:'browser',width:320,height:240,frames:4}
  const response=await client.callTool({name:'preview_visual',arguments:args},undefined,{timeout:60000});expect(response.isError).not.toBe(true);const result=unpack(response);expect(result.motion.kind).toBe('browser-clock');expect(result.motion.browser.blockedRequests).toBeGreaterThan(0);expect(response.content.some(c=>c.type==='image'&&c.mimeType==='image/apng')).toBe(true)
  vi.stubEnv('VILSEM_PREVIEW_BROWSER_PATH','C:/does-not-exist/browser.exe');const fallback=await client.callTool({name:'preview_visual',arguments:{...args,motion:'auto'}});expect(unpack(fallback).motion.warnings.join()).toContain('No preview browser found');expect(fallback.content.filter(c=>c.type==='image')).toHaveLength(1)
  const required=await client.callTool({name:'preview_visual',arguments:args});expect(required.isError).toBe(true)
 }finally{vi.unstubAllEnvs();await client.close();await server.close()}
},60000)
