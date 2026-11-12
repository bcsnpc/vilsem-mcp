import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { injectVisual, RENDERER_GUID, assertReportRenderer } from '@vilsem/core/pbir'
import {validateExistingContainer} from './containerCompatibility.js'
import { slotCount } from '@vilsem/core/templates'
import {validateSpecDetailed} from '@vilsem/core/spec/diagnostics'
import {scopedMeasuresOf} from '@vilsem/core/spec/migrate'

export function committedGuidance(rendererRegistered:boolean,spec:any){
  const names=Object.keys(scopedMeasuresOf(spec)).sort()
  return {nextStep:rendererRegistered
    ?"FIRST VILSEM VISUAL IN THIS REPORT: tell the user to close Power BI Desktop WITHOUT saving, then reopen the .pbip. 'Apply external changes' is not enough this time."
    :"Tell the user to click 'Apply' on Power BI Desktop's external-changes prompt (no restart needed). Do not save in Desktop before applying.",
    ...(names.length?{measureWarning:`This visual uses visual-scoped measures (${names.join(', ')}). They hide fields in the Build pane and FAIL under Publish to web. For reports that will be shared, persist them as model measures: see get_playbook section '9a' or run the bundled scripts/promote-measures.py (ask the user first, it edits the model).`}:{})}
}
function nativeMeasureNames(value:any):string[]{
  const names=new Set<string>()
  for(const state of Object.values(value.visual?.query?.queryState??{}) as any[])for(const p of Array.isArray(state?.projections)?state.projections:[]){
    if(p?.field?.NativeMeasure)names.add(p.field.NativeMeasure.ProposedName??p.nativeQueryRef??'(unnamed NativeMeasure)')
  }
  return [...names].sort()
}
export function visualValidationSummary(results:any[]){
  return {visualCount:results.length,visualsWithNativeMeasures:results.filter(v=>v.nativeMeasures.length>0).length,nativeMeasureCount:results.reduce((n,v)=>n+v.nativeMeasures.length,0)}
}

export function validateSpec(spec: any) {
  const result=validateSpecDetailed(spec)
  if(!result.valid){const error:any=Error(result.errors.map(e=>`${e.path || '/'}: ${e.message}`).join('\n'));error.diagnostics=result.errors;error.suggestions=result.suggestions;throw error}
  return result.option
}

export function validateBindings(spec:any, bindings:any) {
  if(!spec.template)return
  let dimensions=0, measures=0
  for(const slot of Object.values(spec.template.slots || {}) as any[]){
    if(slot.kind==='measure')measures+=slotCount(slot.count)
    else if(slot.kind==='dimension'||slot.kind==='time')dimensions++
  }
  if((bindings.dimensions?.length||0)<dimensions || (bindings.measures?.length||0)<measures)throw Error(`Template requires ${dimensions} dimension/time bindings and ${measures} measure bindings`)
}

const read = async file => JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''))
export async function listPages(reportDir: string) {
  const root = await fs.realpath(reportDir)
  const pagesDir = path.join(root,'definition','pages')
  const metadata = await read(path.join(pagesDir,'pages.json'))
  const pages: any[] = []
  for (const name of metadata.pageOrder || []) {
    if (!/^[\w-]+$/.test(name)) throw Error('Invalid PBIR page name')
    const dir=path.join(pagesDir,name)
    const page=await read(path.join(dir,'page.json'))
    const visuals: any[]=[]
    for (const folder of await fs.readdir(path.join(dir,'visuals'),{withFileTypes:true}).catch(error=>{
      if(error.code==='ENOENT')return [];throw error
    })) {
      if(!folder.isDirectory())continue
      const visual=await read(path.join(dir,'visuals',folder.name,'visual.json'))
      visuals.push({name:visual.name,type:visual.visual?.visualType,position:visual.position})
    }
    pages.push({name,displayName:page.displayName,width:page.width,height:page.height,visuals})
  }
  return pages
}

