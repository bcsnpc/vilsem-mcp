import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import fs from 'node:fs/promises'
import {createRequire} from 'node:module'
import { EXAMPLE_TEMPLATES } from '@vilsem/core/templates/examples'
import { buildVisualDax, compileScopedMeasures, normaliseRows, normaliseTableRows, resolveRowKey } from '@vilsem/core/dax'
import { SHIPPED_TEMPLATES } from './templates.js'
import { Models } from './models.js'
import { listPages, validateVisuals, validateSpec, validateBindings, commitVisual } from './reports.js'
import { previewRows } from './preview.js'
import { readReportTheme } from '@vilsem/core/pbir'
import { assessInteractions } from './interactions.js'

const object=z.record(z.string(),z.unknown())
const packageVersion=createRequire(import.meta.url)('../package.json').version
const bindings=z.object({dimensions:z.array(z.object({table:z.string().min(1),column:z.string().min(1)})).max(6).default([]),measures:z.array(z.object({table:z.string().min(1),name:z.string().min(1)})).min(1).max(6)})
const text=(value:any)=>({content:[{type:'text' as const,text:JSON.stringify(value,(_key,value)=>typeof value==='function'?'[formatter]':value)}]})

export function createServer(models=new Models()){
  const server=new McpServer({name:'vilsem-mcp',version:packageVersion})
  // Syntax/binding validation belongs to the DAX engine. The static pass adds
  // precise field/cycle errors; it is not presented as a complete DAX parser.
  async function checkMeasures(spec:any,connectionId?:string,fieldBindings?:any){
    if(!spec.measures || !Object.keys(spec.measures).length)return
    if(!connectionId)throw Error('connectionId is required to validate visual-scoped measures against the model and DAX engine')
    const schema=await models.fields(connectionId)
    const homeTable=fieldBindings?.measures?.[0]?.table || schema.measures[0]?.table || schema.tables[0]?.name
    const compiled=compileScopedMeasures(spec.measures,{schema,homeTable})
    const quoteName=(name:string)=>`[${name.replace(/\]/g,']]')}]`
    const quoteTable=(name:string)=>`'${name.replace(/'/g,"''")}'`
    const fields=compiled.definitions.map(definition=>`"${definition.name.replace(/"/g,'""')}", ${quoteTable(homeTable)}${quoteName(definition.name)}`)
    const dax=compiled.define+`EVALUATE ROW(${fields.join(', ')})`
    try{await models.query(connectionId,dax,1)}catch(error){throw Error(`Visual-scoped measure validation: ${(error as Error).message}`)}
  }
  const tool=(name:string,description:string,schema:any,handler:any)=>server.registerTool(name,{description,inputSchema:schema.shape},async args=>{
    try{return await handler(args)}catch(error){return {isError:true,content:[{type:'text' as const,text:(error as Error).message}]}}
  })
  tool('connect_model','Connect read-only to an existing model. Prefer source.kind="report" with reportDir to follow definition.pbir: byPath matches the open Desktop model or returns offline schema-only TMDL; byConnection resolves the configured Fabric model or Windows-integrated SSAS endpoint. source.kind="desktop" auto-detects a local port; source.kind="fabric" accepts workspaceId/datasetId. Keep connectionId for schema, DAX and previews. A schemaOnly connection cannot execute queries or live previews. No model objects are created or changed.',z.object({source:z.discriminatedUnion('kind',[z.object({kind:z.literal('report'),reportDir:z.string().min(1)}),z.object({kind:z.literal('desktop'),port:z.number().int().min(1).max(65535).optional()}),z.object({kind:z.literal('fabric'),workspaceId:z.string().uuid(),datasetId:z.string().uuid()})])}),async({source})=>text(await models.connect(source)))
  tool('get_schema','Read tables, columns, data types and measures from the connected semantic model. Up to ten distinct sample values are queried per column; individual sample failures are returned on that column without inventing data. No schema or model objects are changed.',z.object({connectionId:z.string().uuid()}),async({connectionId})=>text(await models.schema(connectionId)))
  tool('run_dax','Execute a read-only DAX EVALUATE table query against a connected model. Returns at most maxRows rows, default 200. Use it to inspect data and verify visual bindings; this tool does not expose XMLA commands or persistent model changes.',z.object({connectionId:z.string().uuid(),dax:z.string().min(1).max(100000),maxRows:z.number().int().min(1).max(10000).default(200)}),async({connectionId,dax,maxRows})=>text({rows:await models.query(connectionId,dax,maxRows)}))
  tool('list_templates','List the shared Vilsem declarative visual templates with their slot and parameter contracts. Use these templates as starting points and read vilsem://docs/spec-format before changing token expressions or formatter templates.',z.object({}),async()=>text([...EXAMPLE_TEMPLATES,...SHIPPED_TEMPLATES]))
  tool('validate_spec','Resolve a Vilsem spec without data. With spec.measures, connectionId is required: validates schema references, cycles and scalar DAX using the connected engine. Run before preview_visual.',z.object({spec:object,connectionId:z.string().uuid().optional()}),async({spec,connectionId})=>{const option=validateSpec(spec);await checkMeasures(spec,connectionId);return text({option})})
  tool('explain_visual','Explain a Vilsem custom visual spec, its field bindings, resolved empty-data ECharts option and exact DAX query before preview or commit. Does not inspect or modify native visuals or model objects.',z.object({spec:object,bindings,connectionId:z.string().uuid().optional(),maxRows:z.number().int().min(1).max(10000).default(200)}),async({spec,bindings,connectionId,maxRows})=>{
    const option=validateSpec(spec);validateBindings(spec,bindings);await checkMeasures(spec,connectionId,bindings)
    return text({type:spec.type || 'custom',template:(spec.template as any)?.meta?.id || null,bindings,dax:buildVisualDax({...bindings,scopedMeasures:spec.measures,maxRows}),option,interactions:['selection','cross-filter','cross-highlight','native tooltip','context menu']})
  })
  tool('preview_visual','Validate a Vilsem spec, query actual bound fields and return PNG plus option. Theme defaults to the report theme when reportDir is supplied, light otherwise. Explicit spec.canvasTheme overrides unless a stored pane override requests report theme. maxRows is 1..10000 (default 200); bounded queries do not prove population coverage. This does not write a report.',z.object({connectionId:z.string().uuid(),spec:object,bindings,reportDir:z.string().min(1).optional(),theme:z.union([z.enum(['report','light','dark']),object]).optional(),locale:z.string().min(2).max(64).default('en-US'),width:z.number().int().min(100).max(2400).default(800),height:z.number().int().min(100).max(2400).default(500),maxRows:z.number().int().min(1).max(10000).default(200)}),async({connectionId,spec,bindings,reportDir,theme,locale,width,height,maxRows})=>{
    validateSpec(spec)
    validateBindings(spec,bindings)
    await checkMeasures(spec,connectionId,bindings)
    const dimensions=bindings.dimensions.map(field=>`${field.table}[${field.column}]`),measures=bindings.measures.map(field=>field.name)
    const dax=buildVisualDax({...bindings,scopedMeasures:spec.measures,maxRows})
    const raw=await models.query(connectionId,dax,maxRows)
    const rows=(dimensions.length > 1 ? normaliseTableRows(raw, dimensions, measures) : normaliseRows(raw, dimensions[0] ? resolveRowKey(raw, dimensions[0]) : null, measures))
    const reportTheme = (theme ?? (reportDir?'report':'light')) === 'report' ? await readReportTheme(reportDir) : {theme,source:'explicit preview theme',warnings:[]}
    const schema=await models.fields(connectionId)
    const measureMetadata=bindings.measures.map(field=>({...field,formatString:schema.measures.find(m=>m.name.toLowerCase()===field.name.toLowerCase()&&m.table?.toLowerCase()===field.table.toLowerCase())?.formatString}))
    const result=previewRows(spec,rows,width,height,{theme:reportTheme.theme ?? 'light',locale,measures:measureMetadata})
    return {content:[{type:'image' as const,data:Buffer.from(result.png).toString('base64'),mimeType:'image/png'},...text({option:result.option,rowCount:rows.length,maxRows,interactions:assessInteractions(spec,result.option,rows.length),measureFormats:measureMetadata,formattingLocale:locale,themeSource:reportTheme.source,warnings:[...reportTheme.warnings,...(rows.length>=maxRows?[`Preview reached its ${maxRows}-row limit; this is a bounded sample, not proof of complete model coverage.`]:[])]}).content]}
  })
  tool('list_pages','Read existing PBIR pages and visual names, types and positions so you can choose a page and avoid overlap. This tool does not edit or validate native visuals, slicers, bookmarks, filters or report themes.',z.object({reportDir:z.string().min(1)}),async({reportDir})=>text(await listPages(reportDir)))
  tool('commit_visual','Add one Vilsem Renderer visual to one existing PBIR page using @vilsem/core. Existing visual names are refused; the only additional changes are missing renderer resources and registration. Native visuals, slicers, bookmarks, filters, themes and model objects are not edited. If Desktop is open, accept its external-change reload prompt after this call.',z.object({reportDir:z.string().min(1),pageName:z.string().min(1),visualName:z.string().min(1),spec:object,bindings,connectionId:z.string().uuid().optional(),layout:z.object({x:z.number().min(0),y:z.number().min(0),width:z.number().positive(),height:z.number().positive(),z:z.number().min(0).optional(),tabOrder:z.number().min(0).optional()})}),async args=>{
    await checkMeasures(args.spec,args.connectionId,args.bindings)
    // Preserve preview/native parity for model formats even when canvasTheme
    // deliberately selects a legacy light/dark appearance.
    const schema=args.connectionId?await models.fields(args.connectionId):null
    const formattedBindings={...args.bindings,measures:args.bindings.measures.map(field=>({...field,formatString:schema?.measures.find(m=>m.name?.toLowerCase()===field.name.toLowerCase()&&m.table?.toLowerCase()===field.table.toLowerCase())?.formatString}))}
    return text(await commitVisual({...args,bindings:formattedBindings}))
  })
  tool('validate_visuals','Validate only PBIR visual containers whose visualType is the stable Vilsem Renderer GUID. Reports schema errors, unreadable spec literals and unsupported current-renderer specs. Native visuals and all report-level objects are neither validated nor reported.',z.object({reportDir:z.string().min(1)}),async({reportDir})=>text(await validateVisuals(reportDir)))
  for(const template of [...EXAMPLE_TEMPLATES,...SHIPPED_TEMPLATES]){
    const uri=`vilsem://templates/${template.meta.id}`
    server.registerResource(template.meta.id,uri,{mimeType:'application/json'},async uri=>({contents:[{uri:uri.href,mimeType:'application/json',text:JSON.stringify(template)}]}))
  }
  server.registerResource('spec-format','vilsem://docs/spec-format',{mimeType:'text/markdown'},async uri=>({contents:[{uri:uri.href,mimeType:'text/markdown',text:await fs.readFile(new URL('../docs/spec-format.md',import.meta.url),'utf8')}]}))
  return server
}
