import {it,expect,vi} from 'vitest'
import {existsSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {createRequire} from 'node:module'
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
it.runIf(browserCandidates().some(file=>existsSync(file)))('resumes a real retained canvas tween when replacing its hidden visibility controller',async()=>{
 const {chromium}=await import('playwright-core'),require=createRequire(import.meta.url),browser=await chromium.launch({executablePath:browserCandidates().find(file=>existsSync(file)),headless:true,chromiumSandbox:true,env:browserEnvironment()})
 try{
  const page=await browser.newPage({viewport:{width:400,height:300}});await page.route('**/*',route=>route.abort());await page.setContent('<div id="chart" style="width:400px;height:300px"></div>')
  await page.addScriptTag({content:await readFile(require.resolve('echarts/dist/echarts.min.js'),'utf8')})
  const source=await readFile(path.join(path.dirname(require.resolve('@vilsem/core/templates')),'motionVisibility.js'),'utf8');await page.addScriptTag({content:source.replaceAll('export function','function')+'\nwindow.qaVisibility=createMotionVisibilityController;'})
  const result=await page.evaluate(()=>new Promise((resolve,reject)=>{
   const chart=window.echarts.init(document.getElementById('chart'));chart.setOption({animation:false,xAxis:{type:'category',data:['A','B']},yAxis:{type:'value',max:10},series:[{id:'values',type:'bar',data:[1,2]}]})
   const old=window.qaVisibility(chart,()=>false);old.sync();let armed=false;const deadline=setTimeout(()=>{chart.dispose();reject(Error('Retained animation clock remained paused'))},3000)
   chart.on('finished',()=>{if(!armed)return;clearTimeout(deadline);chart.dispose();resolve({finished:true})})
   chart.setOption({animation:true,animationDurationUpdate:400,series:[{id:'values',type:'bar',data:[5,8]}]});armed=true;old.dispose();const next=window.qaVisibility(chart,()=>true);next.sync()
  }));expect(result).toEqual({finished:true})
 }finally{await browser.close()}
},15000)
