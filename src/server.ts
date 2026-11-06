import { McpServer,ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import fs from 'node:fs/promises'
import {createRequire} from 'node:module'
import { EXAMPLE_TEMPLATES } from '@vilsem/core/templates/examples'
import { buildVisualDax, compileScopedMeasures, normaliseRows, normaliseTableRows, resolveRowKey } from '@vilsem/core/dax'
import { SHIPPED_TEMPLATES } from './templates.js'
import { Models } from './models.js'
import { listPages, validateVisuals, validateSpec, validateBindings, commitVisual, pageBindings } from './reports.js'
import { previewRows, variantSheet } from './preview.js'
import {captureBrowserMotion} from './motionBrowser.js'
import { readReportTheme } from '@vilsem/core/pbir'
import { assessInteractions } from './interactions.js'
import { designBrief } from './design.js'
import {readStoredVisual,listStoredVisuals,patchVisualSpec,specDiff,writeStoredVisual} from './editing.js'
import {makeVisualContainer,assertReportRenderer,RENDERER_GUID} from '@vilsem/core/pbir'
import {desktopWarning} from './reports.js'
import {scopedMeasuresOf} from '@vilsem/core/spec/migrate'
import {listUserTemplates,readUserTemplate,saveUserTemplate,deleteUserTemplate} from './templateLibrary.js'
import {referenceImage,structuralDiff} from './referenceImages.js'
import {decodeDesignImage} from '@vilsem/core/images/decode'
import {extractDesignTokens} from '@vilsem/core/images'

const object=z.record(z.string(),z.unknown())
const packageVersion=createRequire(import.meta.url)('../package.json').version
const bindings=z.object({dimensions:z.array(z.object({table:z.string().min(1),column:z.string().min(1)})).max(6).default([]),measures:z.array(z.object({table:z.string().min(1),name:z.string().min(1)})).min(1).max(6)})
const text=(value:any)=>({content:[{type:'text' as const,text:JSON.stringify(value,(_key,value)=>typeof value==='function'?'[formatter]':value)}]})

export function createServer(models=new Models()){
  const server=new McpServer({name:'vilsem-mcp',version:packageVersion})
  server.registerPrompt('design_visual',{description:'Get model context and a structured brief for the CALLING AGENT to design a new Vilsem visual or edit an existing one. Optional reference_image is a local PNG/JPEG path or data URI. No LLM/model/API key inside the MCP.',argsSchema:{intent:z.string().min(1),connectionId:z.string().uuid(),page:z.string().optional(),reportDir:z.string().optional(),reference_image:z.string().optional()}},async({intent,connectionId,page,reportDir,reference_image})=>{
    const context=await models.schema(connectionId,{detail:'summary'})
    let pageContext
    if(page){const root=reportDir || models.reportDir(connectionId);if(!root)throw Error('reportDir is required with page for a non-report connection');pageContext=await pageBindings(root,page)}
    const reference=reference_image?await referenceImage(reference_image):null
    return {description:'Complete the analytical/design brief using real fields, then validate and preview before writing.',messages:[{role:'user' as const,content:{type:'text' as const,text:JSON.stringify(designBrief(intent,context,pageContext,reference?.tokens),null,2)}},...(reference?[{role:'user' as const,content:{type:'image' as const,data:reference.bytes.toString('base64'),mimeType:reference.mimeType}}]:[])]}
  })
  // Syntax/binding validation belongs to the DAX engine. The static pass adds
  // precise field/cycle errors; it is not presented as a complete DAX parser.
  async function checkMeasures(spec:any,connectionId?:string,fieldBindings?:any){
    const scopedMeasures=scopedMeasuresOf(spec)
    if(!Object.keys(scopedMeasures).length)return
    if(!connectionId){const error:any=Error('connectionId is required to validate visual-scoped measures against the model and DAX engine');error.diagnostics=[{path:'/connectionId',message:error.message,expected:'A connectionId returned by connect_model',suggestions:['Connect to the intended model and retry validation.']}];error.suggestions=error.diagnostics[0].suggestions;throw error}
    const schema=await models.fields(connectionId)
    const homeTable=fieldBindings?.measures?.[0]?.table || schema.measures[0]?.table || schema.tables[0]?.name
    const measureError=(failure:any)=>{
      const message=failure.message,name=Object.keys(spec.measures).find(name=>message.includes(`[${name}]`)||message.includes(`measure ${name}`))
      const path=name?'/measures/'+name.replace(/~/g,'~0').replace(/\//g,'~1')+(typeof spec.measures[name]==='object'?'/expression':''):'/measures'
      const error:any=Error(message);error.diagnostics=[{path,message,expected:'Valid scalar DAX with existing model fields and acyclic visual-scoped dependencies',suggestions:['Inspect get_schema(detail:full), correct the expression or field reference, then validate again.']}];error.suggestions=error.diagnostics[0].suggestions;return error
    }
    let compiled
    try{compiled=compileScopedMeasures(scopedMeasures,{schema,homeTable})}catch(error){throw measureError(error)}
    const quoteName=(name:string)=>`[${name.replace(/\]/g,']]')}]`
    const quoteTable=(name:string)=>`'${name.replace(/'/g,"''")}'`
    const fields=compiled.definitions.map(definition=>`"${definition.name.replace(/"/g,'""')}", ${quoteTable(homeTable)}${quoteName(definition.name)}`)
    const dax=compiled.define+`EVALUATE ROW(${fields.join(', ')})`
    try{await models.query(connectionId,dax,1)}catch(error){throw measureError(Error(`Visual-scoped measure validation: ${(error as Error).message}`))}
  }
  const tool=(name:string,description:string,schema:any,handler:any)=>server.registerTool(name,{description,inputSchema:schema.shape},async args=>{
    try{return await handler(args)}catch(error){return {isError:true,content:[{type:'text' as const,text:(error as any).diagnostics?JSON.stringify({valid:false,errors:(error as any).diagnostics,suggestions:(error as any).suggestions}):(error as Error).message}]}}
  })
  async function previewData({connectionId,spec,bindings,reportDir,theme,maxRows}:any){
    const dimensions=bindings.dimensions.map(field=>`${field.table}[${field.column}]`),measures=bindings.measures.map(field=>field.name)
    const dax=buildVisualDax({...bindings,scopedMeasures:scopedMeasuresOf(spec),maxRows})
    const raw=await models.query(connectionId,dax,maxRows)
    const rows=(dimensions.length > 1 ? normaliseTableRows(raw, dimensions, measures) : normaliseRows(raw, dimensions[0] ? resolveRowKey(raw, dimensions[0]) : null, measures))
    const reportTheme = (theme ?? (reportDir?'report':'light')) === 'report' ? await readReportTheme(reportDir) : {theme,source:'explicit preview theme',warnings:[]}
    const schema=await models.fields(connectionId)
    const measureMetadata=bindings.measures.map(field=>({...field,formatString:schema.measures.find(m=>m.name.toLowerCase()===field.name.toLowerCase()&&m.table?.toLowerCase()===field.table.toLowerCase())?.formatString || field.formatString}))
    return {rows,reportTheme,measureMetadata}
  }
  tool('extract_design_tokens','Get bounded PNG/JPEG image statistics only: palette/background/light-dark/aspect ratio and approximate text/gridline evidence. No ML/OCR or inferred fields/data. image is a local path or PNG/JPEG data URI.',z.object({image:z.string().min(1)}),async({image})=>text((await referenceImage(image)).tokens))
  tool('compare_preview','Render with real model data at the reference aspect ratio and return reference/render side by side, critique and a structural diff. The calling agent may supply reference_structure; semantic reference properties otherwise remain unknown. Writes no report.',z.object({connectionId:z.string().uuid(),spec:object,bindings,reference_image:z.string().min(1),reference_structure:z.object({seriesCount:z.number().int().min(0).max(200).optional(),legendPosition:z.string().max(80).optional(),labelPresence:z.boolean().optional()}).optional(),reportDir:z.string().optional(),maxRows:z.number().int().min(1).max(10000).default(200)}),async args=>{
    validateSpec(args.spec);validateBindings(args.spec,args.bindings);await checkMeasures(args.spec,args.connectionId,args.bindings)
    const reference=await referenceImage(args.reference_image),aspect=reference.tokens.layout.aspectRatio
    if(aspect<.1||aspect>10)throw Error('Reference aspect ratio must be0.1..10 for a readable bounded comparison')
    const width=Math.round(aspect>=1?1000:1000*aspect),height=Math.round(aspect>=1?1000/aspect:1000)
    const {rows,reportTheme,measureMetadata}=await previewData({...args,theme:args.reportDir?'report':'light'})
    const rendered=previewRows(args.spec,rows,width,height,{theme:reportTheme.theme??'light',measures:measureMetadata,sampleMotion:false})
    const tokens=extractDesignTokens({image:decodeDesignImage(rendered.png)}),png=variantSheet([{png:reference.bytes,label:'Reference — design only'},{png:rendered.png,label:'Vilsem — live model data'}],width,height)
    return {content:[{type:'image' as const,data:png.toString('base64'),mimeType:'image/png'},...text({critique:rendered.critique,structuralDiff:structuralDiff(reference.tokens,rendered.option,tokens,args.reference_structure),rowCount:rows.length,referenceTokens:reference.tokens,warnings:reportTheme.warnings}).content]}
  })
  tool('connect_model','Connect read-only to an existing model. Prefer source.kind="report" with reportDir to follow definition.pbir: byPath matches the open Desktop model or returns offline schema-only TMDL; byConnection resolves the configured Fabric model or Windows-integrated SSAS endpoint. source.kind="desktop" auto-detects a local port; source.kind="fabric" accepts workspaceId/datasetId. Keep connectionId for schema, DAX and previews. A schemaOnly connection cannot execute queries or live previews. No model objects are created or changed.',z.object({source:z.discriminatedUnion('kind',[z.object({kind:z.literal('report'),reportDir:z.string().min(1)}),z.object({kind:z.literal('desktop'),port:z.number().int().min(1).max(65535).optional()}),z.object({kind:z.literal('fabric'),workspaceId:z.string().uuid(),datasetId:z.string().uuid()})])}),async({source})=>text(await models.connect(source)))
  tool('get_schema','Read model context without writes. Default detail=summary omits measure DAX and relationship graph; ask for full to understand calculations and join paths. Columns include exact DAX cardinality, BLANK share and numeric/date min/max, plus up to10 distinct samples and hidden/key flags. Unavailable fields carry explicit errors. Profiling is cached60s; use refresh after model/data changes. Optional page uses an internal/display page name plus reportDir (or a report-kind connection) to add read-only existing page bindings.',z.object({connectionId:z.string().uuid(),detail:z.enum(['summary','full']).default('summary'),refresh:z.boolean().default(false),page:z.string().min(1).optional(),reportDir:z.string().min(1).optional()}),async({connectionId,detail,refresh,page,reportDir})=>{
    const schema=await models.schema(connectionId,{detail,refresh})
    if(page){const root=reportDir || models.reportDir(connectionId);if(!root)throw Error('reportDir is required for page context when the connection is not report-kind');return text({...schema,pageBindings:await pageBindings(root,page)})}
    return text(schema)
  })
  tool('run_dax','Execute a read-only DAX EVALUATE table query against a connected model. Returns at most maxRows rows, default 200. Use it to inspect data and verify visual bindings; this tool does not expose XMLA commands or persistent model changes.',z.object({connectionId:z.string().uuid(),dax:z.string().min(1).max(100000),maxRows:z.number().int().min(1).max(10000).default(200)}),async({connectionId,dax,maxRows})=>text({rows:await models.query(connectionId,dax,maxRows)}))
  tool('list_templates','List shipped and saved user templates with source and contracts. VILSEM_TEMPLATES_DIR may point to a shared library. Unreadable user files are reported explicitly.',z.object({}),async()=>text([...EXAMPLE_TEMPLATES,...SHIPPED_TEMPLATES].map(t=>({...t,source:'shipped'})).concat(await listUserTemplates())))
  tool('save_template','Save a validated complete spec to the OS user template library, or VILSEM_TEMPLATES_DIR. Names are lowercase slugs; existing entries are refused. This does not write a report or model.',z.object({name:z.string(),description:z.string().max(2000).default(''),spec:object,tags:z.array(z.string().max(80)).max(20).default([])}),async args=>text(await saveUserTemplate(args)))
  tool('delete_template','Delete one named user-library template only. Shipped templates, reports and models are never deleted.',z.object({name:z.string()}),async({name})=>text(await deleteUserTemplate(name)))
  tool('validate_spec','Resolve a Vilsem spec without data. With spec.measures, connectionId is required: validates schema references, cycles and scalar DAX using the connected engine. Run before preview_visual.',z.object({spec:object,connectionId:z.string().uuid().optional()}),async({spec,connectionId})=>{const option=validateSpec(spec);await checkMeasures(spec,connectionId);return text({option})})
  tool('explain_visual','Explain a Vilsem custom visual spec, its field bindings, resolved empty-data ECharts option and exact DAX query before preview or commit. Does not inspect or modify native visuals or model objects.',z.object({spec:object,bindings,connectionId:z.string().uuid().optional(),maxRows:z.number().int().min(1).max(10000).default(200)}),async({spec,bindings,connectionId,maxRows})=>{
    const option=validateSpec(spec);validateBindings(spec,bindings);await checkMeasures(spec,connectionId,bindings)
    return text({type:spec.type || 'custom',template:(spec.template as any)?.meta?.id || null,bindings,dax:buildVisualDax({...bindings,scopedMeasures:scopedMeasuresOf(spec),maxRows}),option,interactions:['selection','cross-filter','cross-highlight','native tooltip','context menu']})
  })
  tool('preview_visual','motion:auto captures actual animation in an installed fresh network-blocked headless browser when available; motion:states uses discrete timeline states, and motion:browser requires a browser. Optional frames (2..12) also returns a timeline-state contact sheet. Validate a Vilsem spec, query actual bound fields and return PNG plus option and actionable critique (default true). Critique uses rendered text bounds and option checks; inspect its limitations and iterate before committing. Theme defaults to the report theme when reportDir is supplied, light otherwise. Explicit spec.canvasTheme overrides unless a stored pane override requests report theme. maxRows is 1..10000 (default 200); bounded queries do not prove population coverage. This does not write a report.',z.object({connectionId:z.string().uuid(),spec:object,bindings,reportDir:z.string().min(1).optional(),theme:z.union([z.enum(['report','light','dark']),object]).optional(),critique:z.boolean().default(true),motion:z.enum(['auto','states','browser']).default('auto'),frames:z.number().int().min(2).max(12).optional(),locale:z.string().min(2).max(64).default('en-US'),width:z.number().int().min(100).max(2400).default(800),height:z.number().int().min(100).max(2400).default(500),maxRows:z.number().int().min(1).max(10000).default(200)}),async({connectionId,spec,bindings,reportDir,theme,critique,motion,frames,locale,width,height,maxRows})=>{
    validateSpec(spec)
    validateBindings(spec,bindings)
    await checkMeasures(spec,connectionId,bindings)
    const {rows,reportTheme,measureMetadata}=await previewData({connectionId,spec,bindings,reportDir,theme,maxRows})
    const result=previewRows(spec,rows,width,height,{theme:reportTheme.theme ?? 'light',locale,measures:measureMetadata,critique,frames})
    let animated=result.apng,motionInfo:any=result.motion
    if(motion!=='states'&&result.option.animation!==false&&((spec.template as any)?.animation||result.option.options?.length)){
      try{
        const captured=await captureBrowserMotion(spec,rows,result.option,width,height,{theme:reportTheme.theme??'light',locale,measures:measureMetadata},frames??8)
        animated=captured.apng;motionInfo={...result.motion,kind:'browser-clock',browser:captured.metadata,contactSheetKind:result.contactSheet?'timeline-state-overview':undefined,warnings:result.motion.warnings.filter(w=>!w.startsWith('Enter/update tween capture'))}
      }catch(error){if(motion==='browser')throw error;motionInfo={...result.motion,warnings:[...result.motion.warnings,'Browser motion capture unavailable: '+(error as Error).message]}}
    }
    return {content:[{type:'image' as const,data:Buffer.from(result.png).toString('base64'),mimeType:'image/png'},...(animated?[{type:'image' as const,data:animated.toString('base64'),mimeType:'image/apng'}]:[]),...(result.contactSheet?[{type:'image' as const,data:result.contactSheet.toString('base64'),mimeType:'image/png'}]:[]),...text({option:result.option,critique:result.critique,motion:motionInfo,rowCount:rows.length,maxRows,interactions:assessInteractions(spec,result.option,rows.length),measureFormats:measureMetadata,formattingLocale:locale,themeSource:reportTheme.source,warnings:[...reportTheme.warnings,...(rows.length>=maxRows?[`Preview reached its ${maxRows}-row limit; this is a bounded sample, not proof of complete model coverage.`]:[])]}).content]}
  })
  tool('preview_variants','Compare1..4 candidate specs using ONE identical bound-data query; returns one labelled2x2 PNG and per-candidate critique. Bindings and visual-scoped measures must be shared, so design differences cannot silently change the numbers. Use this to choose between approaches before committing.',z.object({connectionId:z.string().uuid(),specs:z.array(object).min(1).max(4),labels:z.array(z.string().min(1).max(80)).min(1).max(4),bindings,reportDir:z.string().min(1).optional(),theme:z.union([z.enum(['report','light','dark']),object]).optional(),locale:z.string().min(2).max(64).default('en-US'),width:z.number().int().min(100).max(1200).default(600),height:z.number().int().min(100).max(1200).default(400),maxRows:z.number().int().min(1).max(10000).default(200)}),async({connectionId,specs,labels,bindings,reportDir,theme,locale,width,height,maxRows})=>{
    if(specs.length!==labels.length)throw Error('Provide one label per candidate spec')
    const first=specs[0],scoped=JSON.stringify(first.measures || {})
    for(const spec of specs){validateSpec(spec);validateBindings(spec,bindings);if(JSON.stringify(spec.measures || {})!==scoped)throw Error('All variants must share the same visual-scoped measures; use preview_visual for different queries')}
    await checkMeasures(first,connectionId,bindings)
    const {rows,reportTheme,measureMetadata}=await previewData({connectionId,spec:first,bindings,reportDir,theme,maxRows})
    const results=specs.map(spec=>previewRows(spec,rows,width,height,{theme:reportTheme.theme ?? 'light',locale,measures:measureMetadata,sampleMotion:false}))
    const png=variantSheet(results.map((result,i)=>({png:result.png,label:labels[i]})),width,height)
    return {content:[{type:'image' as const,data:png.toString('base64'),mimeType:'image/png'},...text({rowCount:rows.length,maxRows,sharedData:true,variants:results.map((r,i)=>({label:labels[i],critique:r.critique})),themeSource:reportTheme.source,warnings:[...reportTheme.warnings,...(rows.length>=maxRows?['Bounded query reached maxRows; coverage is not exhaustive.']:[])]}).content]}
  })
  async function storedPreview(reportDir:string,item:any,spec:any,connectionId?:string){
    const id=connectionId || (await models.connect({kind:'report',reportDir})).connectionId
    const schema=await models.fields(id)
    const fieldBindings={dimensions:item.bindings.dimensions,measures:item.bindings.measures.map(m=>({...m,table:m.table || schema.measures[0]?.table || schema.tables[0]?.name}))}
    validateBindings(spec,fieldBindings)
    await checkMeasures(spec,id,fieldBindings)
    const {rows,reportTheme,measureMetadata}=await previewData({connectionId:id,spec,bindings:fieldBindings,reportDir,maxRows:1000})
    const result=previewRows(spec,rows,item.layout.width,item.layout.height,{theme:reportTheme.theme,locale:'en-US',measures:measureMetadata,formatPaneOverrides:item.formatPaneOverrides,sampleMotion:false})
    return {result,connectionId:id,bindings:fieldBindings,rowCount:rows.length,warnings:[...item.warnings,...reportTheme.warnings,...(rows.length>=1000?['Preview reached its1000-row limit; not exhaustive.']:[])]}
  }
  const editTarget={reportDir:z.string().min(1),pageName:z.string().min(1),visualName:z.string().min(1),connectionId:z.string().uuid().optional()}
  tool('list_visuals','Read every vilsem Renderer visual across report pages from PBIR, with summary, bindings, version, layout and optional live thumbnail. Native visuals are skipped. Defaults to live thumbnails; pass thumbnails:false for metadata-only discovery. No separate manifest is used.',z.object({reportDir:z.string().min(1),connectionId:z.string().uuid().optional(),thumbnails:z.boolean().default(true)}),async({reportDir,connectionId,thumbnails})=>{
    const visuals=await listStoredVisuals(reportDir),images:any[]=[]
    let id=connectionId
    for(const [index,v] of visuals.entries())if(thumbnails&&v.readable!==false){
      try{const item=await readStoredVisual(reportDir,v.page,v.name);item.layout={...item.layout,width:320,height:200};const rendered=await storedPreview(reportDir,item,item.spec,id);id=rendered.connectionId;v.thumbnailContentIndex=images.length+1;images.push({type:'image',data:rendered.result.png.toString('base64'),mimeType:'image/png'});v.thumbnailWarnings=rendered.warnings}
      catch(error){v.thumbnailError=(error as Error).message}
    }
    return {content:[...text({visuals}).content,...images]}
  })
  tool('read_visual','Read a saved vilsem visual: migrated full spec, original-version provenance, field bindings, layout, scoped measures, separate format-pane overrides and current live PNG. Uses connectionId or connects through definition.pbir. Never reads native visuals.',z.object(editTarget),async({reportDir,pageName,visualName,connectionId})=>{
    const item=await readStoredVisual(reportDir,pageName,visualName),p=await storedPreview(reportDir,item,item.spec,connectionId)
    return {content:[...text({spec:item.spec,bindings:item.bindings,layout:item.layout,measures:item.spec.measures || {},formatPaneOverrides:item.formatPaneOverrides,specVersion:item.specVersion,sourceSpecVersion:item.sourceSpecVersion,etag:item.etag,critique:p.result.critique,warnings:p.warnings}).content,{type:'image' as const,data:p.result.png.toString('base64'),mimeType:'image/png'}]}
  })
  async function editPreviews(args:any,next:any,item:any){
    const before=await storedPreview(args.reportDir,item,item.spec,args.connectionId)
    const after=await storedPreview(args.reportDir,args.resetFormatting?{...item,formatPaneOverrides:{}}:item,next,before.connectionId)
    return {before,after,content:[{type:'image' as const,data:before.result.png.toString('base64'),mimeType:'image/png'},{type:'image' as const,data:after.result.png.toString('base64'),mimeType:'image/png'}]}
  }
  tool('diff_visual','Read-only comparison against one saved vilsem visual: JSON Patch diff and before/after live PNGs with critique. This writes no files. Run before replacing an existing design.',z.object({...editTarget,spec:object}),async args=>{
    const item=await readStoredVisual(args.reportDir,args.pageName,args.visualName);validateSpec(args.spec)
    const p=await editPreviews(args,args.spec,item)
    return {content:[...text({diff:specDiff(item.spec,args.spec),etag:item.etag,beforeCritique:p.before.result.critique,afterCritique:p.after.result.critique,warnings:p.after.warnings}).content,...p.content]}
  })
  tool('update_visual','Apply RFC6902 JSON Patch to the stored vilsem spec. Validates and previews before writing; returns diff and before/after PNGs. Defaults dryRun:true. Preserves manual format-pane objects unless resetFormatting:true; renderer identity/prototype/version paths are refused. Optional etag protects a reviewed dry run from intervening saves. Native/model/report objects are never edited.',z.object({...editTarget,patch:z.array(object).min(1).max(200),dryRun:z.boolean().default(true),resetFormatting:z.boolean().default(false),etag:z.string().regex(/^[a-f0-9]{64}$/).optional()}),async args=>{
    const item=await readStoredVisual(args.reportDir,args.pageName,args.visualName)
    if(args.etag&&args.etag!==item.etag)throw Error('Visual changed since the reviewed preview; read_visual and dryRun again')
    const next=patchVisualSpec(item.spec,args.patch)
    const p=await editPreviews(args,next,item)
    let queryState
    if(JSON.stringify(item.spec.measures)!==JSON.stringify(next.measures))queryState=makeVisualContainer({visualName:args.visualName,spec:next,bindings:p.after.bindings,layout:item.layout}).visual.query.queryState
    if(JSON.stringify(item.spec.bindings)!==JSON.stringify(next.bindings))throw Error('Binding changes require explicit rebinding; this edit tool preserves existing field roles')
    await assertReportRenderer(args.reportDir,RENDERER_GUID,next,p.after.bindings)
    const written=args.dryRun?null:await writeStoredVisual(item,next,{resetFormatting:args.resetFormatting,queryState})
    return {content:[...text({dryRun:args.dryRun,written,etag:item.etag,patch:args.patch,diff:specDiff(item.spec,next),formattingPreserved:!args.resetFormatting,beforeCritique:p.before.result.critique,afterCritique:p.after.result.critique,warnings:[...p.after.warnings,...(args.dryRun?[]:await desktopWarning(args.reportDir))]}).content,...p.content]}
  })
  tool('list_pages','Read existing PBIR pages and visual names, types and positions so you can choose a page and avoid overlap. This tool does not edit or validate native visuals, slicers, bookmarks, filters or report themes.',z.object({reportDir:z.string().min(1)}),async({reportDir})=>text(await listPages(reportDir)))
  tool('commit_visual','Add one Vilsem Renderer visual to one existing PBIR page using @vilsem/core. Existing visual names are refused; the only additional changes are missing renderer resources and registration. Native visuals, slicers, bookmarks, filters, themes and model objects are not edited. If Desktop is open, accept its external-change reload prompt after this call.',z.object({reportDir:z.string().min(1),pageName:z.string().min(1),visualName:z.string().min(1),spec:object,bindings,saveAs:z.string().optional(),connectionId:z.string().uuid().optional(),layout:z.object({x:z.number().min(0),y:z.number().min(0),width:z.number().positive(),height:z.number().positive(),z:z.number().min(0).optional(),tabOrder:z.number().min(0).optional()})}),async args=>{
    await checkMeasures(args.spec,args.connectionId,args.bindings)
    // Preserve preview/native parity for model formats even when canvasTheme
    // deliberately selects a legacy light/dark appearance.
    const schema=args.connectionId?await models.fields(args.connectionId):null
    const formattedBindings={...args.bindings,measures:args.bindings.measures.map(field=>({...field,formatString:schema?.measures.find(m=>m.name?.toLowerCase()===field.name.toLowerCase()&&m.table?.toLowerCase()===field.table.toLowerCase())?.formatString || field.formatString}))}
    const committed=await commitVisual({...args,bindings:formattedBindings})
    if(args.saveAs)try{return text({...committed,savedTemplate:await saveUserTemplate({name:args.saveAs,spec:args.spec})})}catch(error){return text({...committed,templateSaved:false,templateError:(error as Error).message})}
    return text(committed)
  })
  tool('validate_visuals','Validate only PBIR visual containers whose visualType is the stable Vilsem Renderer GUID. Reports schema errors, unreadable spec literals and unsupported current-renderer specs. Native visuals and all report-level objects are neither validated nor reported.',z.object({reportDir:z.string().min(1)}),async({reportDir})=>text(await validateVisuals(reportDir)))
  for(const template of [...EXAMPLE_TEMPLATES,...SHIPPED_TEMPLATES]){
    const uri=`vilsem://templates/${template.meta.id}`
    server.registerResource(template.meta.id,uri,{mimeType:'application/json'},async uri=>({contents:[{uri:uri.href,mimeType:'application/json',text:JSON.stringify(template)}]}))
  }
  server.registerResource('spec-format','vilsem://docs/spec-format',{mimeType:'text/markdown'},async uri=>({contents:[{uri:uri.href,mimeType:'text/markdown',text:await fs.readFile(new URL('../docs/spec-format.md',import.meta.url),'utf8')}]}))
  for(const name of ['design-guide','workflow','expression-language','motion-capture'])server.registerResource(name,`vilsem://docs/${name}`,{mimeType:'text/markdown'},async uri=>({contents:[{uri:uri.href,mimeType:'text/markdown',text:await fs.readFile(new URL(`../docs/${name}.md`,import.meta.url),'utf8')}]}))
  server.registerResource('user-template',new ResourceTemplate('vilsem://templates/user/{name}',{list:async()=>({resources:(await listUserTemplates()).filter(t=>!t.unreadable).map(t=>({uri:t.uri,name:t.name,mimeType:'application/json'}))})}),{mimeType:'application/json'},async(uri,{name})=>({contents:[{uri:uri.href,mimeType:'application/json',text:JSON.stringify(await readUserTemplate(String(name)))}]}))
  return server
}