// Read query bindings for context only. Native report objects are never edited
// or validated here; list_visuals/read_visual remain Vilsem-only operations.
export async function pageBindings(reportDir:string,page:string) {
  const pages=await listPages(reportDir)
  const matches=pages.filter(p=>p.name===page || p.displayName===page)
  if(matches.length!==1)throw Error('page must identify exactly one existing page; use list_pages for internal names')
  const selected=matches[0],root=await fs.realpath(reportDir),visuals:any[]=[]
  for(const item of selected.visuals){
    if(!/^[\w-]+$/.test(item.name))throw Error('Invalid visual folder name')
    const file=await fs.realpath(path.join(root,'definition','pages',selected.name,'visuals',item.name,'visual.json'))
    if(!file.startsWith(root+path.sep))throw Error('Visual binding path resolves outside report')
    const value=await read(file),dimensions:any[]=[],measures:any[]=[],aggregations:any[]=[]
    for(const state of Object.values(value.visual?.query?.queryState || {}) as any[])for(const projection of state.projections || []){
      const field=projection.field
      const column=field?.Column
      if(column)dimensions.push({table:column.Expression?.SourceRef?.Entity,column:column.Property})
      const aggregate=field?.Aggregation?.Expression?.Column
      if(aggregate)aggregations.push({table:aggregate.Expression?.SourceRef?.Entity,column:aggregate.Property,function:field.Aggregation.Function,queryRef:projection.queryRef})
      if(field?.Measure)measures.push({table:field.Measure.Expression?.SourceRef?.Entity,name:field.Measure.Property})
      if(field?.NativeMeasure)measures.push({table:null,name:field.NativeMeasure.ProposedName || projection.nativeQueryRef,inline:true})
    }
    visuals.push({name:item.name,type:item.type,dimensions,measures,aggregations})
  }
  return {name:selected.name,displayName:selected.displayName,scope:'Read-only query bindings; native visuals and report objects are not validated or edited.',visuals}
}

export async function validateVisuals(reportDir: string) {
  const root=await fs.realpath(reportDir)
  const pages=path.join(root,'definition','pages')
  const results:any[]=[]
  for(const page of await fs.readdir(pages,{withFileTypes:true})) {
    if(!page.isDirectory())continue
    const dir=path.join(pages,page.name,'visuals')
    for(const visual of await fs.readdir(dir,{withFileTypes:true}).catch(error=>{
      if(error.code==='ENOENT')return [];throw error
    })) {
      if(!visual.isDirectory())continue
      const file=path.join(dir,visual.name,'visual.json')
      const text=await fs.readFile(file,'utf8')
      let value:any
      try{value=JSON.parse(text.replace(/^\uFEFF/,''))}catch(error){
        if(text.includes(RENDERER_GUID))results.push({path:file,valid:false,nativeMeasures:[],error:'Unreadable Vilsem visual JSON'})
        continue
      }
      if(value.visual?.visualType!==RENDERER_GUID)continue
      const nativeMeasures=nativeMeasureNames(value)
      try {
        const containerValidation=await validateExistingContainer(value)
        const literal=value.visual.objects?.semantica?.[0]?.properties?.primitiveSpec?.expr?.Literal?.Value
        if(typeof literal!=='string'||!literal.startsWith("'")||!literal.endsWith("'"))throw Error('Missing primitiveSpec literal')
        const spec=JSON.parse(literal.slice(1,-1).replace(/''/g,"'"))
        validateSpec(spec)
        const measureRoles=['content','secondary','tertiary','quaternary','quinary','senary']
        const measureCount=measureRoles.filter(role=>value.visual.query?.queryState?.[role]?.projections?.length).length
        await assertReportRenderer(root,RENDERER_GUID,spec,{measures:Array(measureCount)})
        results.push({path:file,valid:true,containerValidation,nativeMeasures})
      } catch(error) {results.push({path:file,valid:false,nativeMeasures,error:(error as Error).message})}
    }
  }
  return results
}

export async function desktopWarning(reportDir: string) {
  const warnings:string[]=[]
  const root=await fs.realpath(reportDir)
  if(await fs.stat(path.join(root,'.pbi')).then(()=>true,()=>false))warnings.push('A .pbi state folder exists; Desktop may have this report open.')
  if(process.platform==='win32') {
    const script="Get-CimInstance Win32_Process -Filter \"Name='PBIDesktop.exe'\" | Select-Object CommandLine | ConvertTo-Json -Compress"
    try {
      const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-Command',script],{windowsHide:true,timeout:15000})
      // Desktop may have opened a PBIP from its UI, leaving no path in CommandLine.
      if(stdout.trim() && stdout.trim()!=='null')warnings.push('Power BI Desktop is running. After this write, accept its external-change reload prompt if this project is open.')
    } catch {
      warnings.push('Could not inspect Desktop processes. If this project is open, accept its external-change reload prompt; avoid saving stale Desktop state.')
    }
  }
  if(warnings.length)warnings.push('Accept the reload prompt in Desktop after the write; do not save stale Desktop state over the external changes.')
  return warnings
}

export async function commitVisual(args:any) {
  validateSpec(args.spec)
  validateBindings(args.spec,args.bindings)
  const warnings=await desktopWarning(args.reportDir)
  const result=await injectVisual(args)
  return {...result,warnings,...committedGuidance(result.rendererRegistered===true,args.spec)}
}
