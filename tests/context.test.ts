import {describe,it,expect,vi,afterEach} from 'vitest'
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js'
import {createServer} from '../src/server.js'
import {Models} from '../src/models.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
const closing:any[]=[],temporary:string[]=[]
afterEach(async()=>{for(const x of closing.splice(0))await x.close();for(const x of temporary.splice(0))await fs.rm(x,{recursive:true,force:true})})
const unpack=(r:any)=>{if(r.isError)throw Error(r.content[0].text);return JSON.parse(r.content.find(c=>c.type==='text').text)}
function adapter(){return {connect:vi.fn(async source=>({source})),schema:vi.fn(async()=>({tables:[{name:'Sales',columns:[{name:'Amount',dataType:'double',isHidden:true,isKey:false},{name:'Category',dataType:'string'}],partitions:['private']}],measures:[{name:'Revenue',table:'Sales',expression:'SUM(Sales[Amount])',formatString:'$#,0',displayFolder:'Finance',description:'Net'}],relationships:[{fromTable:'Sales',fromColumn:'Id',toTable:'Product',toColumn:'Id',cardinality:'many_to_one',crossFilter:'oneDirection',isActive:true}],rawModelBim:{dataSources:['private']}})),query:vi.fn(async(_c,dax)=>dax.startsWith('EVALUATE ROW')?[{'[__rows]':5,'[c0Distinct]':4,'[c0Blanks]':1,'[c0Min]':10,'[c0Max]':90,'[c1Distinct]':3,'[c1Blanks]':0}]:dax.includes('[Amount]')?[{x:10},{x:90}]:[{x:'A'},{x:'B'}])}}
async function clientFor(model:any){const server=createServer(new Models(model)),client=new Client({name:'context-qa',version:'1'});const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);await client.connect(b);closing.push(client,server);const connection=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop'}}}));return {client,connectionId:connection.connectionId}}

