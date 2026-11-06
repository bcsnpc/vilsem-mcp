import { createRequire } from 'node:module'
const echarts = createRequire(import.meta.url)('echarts')
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolveVisualSpec } from '@vilsem/core/spec/resolve'
import { resolveReportTheme } from '@vilsem/core/theme/report'
import { renderedText, renderedPlots, critiqueVisual } from './critique.js'
import {applyPaneFormatting,effectivePaneObjects} from '@vilsem/core/formatting/pane'
import {encodePreviewApng} from '@vilsem/core/images/decode'

export function rasterizeSvg(svg:string,background='white') {
  const raster = spawnSync(process.execPath,[fileURLToPath(new URL('./rasterize.cjs',import.meta.url))],{input:JSON.stringify({svg,background}),windowsHide:true,timeout:30000,maxBuffer:16*1024*1024})
  if(raster.error || raster.status!==0)throw Error(`PNG rasterization failed in an isolated worker (${raster.error?.message || raster.signal || raster.status}); the MCP server is still available. Check chart domains and clipping, then retry.`)
  return raster.stdout
}

// Share expensive native/font initialization across a bounded timeline sample.
// Keep the process boundary: a native rasterizer failure cannot kill the MCP.
export function rasterizeSvgBatch(svgs:string[],background='white') {
  if(!svgs.length||svgs.length>12||svgs.some(svg=>typeof svg!=='string'))throw Error('Raster batch requires1..12 SVG strings')
  const raster=spawnSync(process.execPath,[fileURLToPath(new URL('./rasterize.cjs',import.meta.url))],{input:JSON.stringify({svgs,background}),windowsHide:true,timeout:30000,maxBuffer:64*1024*1024})
  if(raster.error||raster.status!==0)throw Error(`PNG rasterization failed in an isolated worker (${raster.error?.message||raster.signal||raster.status}); the MCP server is still available. Check chart domains and clipping, then retry.`)
  const frames=JSON.parse(raster.stdout.toString('utf8'))
  if(!Array.isArray(frames)||frames.length!==svgs.length||frames.some(frame=>typeof frame!=='string'))throw Error('Invalid raster batch response')
  return frames.map(frame=>Buffer.from(frame,'base64'))
}

export function variantSheet(variants:{png:Buffer,label:string}[],width:number,height:number){
 if(!variants.length||variants.length>4)throw Error('A comparison requires1..4 variants')
 const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!))
 const cols=variants.length===1?1:2,rows=Math.ceil(variants.length/cols),header=36
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${cols*width}" height="${rows*(height+header)}"><rect width="100%" height="100%" fill="white"/>${variants.map((v,i)=>{const x=i%cols*width,y=Math.floor(i/cols)*(height+header),mime=v.png[0]===255?'image/jpeg':'image/png';return `<text x="${x+12}" y="${y+24}" font-family="Segoe UI" font-size="16" fill="#222">${escape(v.label.slice(0,80))}</text><image x="${x}" y="${y+header}" width="${width}" height="${height}" href="data:${mime};base64,${v.png.toString('base64')}"/>`}).join('')}</svg>`
 return rasterizeSvg(svg)
}

export function previewRows(spec: any, rows: any[], width = 800, height = 500, context: any = {}) {
  const pane=effectivePaneObjects(spec,context.formatPaneOverrides)
  context={...context,useReportTheme:pane.appearance?.useReportTheme ?? context.useReportTheme}
  const option = applyPaneFormatting(resolveVisualSpec(spec, rows, {...context,width,measureText:(text,font)=>echarts.format.getTextRect(text,font).width}),pane,{locale:context.locale,width,height})
  const chart = echarts.init(null, undefined, {renderer:'svg', ssr:true, width, height})
  try {
    // ECharts ignores root animation flags when baseOption/options own them.
    // Sample settled states, never an enter-animation clip or CSS keyframe.
    chart.setOption(applyPaneFormatting(option,{motion:{enabled:false}}))
    const settledSvg=()=>{const uri=chart.getSvgDataURL(),prefix='data:image/svg+xml;charset=UTF-8,';if(!uri.startsWith(prefix))throw Error('Unexpected SVG export encoding');return decodeURIComponent(uri.slice(prefix.length))}
    const steps=Array.isArray(option.options)?option.options.length:0
    const background=resolveReportTheme(spec,context).background
    const motionWarnings:string[]=[],sampled:{index:number,png:Buffer}[]=[]
    let apng:Buffer|undefined,contactSheet:Buffer|undefined
    if(steps>1){
      const count=Math.min(steps,context.frames??6)
      // Discrete model-backed timeline states. These are not browser tween frames.
      if(context.sampleMotion!==false&&width*height*count<=12000000){
        const states:{index:number,svg:string}[]=[]
        for(let i=0;i<count;i++){const index=Math.round(i*(steps-1)/(count-1));chart.dispatchAction({type:'timelineChange',currentIndex:index});states.push({index,svg:settledSvg()})}
        const images=rasterizeSvgBatch(states.map(state=>state.svg),background)
        sampled.push(...states.map((state,i)=>({index:state.index,png:images[i]})))
        try{apng=encodePreviewApng(sampled.map(f=>f.png),{duration:Math.min(3000,Math.max(100,(option.baseOption?.timeline?.playInterval??option.timeline?.playInterval??500)*count))})}catch(error){motionWarnings.push((error as Error).message)}
        if(context.frames){const cols=Math.min(3,count),cellWidth=Math.min(width,600),cellHeight=Math.round(height*cellWidth/width),header=28;
          const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${cols*cellWidth}" height="${Math.ceil(count/cols)*(cellHeight+header)}"><rect width="100%" height="100%" fill="white"/>${sampled.map((frame,i)=>{const x=i%cols*cellWidth,y=Math.floor(i/cols)*(cellHeight+header);return `<text x="${x+8}" y="${y+20}" font-family="Segoe UI" font-size="14">Timeline state ${frame.index+1}/${steps}</text><image x="${x}" y="${y+header}" width="${cellWidth}" height="${cellHeight}" href="data:image/png;base64,${frame.png.toString('base64')}"/>`}).join('')}</svg>`;contactSheet=rasterizeSvg(svg)}
      }else if(context.sampleMotion!==false)motionWarnings.push('Animation sample exceeds12 million pixels; reduce width, height or frames.')
      chart.dispatchAction({type:'timelineChange',currentIndex:steps-1})
    }else if(option.animation!==false&&(spec.template?.animation||option.animationDuration))motionWarnings.push('Enter/update tween capture is not implemented by the SVG state sampler; inspect motion in the live renderer.')
    const svg = settledSvg()
    // Timeline controls can settle further after the last sampled state.
    // Rasterize this exact final SVG rather than reusing an earlier sample.
    const png=rasterizeSvg(svg,background)
    const inspected=steps?{...option,...chart.getOption()}:option
    const critique=context.critique===false?undefined:critiqueVisual(spec,inspected,rows,width,height,renderedText(chart,inspected),{...context,background,plotBounds:renderedPlots(chart)})
    return { option, svg, png, critique, apng, contactSheet, motion:{kind:steps>1&&context.sampleMotion!==false?'discrete-timeline-states':'static',steps,sampledIndices:sampled.map(f=>f.index),durationLimitMs:3000,byteLimit:2097152,warnings:motionWarnings} }
  } finally {
    chart.dispose()
  }
}
