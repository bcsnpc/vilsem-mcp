import { SHIPPED_TEMPLATES } from '../src/templates.js'
import { describe,it,expect,afterEach,vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createServer } from '../src/server.js'
import { Models } from '../src/models.js'
import { previewRows } from '../src/preview.js'
import { validateSpec,validateVisuals,validateBindings } from '../src/reports.js'
import { EXAMPLE_TEMPLATES } from '@vilsem/core/templates/examples'

const closed:any[]=[]
const temporary:string[]=[]
afterEach(async()=>{for(const item of closed.splice(0))await item.close();for(const dir of temporary.splice(0))await fs.rm(dir,{recursive:true,force:true})})
async function clientFor(adapter:any){
  const server=createServer(new Models(adapter)),client=new Client({name:'qa',version:'1'})
  const [a,b]=InMemoryTransport.createLinkedPair()
  await server.connect(a);await client.connect(b);closed.push(client,server)
  return client
}
const adapter=()=>({connect:vi.fn(async(source)=>({source})),query:vi.fn(async()=>[{'Product[Category]':'Bikes','[Sales]':12},{'Product[Category]':'Clothing','[Sales]':5}]),schema:vi.fn(async()=>({tables:[{name:'Product',columns:[{name:'Category',dataType:'string'}]}],measures:[{table:'Measures',name:'Sales',dataType:'decimal'}]}))})
const unpack=(result:any)=>JSON.parse(result.content.find(item=>item.type==='text').text)
const bindings={dimensions:[{table:'Product',column:'Category'}],measures:[{table:'Measures',name:'Sales'}]}

async function fixture(){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vilsem-mcp-'));temporary.push(root)
  const write=async(file,value)=>{const full=path.join(root,file);await fs.mkdir(path.dirname(full),{recursive:true});await fs.writeFile(full,JSON.stringify(value))}
  await write('definition/report.json',{resourcePackages:[],themeCollection:{customTheme:{name:'Keep'}}})
  await write('definition/pages/pages.json',{pageOrder:['page1']})
  await write('definition/pages/page1/page.json',{name:'page1',displayName:'Page 1',width:1280,height:720})
  await write('definition/pages/page1/visuals/native/visual.json',{name:'native',position:{x:0,y:0,width:100,height:100},visual:{visualType:'slicer'},deliberatelyNotValidated:'native object'})
  await write('definition/bookmarks/bookmark.json',{state:'keep'})
  return root
}

describe('spec and SSR',()=>{
  it.each(EXAMPLE_TEMPLATES.map(template=>[template.meta.id,template]))('validates and renders shared template %s',(_name,template)=>{
    const spec={type:'custom',template}
    expect(()=>validateSpec(spec)).not.toThrow()
    const result=previewRows(spec,[{_cat:'2025-01-01',_cat2:'North',_val:12,_val2:3,_val3:2,_vals:[12,3,2]},{_cat:'2025-01-02',_cat2:'South',_val:20,_val2:4,_val3:3,_vals:[20,4,3]}])
    expect(result.png.length).toBeGreaterThan(100)
  })
  it.each(['slicer','nativeBar','text_box'])('rejects unsupported %s',type=>expect(()=>validateSpec({type})).toThrow(/not supported/))
  it('rejects versions the current renderer cannot read',()=>expect(()=>validateSpec({version:99,type:'bar'})).toThrow(/version 99/))
  it('reports unknown slots, token roots and formatters precisely',()=>{
    const template=EXAMPLE_TEMPLATES.find(template=>template.meta.id==='lollipop')
    expect(()=>validateSpec({template:{...template,template:{series:[{data:'$slot.missing.values'}]}}})).toThrow(/slot/)
    expect(()=>validateSpec({template:{...template,template:{series:[{data:'$slot.value.notAProperty'}]}}})).toThrow(/notAProperty/)
    expect(()=>validateSpec({template:{...template,template:{series:[{data:'$javascript.run'}]}}})).toThrow(/\$javascript\.run/)
    expect(()=>validateSpec({template:{...template,template:{tooltip:{formatterTemplate:'{value:arbitraryCode}'}}}})).toThrow(/unknown formatter/)
  })
  it('renders deterministic visible PNG marks with requested dimensions',()=>{
    const spec={type:'bar',config:{animationEnabled:false}}
    const rows=[{_cat:'Bikes',_val:12},{_cat:'Clothing',_val:5}]
    const first=previewRows(spec,rows,800,500),second=previewRows(spec,rows,800,500)
    expect(first.svg).toContain('Bikes')
    expect(Buffer.from(first.png).subarray(1,4).toString()).toBe('PNG')
    expect(Buffer.from(first.png).readUInt32BE(16)).toBe(800)
    expect(Buffer.from(first.png).readUInt32BE(20)).toBe(500)
    expect(Buffer.from(first.png)).toEqual(Buffer.from(second.png))
    expect(first.option.series[0].data.length).toBe(2)
  })
  it('rejects incomplete template field roles before querying',()=>{
    const template=EXAMPLE_TEMPLATES.find(template=>template.meta.id==='heatmap_2d')
    expect(()=>validateBindings({template},bindings)).toThrow(/requires 2 dimension/)
  })
  it('renders an actual shared template',()=>{
    const template=EXAMPLE_TEMPLATES.find(template=>template.meta.id==='lollipop')
    const result=previewRows({type:'custom',template},[{_cat:'Bikes',_val:12}])
    expect(result.svg).toContain('Bikes')
    expect(result.png.length).toBeGreaterThan(100)
  })
})

