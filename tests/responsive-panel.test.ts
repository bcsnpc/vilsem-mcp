import {it,expect} from 'vitest'
import fs from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {build} from 'esbuild'
import {previewRows} from '../src/preview.js'
import {browserCandidates,browserEnvironment} from '../src/motionBrowser.js'

it.runIf(browserCandidates().some(existsSync))('keeps a reference card within resized canvas bounds without intercepting bar selection',async()=>{
 const spec=JSON.parse(await fs.readFile('templates/stress3-reference-figma.vilsem-visual.json','utf8'))
 const rows=[{_cat:'Market A',_val:12},{_cat:'Market B',_val:7}]
 const output=await build({stdin:{contents:"export {resolveVisualSpec} from '@vilsem/core/spec/resolve'; export * as echarts from 'echarts'",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'PanelTest',platform:'browser'})
 const {chromium}=await import('playwright-core'),browser=await chromium.launch({executablePath:browserCandidates().find(existsSync),headless:true,chromiumSandbox:true,env:browserEnvironment()})
 try{
  const page=await browser.newPage({viewport:{width:1000,height:700}});await page.route('**/*',r=>r.abort());await page.setContent('<div id="chart"></div>');await page.addScriptTag({content:output.outputFiles[0].text})
  const states=await page.evaluate(({spec,rows})=>{
   const {echarts,resolveVisualSpec}=window['PanelTest'],chart=echarts.init(document.getElementById('chart'),null,{width:900,height:550}),states=[]
   chart.setOption(resolveVisualSpec(spec,rows));window['panelChart']=chart
   for(const [width,height]of [[900,550],[320,240],[40,24],[900,550]]){
    chart.resize({width,height});chart.getZr().flush()
    const card=chart.getZr().storage.getDisplayList().find(el=>el.name==='reference-panel')
    states.push({width,height,shape:{...card.shape},silent:card.silent,barCount:chart.getModel().getSeriesByIndex(1).getData().count()})
   }
   window['barClicks']=[];chart.on('click',event=>window['barClicks'].push({seriesIndex:event.seriesIndex,dataIndex:event.dataIndex}))
   return states
  },{spec,rows})
  for(const s of states){expect(s.silent).toBe(true);expect(s.barCount).toBe(2);expect(s.shape.x).toBeGreaterThanOrEqual(0);expect(s.shape.y).toBeGreaterThanOrEqual(0);expect(s.shape.x+s.shape.width).toBeLessThanOrEqual(s.width);expect(s.shape.y+s.shape.height).toBeLessThanOrEqual(s.height)}
  expect(states[0].shape).toEqual(states[3].shape);expect(states[0].shape).toMatchObject({x:25,y:25,width:850,height:500,r:16})
  const box=await page.locator('#chart').boundingBox(),point=await page.evaluate(()=>window['panelChart'].convertToPixel({seriesIndex:1},[6,'Market A']))
  await page.mouse.click(box!.x+point[0],box!.y+point[1]);expect(await page.evaluate(()=>window['barClicks'])).toEqual([{seriesIndex:1,dataIndex:0}])
  await page.mouse.click(box!.x+30,box!.y+30);expect(await page.evaluate(()=>window['barClicks'])).toHaveLength(1)
  const ssr=previewRows(spec,rows,900,550,{sampleMotion:false});expect(ssr.svg).toContain('fill="#ffffff"');expect(ssr.option.series[1].data.map(d=>d.value)).toEqual([12,7])
 }finally{await browser.close()}
},30000)