describe('agent schema context through MCP',()=>{
 it('serves an SDK design prompt grounded in summary context and routes edits to read/patch flow',async()=>{
  const model=adapter(),{client,connectionId}=await clientFor(model)
  expect((await client.listPrompts()).prompts.map(p=>p.name)).toContain('design_visual')
  const prompt=await client.getPrompt({name:'design_visual',arguments:{intent:'Compare category revenue',connectionId}})
  const brief=JSON.parse((prompt.messages[0].content as any).text)
  expect(brief.mode).toBe('create');expect(brief.modelContext.detail).toBe('summary');expect(brief.modelContext.measures[0].expression).toBeUndefined()
  expect(brief.instructions.join(' ')).toContain('Never commit without a preview')
  expect(brief.templateSkeleton.syntaxExampleOnly).toBe(true);expect(brief.briefToComplete.alternatives).toHaveLength(2)
  const edit=await client.getPrompt({name:'design_visual',arguments:{intent:'Make the existing Sankey labels bigger',connectionId}})
  const update=JSON.parse((edit.messages[0].content as any).text)
  expect(update.mode).toBe('edit');expect(update.instructions.join(' ')).toContain('update_visual dryRun')
  for(const uri of ['vilsem://docs/design-guide','vilsem://docs/workflow'])expect((await client.readResource({uri})).contents[0]).toHaveProperty('text')
 })
 it('defaults to summary and exposes calculations/relationships only when full is requested',async()=>{
  const model=adapter(),{client,connectionId}=await clientFor(model)
  const summary=unpack(await client.callTool({name:'get_schema',arguments:{connectionId}}))
  expect(summary.detail).toBe('summary');expect(summary.measures[0].expression).toBeUndefined();expect(summary.relationships).toBeUndefined()
  expect(summary.tables[0].columns[0]).toMatchObject({cardinality:4,nullShare:.2,min:10,max:90,isHidden:true,sampleValues:[10,90]})
  expect(summary.tables[0].partitions).toBeUndefined();expect(summary.rawModelBim).toBeUndefined()
  const calls=model.query.mock.calls.length
  const full=unpack(await client.callTool({name:'get_schema',arguments:{connectionId,detail:'full'}}))
  expect(full.measures[0]).toMatchObject({expression:'SUM(Sales[Amount])',formatString:'$#,0',displayFolder:'Finance',description:'Net'})
  expect(full.relationships[0]).toMatchObject({fromTable:'Sales',direction:'oneDirection',cardinality:'many_to_one'})
  expect(model.query).toHaveBeenCalledTimes(calls)
  await client.callTool({name:'get_schema',arguments:{connectionId,refresh:true}})
  expect(model.schema).toHaveBeenCalledTimes(2);expect(model.schema.mock.calls[1][1]).toEqual({refresh:true})
  for(const [_connection,dax] of model.query.mock.calls)expect(dax).toMatch(/^EVALUATE /)
 })
 it('deduplicates concurrent profile requests and keeps separate connections isolated',async()=>{
  const model=adapter(),models=new Models(model),a=await models.connect({kind:'desktop'}),b=await models.connect({kind:'desktop'})
  const [first,second]=await Promise.all([models.schema(a.connectionId),models.schema(a.connectionId,{detail:'full'})])
  expect(model.schema).toHaveBeenCalledTimes(1);expect(model.query).toHaveBeenCalledTimes(3)
  first.tables[0].columns[0].sampleValues.push('changed')
  expect(second.tables[0].columns[0].sampleValues).not.toContain('changed')
  await models.schema(b.connectionId);expect(model.schema).toHaveBeenCalledTimes(2)
 })
 it('adds read-only page bindings including native queries without modifying report files',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vilsem-context-'));temporary.push(root)
  const pages=path.join(root,'definition/pages');await fs.mkdir(path.join(pages,'p1/visuals/native-card'),{recursive:true})
  await fs.writeFile(path.join(pages,'pages.json'),JSON.stringify({pageOrder:['p1']}));await fs.writeFile(path.join(pages,'p1/page.json'),JSON.stringify({name:'p1',displayName:'Overview'}))
  const file=path.join(pages,'p1/visuals/native-card/visual.json'),bytes=JSON.stringify({name:'native-card',position:{},visual:{visualType:'card',query:{queryState:{Values:{projections:[{field:{Measure:{Expression:{SourceRef:{Entity:'Sales'}},Property:'Revenue'}}},{queryRef:'Sum(Sales.Amount)',field:{Aggregation:{Expression:{Column:{Expression:{SourceRef:{Entity:'Sales'}},Property:'Amount'}},Function:0}}}]}}}}})
  await fs.writeFile(file,bytes)
  const {client,connectionId}=await clientFor(adapter()),result=unpack(await client.callTool({name:'get_schema',arguments:{connectionId,page:'Overview',reportDir:root}}))
  expect(result.pageBindings.visuals[0]).toMatchObject({name:'native-card',measures:[{table:'Sales',name:'Revenue'}]});expect(result.pageBindings.visuals[0].aggregations).toEqual([{table:'Sales',column:'Amount',function:0,queryRef:'Sum(Sales.Amount)'}]);expect(result.pageBindings.visuals[0].dimensions).toEqual([]);expect(await fs.readFile(file,'utf8')).toBe(bytes)
 })
})

it('omits all column samples on request/environment without changing counts, ranges or cached profiles',async()=>{
 const {client,connectionId}=await clientFor(adapter())
 try{
  for(const detail of ['summary','full']){
   const result=unpack(await client.callTool({name:'get_schema',arguments:{connectionId,detail,samples:false}}))
   for(const table of result.tables)for(const column of table.columns)expect(column).not.toHaveProperty('sampleValues')
   expect(result.tables[0].columns[0]).toMatchObject({cardinality:4,nullShare:.2,min:10,max:90})
  }
  vi.stubEnv('VILSEM_SCHEMA_SAMPLES','0')
  expect(unpack(await client.callTool({name:'get_schema',arguments:{connectionId}})).tables[0].columns[0]).not.toHaveProperty('sampleValues')
  expect(unpack(await client.callTool({name:'get_schema',arguments:{connectionId,samples:true}})).tables[0].columns[0].sampleValues).toEqual([10,90])
 }finally{vi.unstubAllEnvs()}
})