describe('MCP end-to-end contracts',()=>{
  it('connects, samples schema, caps queries and previews actual normalized model rows',async()=>{
    const model=adapter(),client=await clientFor(model)
    const connected=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop',port:12345}}}))
    const schema=unpack(await client.callTool({name:'get_schema',arguments:connected}))
    expect(schema.tables[0].columns[0].sampleValues).toEqual(['Bikes','Clothing'])
    const capped=unpack(await client.callTool({name:'run_dax',arguments:{...connected,dax:'EVALUATE ROW("Sales", 12)',maxRows:1}}))
    expect(capped.rows).toHaveLength(1)
    const preview:any=await client.callTool({name:'preview_visual',arguments:{...connected,spec:{type:'bar'},bindings}})
    expect(preview.isError).not.toBe(true)
    expect(preview.content[0]).toMatchObject({type:'image',mimeType:'image/png'})
    expect(unpack(preview).rowCount).toBe(2)
    expect(model.query.mock.calls.at(-1)[1]).toContain('SUMMARIZECOLUMNS')
  })
  it('refuses non-query model commands and unknown connections',async()=>{
    const models=new Models(adapter()),{connectionId}=await models.connect({kind:'desktop',port:12345})
    await expect(models.query(connectionId,'CREATE TABLE Anything',10)).rejects.toThrow(/EVALUATE/)
    await expect(models.query('missing','EVALUATE ROW("x", 1)',10)).rejects.toThrow(/connectionId/)
  })
  it('queries scalar ratios without grouping or manufacturing a sum',async()=>{
    const model=adapter();model.query=vi.fn(async()=>[{'[Ratio]':0.25}])
    const client=await clientFor(model)
    const connection=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop',port:12345}}}))
    const preview:any=await client.callTool({name:'preview_visual',arguments:{...connection,spec:{type:'gauge'},bindings:{dimensions:[],measures:[{table:'Measures',name:'Ratio'}]}}})
    expect(preview.isError).not.toBe(true)
    expect(model.query.mock.calls.at(-1)[1]).not.toContain('GROUPBY')
    expect(model.query.mock.calls.at(-1)[1]).toContain('[Ratio]')
    expect(unpack(preview).option.series[0].data[0].value).toBe(0.25)
  })
  it('lists native positions read-only and validates only Vilsem visuals after insertion',async()=>{
    const root=await fixture(),native=path.join(root,'definition/pages/page1/visuals/native/visual.json'),before=await fs.readFile(native)
    const client=await clientFor(adapter())
    const pages=unpack(await client.callTool({name:'list_pages',arguments:{reportDir:root}}))
    expect(pages[0].visuals[0].type).toBe('slicer')
    expect(await validateVisuals(root)).toEqual([])
    const result:any=await client.callTool({name:'commit_visual',arguments:{reportDir:root,pageName:'page1',visualName:'vilsem1',spec:{version:1,type:'bar'},bindings,layout:{x:200,y:100,width:600,height:300}}})
    expect(result.isError, JSON.stringify(result)).not.toBe(true)
    expect(await fs.readFile(native)).toEqual(before)
    const validated=unpack(await client.callTool({name:'validate_visuals',arguments:{reportDir:root}}))
    expect(validated).toHaveLength(1)
    expect(validated[0].valid).toBe(true)
    const collision:any=await client.callTool({name:'commit_visual',arguments:{reportDir:root,pageName:'page1',visualName:'native',spec:{type:'bar'},bindings,layout:{x:200,y:100,width:600,height:300}}})
    expect(collision.isError).toBe(true)
    expect(await fs.readFile(native)).toEqual(before)
  },20000)
  it('skips engine row identities and samples field-parameter composite keys through row projection',async()=>{
    const model=adapter();model.schema.mockResolvedValueOnce({tables:[{name:'Parameter',columns:[{name:'RowNumber-engine',isHidden:true},{name:'Display',dataType:'string'}]}],measures:[]} as any)
    model.query.mockImplementation(async(_c,dax)=>{if(dax.includes('VALUES('))throw Error('part of composite key');return [{'[__vilsem_sample]':'Revenue'},{'[__vilsem_sample]':'Revenue'},{'[__vilsem_sample]':'Profit'}]})
    const client=await clientFor(model),connection=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop'}}}))
    const result=unpack(await client.callTool({name:'get_schema',arguments:connection}))
    expect(result.tables[0].columns[0].sampleSkipped).toContain('not queryable')
    expect(result.tables[0].columns[1].sampleValues).toEqual(['Revenue','Profit'])
    expect(model.query).toHaveBeenCalledTimes(2)
    expect(model.query.mock.calls[1][1]).toContain('SELECTCOLUMNS(TOPN(10,')
  })
  it('does not expose raw model or data-source definitions through get_schema',async()=>{
    const model=adapter();model.schema.mockResolvedValueOnce({tables:[],measures:[],relationships:[],rawModelBim:{dataSources:[{connectionString:'private'}]}} as any)
    const client=await clientFor(model),connection=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop'}}}))
    const result=unpack(await client.callTool({name:'get_schema',arguments:connection}))
    expect(result).toEqual({tables:[],measures:[],relationships:[]})
  })
  it('explains custom specs and exact measure bindings without querying',async()=>{
    const model=adapter(),client=await clientFor(model)
    const result:any=await client.callTool({name:'explain_visual',arguments:{spec:{type:'bar'},bindings}})
    expect(result.isError,JSON.stringify(result)).not.toBe(true)
    expect(unpack(result).dax).toContain('[Sales]')
    expect(unpack(result).bindings).toEqual(bindings)
    expect(model.query).not.toHaveBeenCalled()
  })
  it('serves templates and spec documentation through a real stdio server',async()=>{
    const transport=new StdioClientTransport({command:process.execPath,args:[path.resolve('dist/index.js')],stderr:'pipe'})
    const client=new Client({name:'stdio-qa',version:'1'})
    await client.connect(transport);closed.push(client)
    const templates:any=await client.callTool({name:'list_templates',arguments:{}})
    expect(unpack(templates)).toHaveLength(EXAMPLE_TEMPLATES.length+SHIPPED_TEMPLATES.length)
    const resources=await client.listResources()
    expect(resources.resources).toHaveLength(EXAMPLE_TEMPLATES.length+SHIPPED_TEMPLATES.length+1)
    const docs=await client.readResource({uri:'vilsem://docs/spec-format'})
    expect((docs.contents[0] as any).text).toContain('_val3')
    const tools=await client.listTools()
    expect(tools.tools.map(tool=>tool.name)).toContain('validate_visuals')
    expect(tools.tools.map(tool=>tool.name)).not.toContain('validate_report')
  },20000)
})
