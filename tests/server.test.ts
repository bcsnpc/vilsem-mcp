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
import { injectVisual, RENDERER_GUID } from '@vilsem/core/pbir'

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
  await write('definition/report.json',{resourcePackages:[],themeCollection:{customTheme:{name:'Keep.json'}}})
  await write('definition/pages/pages.json',{pageOrder:['page1']})
  await write('definition/pages/page1/page.json',{name:'page1',displayName:'Page 1',width:1280,height:720})
  await write('definition/pages/page1/visuals/native/visual.json',{name:'native',position:{x:0,y:0,width:100,height:100},visual:{visualType:'slicer'},deliberatelyNotValidated:'native object'})
  await write('definition/bookmarks/bookmark.json',{state:'keep'})
  return root
}

describe('spec and SSR',()=>{
  it('contains a native rasterizer panic and can render the next request',()=>{
    const spec={template:{meta:{id:'offscreen-flat-line'},slots:{cat:{kind:'dimension'},value:{kind:'measure'}},template:{animation:false,xAxis:{type:'category',data:'$slot.cat.categories'},yAxis:{min:0,max:1},series:[{type:'line',showSymbol:false,data:'$slot.value.values'}]}}}
    // resvg 2.6.2 can abort on a flat stroked line entirely outside the SVG.
    try {previewRows(spec,[{_cat:'A',_val:15},{_cat:'B',_val:15}],900,600)}
    catch(error){expect((error as Error).message).toMatch(/PNG rasterization failed in an isolated worker/)}
    expect(previewRows({type:'bar'},[{_cat:'A',_val:1}]).png.length).toBeGreaterThan(100)
  })
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
  it('reads and edits a committed custom visual through SDK dry-run/etag/write without touching native objects',async()=>{
    const root=await fixture(),model=adapter(),client=await clientFor(model)
    const c=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop'}}}))
    const native=path.join(root,'definition/pages/page1/visuals/native/visual.json'),nativeBefore=await fs.readFile(native)
    const committed=await client.callTool({name:'commit_visual',arguments:{reportDir:root,pageName:'page1',visualName:'editable',spec:{type:'bar',config:{title:'Before'}},bindings,layout:{x:200,y:100,width:300,height:200}}});expect(committed.isError).toBeFalsy()
    const file=path.join(root,'definition/pages/page1/visuals/editable/visual.json'),container=JSON.parse(await fs.readFile(file,'utf8'))
    container.visual.objects.appearance=[{properties:{transparency:{expr:{Literal:{Value:'42D'}}},backgroundColor:{solid:{color:{expr:{Literal:{Value:"'#123456'"}}}}}}}]
    await fs.writeFile(file,JSON.stringify(container));const before=await fs.readFile(file)
    const target={reportDir:root,pageName:'page1',visualName:'editable',connectionId:c.connectionId}
    const list=unpack(await client.callTool({name:'list_visuals',arguments:{reportDir:root,thumbnails:false}}));expect(list.visuals.map(v=>v.name)).toEqual(['editable'])
    const read=unpack(await client.callTool({name:'read_visual',arguments:target}));expect(read.spec.config.title).toBe('Before');expect(read.formatPaneOverrides.appearance).toEqual(container.visual.objects.appearance)
    const patch=[{op:'replace',path:'/config/title',value:'After'}]
    const dry=await client.callTool({name:'update_visual',arguments:{...target,patch}});expect(dry.isError,JSON.stringify(dry.content.filter(c=>c.type==='text'))).toBeFalsy();expect(dry.content.filter(c=>c.type==='image')).toHaveLength(2);expect(unpack(dry).dryRun).toBe(true);expect(unpack(dry).nextStep).toBeUndefined();expect(await fs.readFile(file)).toEqual(before)
    const diff=await client.callTool({name:'diff_visual',arguments:{...target,spec:{...read.spec,config:{title:'Compared'}}}});expect(diff.isError).toBeFalsy();expect(diff.content.filter(c=>c.type==='image')).toHaveLength(2);expect(await fs.readFile(file)).toEqual(before)
    const write=await client.callTool({name:'update_visual',arguments:{...target,patch,dryRun:false,etag:read.etag}});expect(write.isError).toBeFalsy();expect(unpack(write).formattingPreserved).toBe(true);expect(unpack(write).nextStep).toContain("click 'Apply'");expect(unpack(write).measureWarning).toBeUndefined()
    const after=JSON.parse(await fs.readFile(file,'utf8'));expect(after.visual.objects.appearance).toEqual(container.visual.objects.appearance);expect(after.visual.query).toEqual(container.visual.query);expect(await fs.readFile(native)).toEqual(nativeBefore)
    const stale=await client.callTool({name:'update_visual',arguments:{...target,patch,dryRun:false,etag:read.etag}});expect(stale.isError).toBe(true)
  },30000)
  it('previews variants with exactly one shared query, one image and per-variant critique',async()=>{
    const model=adapter(),client=await clientFor(model)
    const connection=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop'}}}))
    const args={connectionId:connection.connectionId,bindings,specs:[{type:'bar'},{type:'line'}],labels:['Bars & comparison','Trend <alternative>'],width:300,height:200}
    const result=await client.callTool({name:'preview_variants',arguments:args})
    expect(result.isError).toBeFalsy();expect(model.query).toHaveBeenCalledTimes(1)
    expect(result.content.filter(c=>c.type==='image')).toHaveLength(1)
    const png=Buffer.from((result.content.find(c=>c.type==='image') as any).data,'base64')
    expect(png.readUInt32BE(16)).toBe(600);expect(png.readUInt32BE(20)).toBe(236)
    const detail=unpack(result);expect(detail.sharedData).toBe(true);expect(detail.rowCount).toBe(2);expect(detail.variants).toHaveLength(2);expect(detail.variants[0].critique.findings).toBeInstanceOf(Array)
    const invalid=await client.callTool({name:'preview_variants',arguments:{...args,labels:['only one']}});expect(invalid.isError).toBe(true);expect(model.query).toHaveBeenCalledTimes(1)
    const changed=await client.callTool({name:'preview_variants',arguments:{...args,specs:[{type:'bar'},{type:'line',measures:{Net:{expression:'1',format:'0'}}}]}});expect(changed.isError).toBe(true);expect(model.query).toHaveBeenCalledTimes(1)
  })
  it('returns preview critique by default and supports explicitly disabling it',async()=>{
    const model=adapter(),client=await clientFor(model),c=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop'}}}))
    const args={connectionId:c.connectionId,bindings,spec:{type:'bar'},width:300,height:200}
    const first=unpack(await client.callTool({name:'preview_visual',arguments:args}));expect(first.critique.findings.some(f=>f.code==='missing-format')).toBe(true)
    const disabled=unpack(await client.callTool({name:'preview_visual',arguments:{...args,critique:false}}));expect(disabled.critique).toBeUndefined()
  })
  it('advertises the installed package version in the MCP handshake',async()=>{
    const client=await clientFor(adapter())
    const pkg=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8'))
    expect(client.getServerVersion()).toEqual({name:'vilsem-mcp',version:pkg.version})
  })
  it('returns the chosen viewer locale and preserves raw values in a regional preview',async()=>{
    const model=adapter()
    model.query=vi.fn(async()=>[{'Product[Category]':'A','[Sales]':24914586.8193}])
    model.schema=vi.fn(async()=>({tables:[{name:'Product',columns:[{name:'Category',dataType:'string'}]}],measures:[{table:'Measures',name:'Sales',formatString:'$#,0.00'}]}))
    const client=await clientFor(model)
    const {connectionId}=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop'}}}))
    const response=await client.callTool({name:'preview_visual',arguments:{connectionId,spec:{type:'column'},bindings,locale:'en-IN'}})
    expect(response.isError).not.toBe(true)
    const value=unpack(response)
    expect(value.formattingLocale).toBe('en-IN')
    expect(value.option.series[0].data[0].value).toBe(24914586.8193)
    expect(value.interactions.assessment).toContain('does not verify')
  })
  it('refuses model-format preview/native divergence against an old registered runtime even with explicit dark theme',async()=>{
    const root=await fixture(),model=adapter()
    model.schema=vi.fn(async()=>({tables:[],measures:[{table:'Measures',name:'Sales',formatString:'0.00%'}]}))
    await injectVisual({reportDir:root,pageName:'page1',visualName:'registration',spec:{type:'bar'},bindings})
    const file=path.join(root,'CustomVisuals',RENDERER_GUID,'package.json')
    await fs.writeFile(file,JSON.stringify({visual:{guid:RENDERER_GUID},version:'4.31.0.0'}))
    const client=await clientFor(model)
    const {connectionId}=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop'}}}))
    const result=await client.callTool({name:'commit_visual',arguments:{connectionId,reportDir:root,pageName:'page1',visualName:'formatted_old',spec:{type:'bar',canvasTheme:'dark'},bindings,layout:{x:0,y:0,width:700,height:400}}})
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('4.40.0.0')
    await expect(fs.stat(path.join(root,'definition/pages/page1/visuals/formatted_old'))).rejects.toThrow()
  })
  it('uses model display formats in SSR labels, axes and tooltips without rounding query values',()=>{
    const result=previewRows({type:'column'},[{_cat:'A',_val:.2345}],700,450,{measures:[{name:'Margin',formatString:'0.00%'}]})
    expect(result.svg).toContain('23.45%')
    expect(result.option.yAxis.axisLabel.formatter(.2345)).toBe('23.45%')
    expect(result.option.series[0].tooltip.valueFormatter(.2345)).toBe('23.45%')
    expect(result.option.series[0].data[0].value).toBe(.2345)
  })
  it('previews a report-referenced theme, permits an explicit preview theme and keeps the report bytes unchanged',async()=>{
    const root=await fixture(),model=adapter(),client=await clientFor(model)
    const connection=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop',port:12345}}}))
    await fs.mkdir(path.join(root,'StaticResources','RegisteredResources'),{recursive:true})
    const report=path.join(root,'definition','report.json')
    await fs.writeFile(report,JSON.stringify({themeCollection:{customTheme:{name:'report-theme.json'}},resourcePackages:[{name:'RegisteredResources',type:'RegisteredResources',items:[{name:'report-theme.json',path:'report-theme.json'}]}]}))
    await fs.writeFile(path.join(root,'StaticResources','RegisteredResources','report-theme.json'),JSON.stringify({foreground:'#eeeeee',background:'#111111',dataColors:['#abcdef']}))
    const before=await fs.readFile(report)
    const args={...connection,spec:{type:'bar'},bindings,reportDir:root,width:600,height:400}
    const dark=unpack(await client.callTool({name:'preview_visual',arguments:args}))
    expect(dark.option.backgroundColor).toBe('transparent');expect(dark.option.textStyle.color).toBe('#eeeeee')
    expect(dark.themeSource).toBe('report-theme.json')
    const light=unpack(await client.callTool({name:'preview_visual',arguments:{...args,theme:'light'}}))
    expect(light.option.textStyle.color).toBe('#252423')
    expect(await fs.readFile(report)).toEqual(before)
  })
  it('reports old Vilsem runtime incompatibility without reporting or changing native visuals',async()=>{
    const root=await fixture()
    const template=EXAMPLE_TEMPLATES.find(t=>t.meta.id==='lollipop')!
    const spec={type:'custom',canvasTheme:'dark',template:{...template,transforms:[{waterfall:{category:'category',value:'value'},as:'steps'}]}}
    await injectVisual({reportDir:root,pageName:'page1',visualName:'advanced',spec,bindings})
    const metadata=path.join(root,'CustomVisuals',RENDERER_GUID,'package.json')
    await fs.writeFile(metadata,JSON.stringify({visual:{guid:RENDERER_GUID},version:'4.14.2.0'}))
    const native=path.join(root,'definition/pages/page1/visuals/native/visual.json'),before=await fs.readFile(native)
    const result=await validateVisuals(root)
    expect(result).toHaveLength(1)
    expect(result[0].valid).toBe(false)
    expect(result[0].error).toMatch(/requires vilsem Renderer 4.40/)
    expect(await fs.readFile(native)).toEqual(before)
  })
  it('uses an explicit bounded row window consistently in explanation and preview',async()=>{
    const model=adapter();model.query=vi.fn(async()=>[{'Product[Category]':'A','[Sales]':12},{'Product[Category]':'B','[Sales]':3}])
    const client=await clientFor(model)
    const connection=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop',port:12345}}}))
    const args={...connection,spec:{type:'bar'},bindings,maxRows:2}
    const explanation=unpack(await client.callTool({name:'explain_visual',arguments:args}))
    expect(explanation.dax).toMatch(/TOPN\(2,/)
    const result=unpack(await client.callTool({name:'preview_visual',arguments:args}))
    expect(model.query.mock.calls.at(-1).slice(1)).toEqual([explanation.dax,2])
    expect(result.maxRows).toBe(2);expect(result.warnings[0]).toContain('2-row limit')
    const invalid:any=await client.callTool({name:'preview_visual',arguments:{...args,maxRows:10001}})
    expect(invalid.isError).toBe(true)
  })

  it('requires connected engine validation for scoped measures and carries DEFINE into explanation/preview',async()=>{
    const model=adapter()
    model.schema=vi.fn(async()=>({tables:[{name:'Measures',columns:[]},{name:'Product',columns:[{name:'Category'}]}],measures:[{table:'Measures',name:'Sales'}]}))
    model.query=vi.fn(async()=>[{'Product[Category]':'Bikes','[Margin]':0.25}])
    const client=await clientFor(model)
    const spec={type:'bar',measures:{Margin:'DIVIDE([Sales], 100)'}}
    const noConnection:any=await client.callTool({name:'validate_spec',arguments:{spec}})
    expect(noConnection.isError).toBe(true)
    expect(noConnection.content[0].text).toContain('connectionId is required')
    const connection=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop',port:12345}}}))
    const args={...connection,spec,bindings:{dimensions:bindings.dimensions,measures:[{table:'Measures',name:'Margin'}]}}
    expect((await client.callTool({name:'validate_spec',arguments:args})).isError).not.toBe(true)
    expect(model.query.mock.calls.at(-1)[1]).toContain('DEFINE')
    const explanation=unpack(await client.callTool({name:'explain_visual',arguments:args}))
    expect(explanation.dax).toContain("MEASURE 'Measures'[Margin] = DIVIDE([Sales], 100)")
    const preview:any=await client.callTool({name:'preview_visual',arguments:args})
    expect(preview.isError).not.toBe(true)
    expect(unpack(preview).option.series[0].data[0].value).toBe(0.25)
    const invalid:any=await client.callTool({name:'validate_spec',arguments:{...connection,spec:{type:'bar',measures:{Bad:'[Unknown]'}}}})
    expect(invalid.isError).toBe(true);expect(invalid.content[0].text).toContain('Unknown measure')
    model.query.mockRejectedValueOnce(Error('DAX syntax error at comma'))
    const badSyntax:any=await client.callTool({name:'validate_spec',arguments:{...connection,spec:{type:'bar',measures:{Bad:'DIVIDE(, [Sales])'}}}})
    expect(badSyntax.isError).toBe(true);expect(badSyntax.content[0].text).toContain('DAX syntax error')
  })
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
    model.query.mockImplementation(async(_c,dax)=>{if(dax.startsWith('EVALUATE ROW'))return [{'[__rows]':3,'[c0Distinct]':2,'[c0Blanks]':0}];if(dax.includes('VALUES('))throw Error('part of composite key');return [{'[__vilsem_sample]':'Revenue'},{'[__vilsem_sample]':'Revenue'},{'[__vilsem_sample]':'Profit'}]})
    const client=await clientFor(model),connection=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop'}}}))
    const result=unpack(await client.callTool({name:'get_schema',arguments:connection}))
    expect(result.tables[0].columns[0].sampleSkipped).toContain('not queryable')
    expect(result.tables[0].columns[1].sampleValues).toEqual(['Revenue','Profit'])
    expect(model.query).toHaveBeenCalledTimes(3)
    expect(model.query.mock.calls.some(([_c,dax])=>dax.includes('SELECTCOLUMNS(TOPN(10,'))).toBe(true)
  })
  it('does not expose raw model or data-source definitions through get_schema',async()=>{
    const model=adapter();model.schema.mockResolvedValueOnce({tables:[],measures:[],relationships:[],rawModelBim:{dataSources:[{connectionString:'private'}]}} as any)
    const client=await clientFor(model),connection=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop'}}}))
    const result=unpack(await client.callTool({name:'get_schema',arguments:connection}))
    expect(result).toMatchObject({tables:[],measures:[],detail:'summary'});expect(result.relationships).toBeUndefined();expect(result.rawModelBim).toBeUndefined()
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
    const library=await fs.mkdtemp(path.join(os.tmpdir(),'vilsem-stdio-library-'));temporary.push(library)
    const transport=new StdioClientTransport({command:process.execPath,args:[path.resolve('dist/index.js')],env:{...process.env,VILSEM_TEMPLATES_DIR:library},stderr:'pipe'})
    const client=new Client({name:'stdio-qa',version:'1'})
    await client.connect(transport);closed.push(client)
    const templates:any=await client.callTool({name:'list_templates',arguments:{}})
    expect(unpack(templates)).toHaveLength(EXAMPLE_TEMPLATES.length+SHIPPED_TEMPLATES.length)
    const resources=await client.listResources()
    expect(resources.resources).toHaveLength(EXAMPLE_TEMPLATES.length+SHIPPED_TEMPLATES.length+9)
    expect(resources.resources.map(r=>r.uri)).toContain('vilsem://docs/expression-language')
    const docs=await client.readResource({uri:'vilsem://docs/spec-format'})
    expect((docs.contents[0] as any).text).toContain('_val3')
    const tools=await client.listTools()
    expect(tools.tools.map(tool=>tool.name)).toContain('validate_visuals')
    expect(tools.tools.map(tool=>tool.name)).not.toContain('validate_report')
  },20000)
})


