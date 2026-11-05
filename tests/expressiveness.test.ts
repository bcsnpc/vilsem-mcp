import {describe,it,expect} from 'vitest'
import fs from 'node:fs'
import {SHIPPED_SPECS} from '../src/templates.js'
import {validateSpec,validateBindings} from '../src/reports.js'
import {previewRows} from '../src/preview.js'
import {rows,positive,countryRadar,fixtureRows} from './fixtures/visualRows.js'
import {resolveVisualSpec} from '@vilsem/core/spec/resolve'

describe('shipped expressiveness specs',()=>{
 it.each([900,300])('measures full model currency labels in the %spx preview before laying out bars',width=>{
  const value=23642495.0952
  const result=previewRows({type:'bar'},[{_cat:'Bikes',_val:value}],width,300,{measures:[{name:'Revenue',formatString:'$#,0'}]})
  expect(result.option.grid[0].right).toBeGreaterThan(60)
  expect(result.svg).toContain('$23,642,495')
  expect(result.option.xAxis.max).toBe(value)
  expect(result.png.length).toBeGreaterThan(1000)
 })
 it('keeps interpolated hierarchy labels readable and padded inside their nodes',()=>{
  const spec=SHIPPED_SPECS.find(s=>s.template.meta.id==='stress2_040_treemap-secondary-colour')!
  for(const theme of ['light','dark']) {
   const result=previewRows(spec,[{_cats:['Bikes','Road Bikes'],_val:100,_val2:80},{_cats:['Bikes','Mountain Bikes'],_val:50,_val2:20}],900,600,{theme})
   expect(result.svg).not.toMatch(/>[^<]*vilsemContrast/)
   expect(result.svg).toMatch(/>Bikes<\/text>/)
   for(const [name,color] of [['Road Bikes','#000000'],['Mountain Bikes','#ffffff']]) {
    const label=[...result.svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].find(m=>m[2]===name)
    expect(label,name).toBeDefined();expect(label![1]).toContain(`fill="${color}"`)
    expect(label![1]).toContain('text-anchor="start"');expect(label![1]).not.toMatch(/\by="-/)
   }
  }
 })
 it('renders plain treemap labels against the actual mapped node fill',()=>{
  const spec={template:{meta:{id:'treemap-actual-fill'},slots:{amount:{kind:'measure'}},template:{animation:false,series:[{type:'treemap',roam:false,breadcrumb:{show:false},data:[{name:'Bright',value:1,itemStyle:{color:'#2dd4bf'}},{name:'Dark',value:1,itemStyle:{color:'#12239E'}}],label:{show:true}}]}}}
  for(const theme of ['light','dark']) {
   const result=previewRows(spec,[],900,600,{theme})
   for(const [name,color] of [['Bright','#000000'],['Dark','#ffffff']]) {
    const label=[...result.svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].find(m=>m[2]===name)
    expect(label,name).toBeDefined();expect(label![1]).toContain(`fill="${color}"`)
   }
  }
 })
 it('uses report foreground for word labels whose helper symbols are invisible',()=>{
  const spec=SHIPPED_SPECS.find(s=>s.template.meta.id==='stress2_116_word-cloud')!
  for(const [theme,foreground] of [['light','#252423'],['dark','#f2f2f2']] as const){
   const result=previewRows(spec,fixtureRows(spec),900,600,{theme})
   const word=[...result.svg.matchAll(/<text\b([^>]*)>(bike)<\/text>/g)][0]
   expect(word,theme).toBeDefined()
   expect(word[1],theme).toContain(`fill="${foreground}"`)
   expect(result.option.series[0].data.every(d=>d.itemStyle.opacity===0)).toBe(true)
  }
 })
 it('renders contrasting labels over the actual dark and light heatmap cells',()=>{
  const spec={template:{meta:{id:'cell-label-contrast'},slots:{category:{kind:'dimension'},group:{kind:'dimension'},amount:{kind:'measure'}},template:{animation:false,xAxis:{type:'category',data:'$slot.category.categories'},yAxis:{type:'category',data:'$slot.group.categories'},visualMap:{show:false,min:1,max:2,inRange:{color:['#12239E','#67e8f9']}},series:[{type:'heatmap',data:'$slot.amount.matrix',label:{show:true,formatterTemplate:'Cell {value}'}}]}}}
  const result=previewRows(spec,[{_cats:['Low','Group'],_val:1},{_cats:['High','Group'],_val:2}],900,600)
  const labels=[...result.svg.matchAll(/<text\b([^>]*)>(Cell [12])<\/text>/g)]
  expect(labels).toHaveLength(2)
  const luminance=(hex:string)=>{
   let h=hex.replace('#','');if(h.length===3)h=[...h].map(c=>c+c).join('')
   const rgb=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(s=>s<=.04045?s/12.92:((s+.055)/1.055)**2.4)
   return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]
  }
  for(const [text,background] of [['Cell 1','#12239E'],['Cell 2','#67e8f9']]){
   const fill=/\bfill="(#[\da-f]+)"/i.exec(labels.find(m=>m[2]===text)![1])![1]
   const pair=[luminance(fill),luminance(background)].sort((a,b)=>a-b)
   expect((pair[1]+.05)/(pair[0]+.05),text).toBeGreaterThanOrEqual(4.5)
  }
 })
 it('provides drawable dense facet, numeric-strip and in-range calendar thumbnail fixtures',()=>{
  for(const id of ['stress2_006_horizon','stress2_007_sparkline-grid','stress2_069_normalized-area','stress2_070_cumulative-flow']) {
   const spec=SHIPPED_SPECS.find(s=>s.template.meta.id===id)!
   const option=resolveVisualSpec(spec,fixtureRows(spec))
   expect(option.series.length,id).toBeGreaterThan(1)
   for(const series of option.series)expect(series.data.filter(d=>d.value!=null).length,id).toBeGreaterThan(2)
  }
  const strip=SHIPPED_SPECS.find(s=>s.template.meta.id==='stress2_016_revenue-strip')!
  expect(resolveVisualSpec(strip,fixtureRows(strip)).series[0].data.every(d=>Number.isFinite(d.value[0]))).toBe(true)
  const calendar=SHIPPED_SPECS.find(s=>s.template.meta.id==='stress2_037_calendar-margin')!
  const option=resolveVisualSpec(calendar,fixtureRows(calendar))
  expect(option.series[0].data.every(d=>String(d[0]).startsWith(String(option.calendar.range)))).toBe(true)
  const kpi=SHIPPED_SPECS.find(s=>s.template.meta.id==='stress2_085_kpi-sparkline')!
  const current=resolveVisualSpec(kpi,fixtureRows(kpi))
  expect(current.series.at(-1).data[0].value).toBe(.03)
  const words=SHIPPED_SPECS.find(s=>s.template.meta.id==='stress2_116_word-cloud')!
  expect(fixtureRows(words).every(row=>row._cats[0].includes('Bike'))).toBe(true)
 })
 it('uses report-aware structural fills for treemap, radar and neutral progress tracks',()=>{
  for(const id of ['stress2_040_treemap-secondary-colour','stress2_041_treemap-drill','stress2_059_radar-benchmark','stress2_019_semi-donut-kpi']) {
   const spec=SHIPPED_SPECS.find(s=>s.template.meta.id===id)!
   const light=resolveVisualSpec(spec,fixtureRows(spec),{theme:'light'})
   const dark=resolveVisualSpec(spec,fixtureRows(spec),{theme:'dark'})
   expect(light.backgroundColor).toBe('transparent');expect(dark.backgroundColor).toBe('transparent')
   if(id.includes('treemap'))expect(light.series[0].itemStyle.borderColor).toBe('transparent')
   if(id.includes('radar'))expect(light.radar.splitArea.areaStyle.color).not.toEqual(dark.radar.splitArea.areaStyle.color)
   if(id.includes('semi-donut'))expect(light.series[0].data[1].itemStyle.color).not.toBe(dark.series[0].data[1].itemStyle.color)
  }
 })
 it('renders signed waterfall start/end totals after inactive stack segments',()=>{
  const template={meta:{id:'stack-continuity'},slots:{cat:{kind:'dimension'},delta:{kind:'measure'},start:{kind:'measure'}},transforms:[{waterfall:{category:'cat',value:'delta',start:'start',total:true},as:'w'}],template:{animation:false,xAxis:{type:'category',data:'$calc.w.categories'},yAxis:{type:'value'},series:[
   {type:'bar',stack:'w',stackStrategy:'all',silent:true,data:'$calc.w.base',itemStyle:{opacity:0}},
   {type:'bar',stack:'w',stackStrategy:'all',data:'$calc.w.positive',itemStyle:{color:'#10b981'}},
   {type:'bar',stack:'w',stackStrategy:'all',data:'$calc.w.negative',itemStyle:{color:'#ef4444'}},
   {type:'bar',stack:'w',stackStrategy:'all',data:'$calc.w.totals',itemStyle:{color:'#60a5fa'}}]}}
  const result=previewRows({type:'custom',template},[{_cat:'A',_val:-15,_val2:10},{_cat:'B',_val:7,_val2:10}],900,600)
  expect(result.svg.match(/fill="#60a5fa"/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  expect(result.svg).toContain('fill="#ef4444"')
 })
 it('keeps the original nine passing examples and unique ids as verified stress examples are added',()=>{expect(SHIPPED_SPECS.filter(s=>s.template.meta.id.startsWith('expressiveness_'))).toHaveLength(9);expect(new Set(SHIPPED_SPECS.map(s=>s.template.meta.id)).size).toBe(SHIPPED_SPECS.length)})
 it.each(SHIPPED_SPECS.map(s=>[s.template.meta.id,s]))('resolves and renders %s without imperative callbacks',(_name,spec)=>{
  expect(()=>validateSpec(spec)).not.toThrow()
  const ownRows=fixtureRows(spec)
  const result=previewRows(spec,ownRows,900,600)
  expect(result.png.length).toBeGreaterThan(1500)
  expect(Buffer.from(result.png).readUInt32BE(16)).toBe(900)
  expect(()=>previewRows(spec,[],900,600)).not.toThrow()
 })
 it('renders all six country radar panels with the same three category domains',()=>{
  const spec=SHIPPED_SPECS.find(s=>s.template.meta.id==='stress2_060_radar-small-multiples')
  const result=previewRows(spec,countryRadar,900,600)
  expect(result.option.radar).toHaveLength(6)
  expect(result.option.radar[0].indicator).toHaveLength(3)
  expect(result.option.radar.every(r=>JSON.stringify(r.indicator)===JSON.stringify(result.option.radar[0].indicator))).toBe(true)
 })
 it('renders populated OHLC and six-measure parallel fixtures',()=>{
  for(const id of ['stress2_034_revenue-ohlc','stress2_035_heikin-ashi','stress2_061_parallel-six-measures']) {
   const spec=SHIPPED_SPECS.find(s=>s.template.meta.id===id)!
   const option=previewRows(spec,fixtureRows(spec),900,600).option
   const series=option.series.find(s=>s.type==='candlestick'||s.type==='parallel')
   expect(series?.data.length,id).toBeGreaterThan(0)
   expect(series.data.every(d=>(Array.isArray(d)?d:d.value).every(v=>Number.isFinite(v))),id).toBe(true)
  }
 })
 it('keeps all six ranked country slope series and dims only rank six',()=>{
  const spec=SHIPPED_SPECS.find(s=>s.template.meta.id==='stress2_067_slope-movers')!
  const option=previewRows(spec,fixtureRows(spec),900,600).option
  expect(option.series).toHaveLength(6)
  expect(option.series.map(s=>s.lineStyle.opacity).sort()).toEqual([0.25,1,1,1,1,1])
 })
 it('renders real statistical marks rather than title-only placeholders',()=>{
  for(const id of ['stress2_097_normal-qq','stress2_098_hexbin-price-cost','stress2_099_density2d-price-cost','stress2_105_cohort-retention','stress2_107_pearson-six','stress2_116_word-cloud']) {
   const spec=SHIPPED_SPECS.find(s=>s.template.meta.id===id)!
   expect(spec,id).toBeDefined()
   const option=previewRows(spec,fixtureRows(spec),900,600).option
   expect(option.series[0].data.length,id).toBeGreaterThan(0)
   if(id.includes('density2d'))expect(option.series[0].data.some(d=>d.value[2]>0)).toBe(true)
   if(id.includes('cohort')) {
    expect(option.xAxis.data.length).toBeGreaterThan(1)
    expect(option.series[0].data.some(d=>d.value[2]>0&&d.value[2]<1)).toBe(true)
   }
   if(id.includes('word-cloud'))expect(option.series[0].data.every(d=>d.label.show&&d.label.fontSize>=12)).toBe(true)
  }
 })
 it('keeps control references strictly inside the padded domain and CI bounds around the estimate',()=>{
  const control=SHIPPED_SPECS.find(s=>s.template.meta.id==='stress2_079_control-chart')!
  expect(control).toBeDefined()
  const option=previewRows(control,positive,900,600).option
  expect(option.series[0].markLine.data.every(d=>d.yAxis>option.yAxis.min&&d.yAxis<option.yAxis.max)).toBe(true)
  const forest=SHIPPED_SPECS.find(s=>s.template.meta.id==='stress2_081_forest-range')!
  expect(forest).toBeDefined()
  // Fixture completeness is checked directly; the interval operation itself
  // is model-evaluated Student-t DAX, verified by the live four-tool run.
  const own=fixtureRows(forest);expect(own.every(r=>r._val<=r._val3&&r._val3<=r._val2)).toBe(true)
 })
 it('retains signed/zero/missing current-row KPI state and a strict twelve-item ranked list',()=>{
  const kpi=SHIPPED_SPECS.find(s=>s.template.meta.id==='stress2_085_kpi-sparkline')!
  expect(kpi).toBeDefined()
  // Positive/negative semantic colours remain explicit; neutral and empty text
  // inherit the current report foreground, rather than a dark-canvas grey.
  for(const [delta,text,colour] of [[.1,'10%','#2dd4bf'],[-.1,'-10%','#f87171'],[0,'0%','#252423'],[null,'No prior revenue','#252423']] as const) {
   const result=previewRows(kpi,[{_cat:'2026-01-01',_val:100,_val2:.2},{_cat:'2026-02-01',_val:110,_val2:delta}],900,600)
   const label=[...result.svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].find(m=>m[2]===text)
   expect(label,text).toBeDefined();expect(label![1]).toContain(`fill="${colour}"`)
   expect(result.option.series.at(-1).data[0].value).toBe(delta)
  }
  const ranked=SHIPPED_SPECS.find(s=>s.template.meta.id==='stress2_086_ranked-inline-bars')!
  const dark=previewRows(kpi,[{_cat:'2026-01-01',_val:100,_val2:.2},{_cat:'2026-02-01',_val:110,_val2:0}],900,600,{theme:'dark'})
  const neutral=[...dark.svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].find(m=>m[2]==='0%')
  expect(neutral![1]).toContain('fill="#f2f2f2"')
  expect(dark.option.backgroundColor).toBe('transparent')
  const option=previewRows(ranked,fixtureRows(ranked),900,600).option
  expect(option.yAxis.data).toHaveLength(12);expect(option.yAxis.data).not.toContain('Other')
 })
 it('retains exact signed waterfall segment geometry across zero',()=>{
  const spec=SHIPPED_SPECS.find(s=>s.template.meta.id==='expressiveness_waterfall')
  const result=previewRows(spec,[{_cat:'2026-01-01',_val:10},{_cat:'2026-02-01',_val:-15},{_cat:'2026-03-01',_val:7}])
  expect(result.option.series[0].data).toEqual([0,-5,-5])
  expect(result.option.series[1].data).toEqual([10,0,7])
  expect(result.option.series[2].data).toEqual([0,15,0])
  expect(result.option.series[3].data).toEqual([10,-5,2])
  expect(result.option.series.slice(0,3).every(s=>s.stackStrategy==='all')).toBe(true)
 })
 it('uses a genuinely derived start/duration span rather than a screenshot placeholder',()=>{
  const spec=SHIPPED_SPECS.find(s=>s.template.meta.id.endsWith('gantt'))
  const o=previewRows(spec,[{_cat:'Task',_cats:['Task','2026-03-07','2026-03-09'],_val:1}]).option
  expect(o.series[0].data).toEqual([Date.UTC(2026,2,7)]);expect(o.series[1].data).toEqual([2*86400000])
 })
 it('requires all three category bindings for sunburst',()=>{
  const spec=SHIPPED_SPECS.find(s=>s.template.meta.id.endsWith('sunburst'))
  expect(()=>validateBindings(spec,{dimensions:[{},{}],measures:[{}]})).toThrow(/requires 3 dimension/)
 })
 it('returns an exact category-c failure for the separately recorded unsupported template',()=>{
  const spec=JSON.parse(fs.readFileSync(new URL('../docs/expressiveness/marimekko.vilsem-visual.json',import.meta.url),'utf8'))
  expect(()=>validateSpec(spec)).toThrow('custom series requires a bounded expression AST')
 })
})

it('includes an out-of-series reference measure in the authored profit axis domain',()=>{
 const spec=SHIPPED_SPECS.find(s=>s.template.meta.id.endsWith('dual_axis'))
 const result=previewRows(spec,[{_cat:'2026-01-01',_val:100,_val2:10,_val3:200},{_cat:'2026-02-01',_val:110,_val2:12,_val3:250}])
 expect(result.option.yAxis[1].max).toBe(275)
 expect(result.option.series[1].markLine.data).toEqual([{yAxis:250}])
 expect(result.svg).toContain('Latest target 250')
})
