import {it,expect,vi} from 'vitest'
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js'
const load=vi.hoisted(()=>vi.fn(()=>{throw Error('Cannot find optional module playwright-core')}))
vi.mock('playwright-core',()=>load())
import {createServer} from '../src/server.js'
import {Models} from '../src/models.js'
it('starts and previews statically without Playwright, falls back in auto and errors clearly in browser mode',async()=>{
 const model=new Models({connect:async source=>({source}),schema:async()=>({tables:[],measures:[{table:'Measures',name:'Sales'}]}),query:async()=>[{'[Sales]':20}]})
 const server=createServer(model),client=new Client({name:'optional-browser',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair()
 const unpack=(r:any)=>JSON.parse(r.content.find(c=>c.type==='text').text)
 try{
  await server.connect(a);await client.connect(b);expect((await client.listTools()).tools).toHaveLength(20)
  const {connectionId}=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop'}}})),bindings={dimensions:[],measures:[{table:'Measures',name:'Sales'}]}
  const staticResult=await client.callTool({name:'preview_visual',arguments:{connectionId,bindings,spec:{type:'bar',config:{animationEnabled:false}}}})
  expect(staticResult.isError).not.toBe(true);expect(load).not.toHaveBeenCalled()
  const spec={type:'custom',template:{meta:{id:'optional-motion',formatVersion:4},slots:{value:{kind:'measure'}},animation:{enter:{duration:300}},template:{xAxis:{type:'category',data:['Sales']},yAxis:{type:'value'},series:[{type:'bar',data:'$slot.value.values'}]}}}
  const auto=await client.callTool({name:'preview_visual',arguments:{connectionId,bindings,spec,motion:'auto'}})
  expect(auto.isError).not.toBe(true);expect(unpack(auto).motion.warnings.join(' ')).toContain('optional playwright-core package')
  const required:any=await client.callTool({name:'preview_visual',arguments:{connectionId,bindings,spec,motion:'browser'}})
  expect(required.isError).toBe(true);expect(required.content[0].text).toContain('optional playwright-core package')
 }finally{await client.close();await server.close()}
})