it('returns first/later reload guidance and scoped-measure warnings and validation counts without touching native objects',async()=>{
 const root=await fixture(),model=adapter()
 model.schema=vi.fn(async()=>({tables:[{name:'Measures',columns:[]},{name:'Product',columns:[{name:'Category'}]}],measures:[{table:'Measures',name:'Sales'}]}))
 const client=await clientFor(model)
 const native=path.join(root,'definition/pages/page1/visuals/native/visual.json'),before=await fs.readFile(native)
 const base={reportDir:root,pageName:'page1',bindings,layout:{x:200,y:100,width:600,height:300}}
 const first=await client.callTool({name:'commit_visual',arguments:{...base,visualName:'first',spec:{type:'bar'}}})
 expect(first.isError,JSON.stringify(first)).not.toBe(true)
 expect(unpack(first)).toMatchObject({rendererRegistered:true,nextStep:expect.stringContaining('close Power BI Desktop WITHOUT saving')});expect(unpack(first).measureWarning).toBeUndefined()
 const connection=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop',port:12345}}}))
 const second=await client.callTool({name:'commit_visual',arguments:{...base,...connection,visualName:'scoped',spec:{type:'bar',measures:{Margin:'DIVIDE([Sales],100)'}},bindings:{...bindings,measures:[{table:'Measures',name:'Margin'}]}}})
 expect(second.isError,JSON.stringify(second)).not.toBe(true)
 expect(unpack(second)).toMatchObject({rendererRegistered:false,nextStep:expect.stringContaining("click 'Apply'"),measureWarning:expect.stringContaining('visual-scoped measures (Margin)')})
 const validated:any=await client.callTool({name:'validate_visuals',arguments:{reportDir:root}})
 const results=unpack(validated);expect(results).toHaveLength(2);expect(results.map(v=>v.nativeMeasures)).toContainEqual(['Margin']);expect(results.map(v=>v.nativeMeasures)).toContainEqual([])
 expect(JSON.parse(validated.content[1].text)).toEqual({summary:{visualCount:2,visualsWithNativeMeasures:1,nativeMeasureCount:1}})
 expect(await fs.readFile(native)).toEqual(before)
 const target={reportDir:root,pageName:'page1',visualName:'scoped',connectionId:connection.connectionId}
 const read=unpack(await client.callTool({name:'read_visual',arguments:target}))
 const update=await client.callTool({name:'update_visual',arguments:{...target,dryRun:false,etag:read.etag,patch:[{op:'add',path:'/config',value:{title:'Scoped update'}}]}})
 expect(update.isError,JSON.stringify(update)).not.toBe(true);expect(unpack(update).nextStep).toContain("click 'Apply'");expect(unpack(update).measureWarning).toContain('visual-scoped measures (Margin)')
 const file=path.join(root,'definition/pages/page1/visuals/scoped/visual.json'),value=JSON.parse(await fs.readFile(file,'utf8'))
 for(const state of Object.values(value.visual.query.queryState) as any[])state.projections=(state.projections??[]).filter(p=>!p.field?.NativeMeasure)
 value.visual.query.queryState.content=null
 await fs.writeFile(file,JSON.stringify(value));const invalid=await validateVisuals(root);expect(invalid.every(v=>v.nativeMeasures.length===0)).toBe(true);expect(invalid.find(v=>v.path===file)?.valid).toBe(false)
})


