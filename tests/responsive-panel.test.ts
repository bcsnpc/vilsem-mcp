import {it,expect} from 'vitest'
import fs from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {build} from 'esbuild'
import {previewRows} from '../src/preview.js'
import {browserCandidates,browserEnvironment} from '../src/motionBrowser.js'

it('keeps Figma reference axes readable on its authored white panel in both report themes',async()=>{
 const spec=JSON.parse(await fs.readFile('templates/stress3-reference-figma.vilsem-visual.json','utf8'))
 for(const theme of ['light','dark']){
  const result=previewRows(spec,[{_cat:'Country example',_val:1200}],900,550,{theme,sampleMotion:false,measures:[{name:'Total Revenue',formatString:'$#,0'}]})
  expect(result.option.backgroundColor).toBe('#f5f7fb')
  expect(result.option.xAxis.axisLabel.color).toBe('#53627a')
  expect(result.option.xAxis.nameTextStyle.color).toBe('#53627a')
  expect(result.option.yAxis.axisLabel.color).toBe('#17243b')
  const text=[...result.svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)]
  expect(text.find(m=>m[2]==='Country example')?.[1]).toContain('fill="#17243b"')
  expect(text.find(m=>m[2]==='Revenue (USD)')?.[1]).toContain('fill="#53627a"')
  expect(text.some(m=>m[2].includes('$')&&m[1].includes('fill="#53627a"'))).toBe(true)
 }
})

it.runIf(browserCandidates().some(existsSync))('keeps a reference card within resized canvas bounds without intercepting bar selection',async()=>{
 const spec=JSON.parse(await fs.readFile('templates/stress3-reference-figma.vilsem-visual.json','utf8'))
 const rows=[{_cat:'Market A',_val:12},{_cat:'Market B',_val:7}]
 const output=await build({stdin:{contents:"export {resolveVisualSpec} from '@vilsem/core/spec/resolve'; export * as echarts from 'echarts'",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'PanelTest',platform:'browser'})
 const {chromium}=await import('playwright-core'),browser=await chromium.launch({executablePath:browserCandidates().find(existsSync),headless:true,chromiumSandbox:true,env:browserEnvironment()})
 try{
  const page=await browser.newPage({viewport:{width:1000,height:700}});await page.route('**/*',r=>r.abort());await page.setContent('<div id="chart"></div>');await page.addScriptTag({content:output.outputFiles[0].text})
  const {states,selection}=await page.evaluate(({spec,rows})=>{
   const {echarts,resolveVisualSpec}=window['PanelTest'],chart=echarts.init(document.getElementById('chart'),null,{width:900,height:550}),states=[]
   chart.setOption(resolveVisualSpec(spec,rows));window['panelChart']=chart
   for(const [width,height]of [[900,550],[320,240],[40,24],[900,550]]){
    chart.resize({width,height});chart.getZr().flush()
    const card=chart.getZr().storage.getDisplayList().find(el=>el.name==='reference-panel')
    states.push({width,height,shape:{...card.shape},silent:card.silent,barCount:chart.getModel().getSeriesByIndex(1).getData().count()})
   }
   // Reproduce the host's per-datum selection opacity, including the
   // decoration's synthetic invocation row. It must not fade the panel.
   const selected=chart.getOption();selected.series[0].data=[{value:0,itemStyle:{opacity:.25}}]
   selected.series[1].data=selected.series[1].data.map((d,i)=>({...d,itemStyle:{opacity:i===0?.25:1}}))
   chart.setOption(selected,true);chart.getZr().flush()
   const selection={panelOpacity:chart.getZr().storage.getDisplayList().find(el=>el.name==='reference-panel').style.opacity,markOpacities:[0,1].map(i=>chart.getModel().getSeriesByIndex(1).getData().getItemGraphicEl(i).style.opacity)}
   window['barClicks']=[];window['blankClicks']=0;chart.on('click',event=>window['barClicks'].push({seriesIndex:event.seriesIndex,dataIndex:event.dataIndex}))
   chart.getZr().on('click',event=>{if(!event.target)window['blankClicks']++})
   return {states,selection}
  },{spec,rows})
  for(const s of states){expect(s.silent).toBe(true);expect(s.barCount).toBe(2);expect(s.shape.x).toBeGreaterThanOrEqual(0);expect(s.shape.y).toBeGreaterThanOrEqual(0);expect(s.shape.x+s.shape.width).toBeLessThanOrEqual(s.width);expect(s.shape.y+s.shape.height).toBeLessThanOrEqual(s.height)}
  expect(states[0].shape).toEqual(states[3].shape);expect(states[0].shape).toMatchObject({x:25,y:25,width:850,height:500,r:16})
  expect(selection).toEqual({panelOpacity:1,markOpacities:[.25,1]})
  const box=await page.locator('#chart').boundingBox(),point=await page.evaluate(()=>window['panelChart'].convertToPixel({seriesIndex:1},[6,'Market A']))
  await page.mouse.click(box!.x+point[0],box!.y+point[1]);expect(await page.evaluate(()=>window['barClicks'])).toEqual([{seriesIndex:1,dataIndex:0}])
  await page.mouse.click(box!.x+30,box!.y+30);expect(await page.evaluate(()=>window['barClicks'])).toHaveLength(1)
  expect(await page.evaluate(()=>window['blankClicks'])).toBe(1)
  const ssr=previewRows(spec,rows,900,550,{sampleMotion:false});expect(ssr.svg).toContain('fill="#ffffff"');expect(ssr.option.series[1].data.map(d=>d.value)).toEqual([12,7])
 }finally{await browser.close()}
},30000)
