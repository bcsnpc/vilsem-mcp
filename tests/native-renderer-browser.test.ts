import{describe,it,expect,beforeAll,afterAll}from'vitest'
import fs from'node:fs/promises'
import fsSync from'node:fs'
import path from'node:path'
import{createRequire}from'node:module'
import{chromium}from'playwright-core'
import{browserCandidates}from'../src/motionBrowser.js'
import{sharpnessSpec,mountNativeHost}from'./fixtures/native-renderer-host.mjs'
const require=createRequire(import.meta.url),coreRequire=createRequire(require.resolve('@vilsem/core/pbir')),AdmZip=coreRequire('adm-zip'),asset=path.resolve(path.dirname(require.resolve('@vilsem/core/pbir')),'../../assets/renderer.pbiviz'),zip=new AdmZip(asset),metadata=JSON.parse(zip.getEntries().find(e=>e.entryName.endsWith('.pbiviz.json')).getData().toString())
const executable=browserCandidates().find(p=>fsSync.existsSync(p))
describe.skipIf(!executable)('actual packaged native painter in an owned browser (not Power BI)',()=>{
 let browser:any
 beforeAll(async()=>{browser=await chromium.launch({executablePath:executable,headless:true,chromiumSandbox:true,args:['--disable-extensions','--no-first-run','--disable-background-networking']})})
 afterAll(async()=>{await browser?.close()})
 async function fixture(mode:string,kind:string,dpr=1.5){
  const context=await browser.newContext({viewport:{width:2400,height:1500},deviceScaleFactor:dpr,serviceWorkers:'block'});await context.route('**/*',r=>r.abort());const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.setContent('<div id="stage" style="width:1248px;height:688px;transform:scale(1.5);transform-origin:0 0"><div id="visual"></div></div>');await page.evaluate(()=>window.powerbi={visuals:{plugins:{}}});await page.addStyleTag({content:metadata.content.css});await page.addScriptTag({content:metadata.content.js})
  const data=kind==='calendar'?{categories:['2026-01-01','2026-01-02','2026-01-03','2026-01-04'],values:[10,20,0,15],date:true}:{}
  await page.evaluate(mountNativeHost,{spec:sharpnessSpec(kind,mode),...data});await page.waitForFunction(()=>window.__vilsemQA.calls.events.includes('finish'))
  return{context,page,errors,async close(){await page.evaluate(()=>window.__vilsemQA.visual.destroy());await context.close()}}
 }
 const matrix=[1,1.5].flatMap(dpr=>['canvas','svg'].flatMap(mode=>['hero','leaderboard','calendar','expression'].map(kind=>({dpr,mode,kind}))))
 it.each(matrix)('$kind / $mode / device DPR $dpr paints with the correct surface density',async({dpr,mode,kind})=>{
  const f=await fixture(mode,kind,dpr);try{const state=await f.page.evaluate(()=>({surface:window.__vilsemQA.visual.chartSurface,svg:!!document.querySelector('#visual svg'),canvases:Array.from(document.querySelectorAll('#visual canvas')).map(c=>({width:c.width,logical:parseFloat(c.style.width)})),events:window.__vilsemQA.calls.events}));expect(f.errors).toEqual([]);expect(state.events.some(e=>e.startsWith('failed'))).toBe(false);expect(state.surface).toMatchObject({renderer:mode,dpr:dpr*1.5});if(mode==='svg'){expect(state.svg).toBe(true);expect(state.canvases).toEqual([])}else{expect(state.canvases.length).toBeGreaterThan(0);for(const c of state.canvases)expect(c.width).toBe(Math.floor(c.logical*dpr*1.5))}}finally{await f.close()}
 })
 it.each(['canvas','svg'])('%s routes physical pointer selection, Ctrl, tooltip, context menu and clear',async mode=>{
  const f=await fixture(mode,'leaderboard');try{
   const points=await f.page.evaluate(()=>{const q=window.__vilsemQA,dom=q.visual.chart.getDom(),rect=dom.getBoundingClientRect(),scale=rect.width/dom.clientWidth;return[0,1].map(i=>{const p=q.visual.chart.convertToPixel({seriesIndex:0},[q.dataView.categorical.values[0].values[i]*.5,q.dataView.categorical.categories[0].values[i]]);return[rect.left+p[0]*scale,rect.top+p[1]*scale]})})
   await f.page.mouse.move(...points[0]);await f.page.waitForFunction(()=>window.__vilsemQA.calls.tooltips.length>0);await f.page.mouse.click(...points[0]);await f.page.waitForFunction(()=>window.__vilsemQA.selected.length===1);expect(await f.page.evaluate(()=>window.__vilsemQA.selected.map(i=>i.getKey()))).toEqual(['0'])
   await f.page.keyboard.down('Control');await f.page.mouse.click(...points[1]);await f.page.keyboard.up('Control');await f.page.waitForFunction(()=>window.__vilsemQA.selected.length===2);expect(await f.page.evaluate(()=>window.__vilsemQA.selected.map(i=>i.getKey()))).toEqual(['0','1'])
   await f.page.mouse.click(...points[0],{button:'right'});await f.page.waitForFunction(()=>window.__vilsemQA.calls.contexts.length>0);expect(await f.page.evaluate(()=>window.__vilsemQA.calls.contexts.at(-1).id)).toBe('0')
   await f.page.evaluate(()=>{window.__oldChart=window.__vilsemQA.visual.chart;document.getElementById('stage').style.transform='scale(1.8)'})
   if(mode==='canvas')await f.page.waitForFunction(()=>window.__vilsemQA.visual.chart!==window.__oldChart&&Math.abs(window.__vilsemQA.visual.chartSurface.dpr-2.7)<1e-6,undefined,{timeout:5000})
   else expect(await f.page.evaluate(()=>window.__vilsemQA.visual.chart===window.__oldChart)).toBe(true)
   expect(await f.page.evaluate(()=>window.__vilsemQA.selected.map(i=>i.getKey()))).toEqual(['0','1']);const blank=await f.page.evaluate(()=>{const r=document.getElementById('visual').getBoundingClientRect();return[r.left+5,r.bottom-5]});await f.page.mouse.click(...blank);await f.page.waitForFunction(()=>window.__vilsemQA.selected.length===0,undefined,{timeout:5000});expect(f.errors).toEqual([])
  }finally{await f.close()}
 },30000)
 it.each(['canvas','svg'])('%s preserves host selection on a highlight/data redraw and supports short motion',async mode=>{
  const f=await fixture(mode,'expression');try{await f.page.evaluate(()=>{const q=window.__vilsemQA;q.restore([1]);q.dataView.categorical.values[0].highlights=[null,20,null,null];const spec=JSON.parse(q.dataView.metadata.objects.semantica.primitiveSpec);spec.template.animation={enter:{duration:100,easing:'linear'},update:{duration:100,easing:'linear'}};q.dataView.metadata.objects.semantica.primitiveSpec=JSON.stringify(spec);q.calls.events=[];q.update()});await f.page.waitForFunction(()=>window.__vilsemQA.calls.events.includes('finish'));const state=await f.page.evaluate(()=>{const q=window.__vilsemQA;return{selected:q.selected.map(i=>i.getKey()),highlights:[...q.visual.highlightIndexes],mode:q.visual.chartSurface.renderer,animation:q.visual.chart.getOption().animation,series:q.visual.chart.getOption().series.map(s=>s.type)}});expect(state).toMatchObject({selected:['1'],highlights:[1],mode,animation:true,series:['custom']});expect(f.errors).toEqual([])}finally{await f.close()}
 })
})