it('nudges all five tool results until a successful playbook read, independently per server',async()=>{
 const client=await clientFor(adapter()),root=await fixture()
 for(const read of [false,true]){
  if(read)await client.callTool({name:'get_playbook',arguments:{}})
  const connected=await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop',port:12345}}}),connection=unpack(connected)
  const calls=[connected,
   await client.callTool({name:'get_schema',arguments:{connectionId:connection.connectionId}}),
   await client.callTool({name:'preview_visual',arguments:{connectionId:connection.connectionId,spec:{type:'bar'},bindings}}),
   await client.callTool({name:'preview_variants',arguments:{connectionId:connection.connectionId,specs:[{type:'bar'}],labels:['Bar'],bindings}}),
   await client.callTool({name:'commit_visual',arguments:{reportDir:root,pageName:'page1',visualName:read?'after':'before',spec:{type:'bar'},bindings,layout:{x:100,y:100,width:500,height:350}}})]
  for(const result of calls){expect(result.isError,JSON.stringify(result)).not.toBe(true);expect(unpack(result).playbookHint).toBe(read?undefined:'Call get_playbook (no arguments) before designing or committing visuals; it contains the required workflow and reload rules.')}
 }
 const other=await clientFor(adapter());expect(unpack(await other.callTool({name:'connect_model',arguments:{source:{kind:'desktop',port:12345}}})).playbookHint).toBeDefined()
})
