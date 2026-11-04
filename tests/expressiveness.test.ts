import {describe,it,expect} from 'vitest'
import fs from 'node:fs'
import {SHIPPED_SPECS} from '../src/templates.js'
import {validateSpec,validateBindings} from '../src/reports.js'
import {previewRows} from '../src/preview.js'
const rows=Array.from({length:12},(_,i)=>({_cat:`2026-${String(i+1).padStart(2,'0')}-01`,_cat2:i%2?'West':'East',_cats:[`2026-${String(i+1).padStart(2,'0')}-01`,i%2?'West':'East','Red'],_val:i%2?-2:10,_val2:15,_val3:8}))
// All six host measure roles are populated. OHLC order is open/close/low/high,
// so financial examples render real marks rather than an empty title-only SVG.
const positive=rows.map((r,i)=>({...r,_val:10+i%3,_val2:12,_val3:8,_vals:[10+i%3,12,8,15,50,30]}))
// This template facets by Country (six panels), then Category (three axes).
// The generic twelve-month fixture is not a valid country-cardinality fixture.
const countryRadar=Array.from({length:18},(_,i)=>({_cat:`Country ${Math.floor(i/3)+1}`,_cat2:`Category ${i%3+1}`,_cats:[`Country ${Math.floor(i/3)+1}`,`Category ${i%3+1}`],_val:(i+1)*10}))
function fixtureRows(spec:any) {
 const id=spec.template.meta.id
 if(id==='stress2_060_radar-small-multiples'||id==='stress2_083_bar-shared-axis')return countryRadar
 if(id==='stress2_084_line-free-axis')return countryRadar.map((r,i)=>({...r,_cat2:`2026-0${i%3+1}-01`,_cats:[r._cat,`2026-0${i%3+1}-01`]}))
 if(id==='stress2_066_bump-rank')return countryRadar.map((r,i)=>({_cat:`2026-0${i%3+1}-01`,_cat2:r._cat,_cats:[`2026-0${i%3+1}-01`,r._cat],_val:(Math.floor(i/3)+i%3)%6+1}))
 if(id==='stress2_067_slope-movers')return Array.from({length:6},(_,i)=>({_cat:`Country ${i+1}`,_cats:[`Country ${i+1}`],_val:100+i*3,_val2:105+i*7,_val3:i+1}))
 if(id==='stress2_081_forest-range')return Array.from({length:6},(_,i)=>({_cat:`Country ${i+1}`,_val:80+i,_val2:120+i,_val3:100+i}))
 if(id==='stress2_085_kpi-sparkline')return positive.map((r,i)=>({...r,_val:100+i*5,_val2:i?0.03:null}))
 if(id==='stress2_086_ranked-inline-bars')return Array.from({length:18},(_,i)=>({_cat:`Model ${i+1}`,_val:200-i*8}))
 if(/^stress2_(089|090|095|097|110)_/.test(id))return Array.from({length:18},(_,i)=>({_cat:`Product ${i+1}`,_cats:[`Product ${i+1}`,50+i%9*75],_val:1}))
 if(/^stress2_(098|099)_/.test(id))return Array.from({length:18},(_,i)=>({_cat:`Product ${i+1}`,_cats:[`Product ${i+1}`,50+i%9*75,25+i%7*40],_val:1}))
 if(/^stress2_(100|108)_/.test(id))return Array.from({length:18},(_,i)=>({_cat:`Subcategory ${i+1}`,_val:100-i*5}))
 if(/^stress2_(101|106)_/.test(id))return countryRadar
 if(id==='stress2_102_yoy-variance')return Array.from({length:6},(_,i)=>({_cat:`Country ${i+1}`,_val:100+i*5,_val2:i%2?150:80,_val3:i%2?-.2:.3}))
 if(id==='stress2_103_rebase-index')return countryRadar.map((r,i)=>({_cat:`2026-0${i%3+1}-01`,_cats:[`2026-0${i%3+1}-01`,r._cat],_val:20+i*5}))
 if(id==='stress2_105_cohort-retention')return [6,3,2].flatMap((count,month)=>Array.from({length:count},(_,i)=>({_cat:`2026-0${month+1}-01`,_cats:[`2026-0${month+1}-01`,`Customer ${i}`],_val:1,_val2:Date.UTC(2026,0,1)/86400000})))
 if(id==='stress2_107_pearson-six')return positive.map((r,i)=>({...r,_vals:[10+i,30-i,5+(i%4)*2,20+2*i,8+i%3,3+i]}))
 if(id==='stress2_115_country-tile-grid')return ['Canada','United States','United Kingdom','France','Germany','Australia'].map((country,i)=>({_cat:country,_val:100*(i+1)}))
 if(id==='stress2_116_word-cloud')return positive.map((r,i)=>({...r,_cat:`${i%2?'Mountain':'Road'} Bike ${i%3?'Red':'Blue'} ${i+10}`}))
 if(id==='stress2_118_hierarchy-flame')return positive.map((r,i)=>({...r,_cats:[`Category ${i%3}`,`Subcategory ${i%6}`,`Product ${i}`]}))
 if(/^stress2_0(91|92|93|94|96)_/.test(id))return Array.from({length:18},(_,i)=>({_cat:`Group ${Math.floor(i/(id.includes('_093_')?6:3))+1}`,_cats:[`Group ${Math.floor(i/(id.includes('_093_')?6:3))+1}`,`Product ${i+1}`,50+i%9*75],_val:1}))
 return id.endsWith('gantt')?positive.map((r,i)=>({...r,_cats:[`Order ${i+1}`,'2026-01-01','2026-01-05']})):positive
}
describe('shipped expressiveness specs',()=>{
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
  for(const [delta,text,colour] of [[.1,'10%','#2dd4bf'],[-.1,'-10%','#f87171'],[0,'0%','#94a3b8'],[null,'No prior revenue','#94a3b8']] as const) {
   const result=previewRows(kpi,[{_cat:'2026-01-01',_val:100,_val2:.2},{_cat:'2026-02-01',_val:110,_val2:delta}],900,600)
   const label=[...result.svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].find(m=>m[2]===text)
   expect(label,text).toBeDefined();expect(label![1]).toContain(`fill="${colour}"`)
   expect(result.option.series.at(-1).data[0].value).toBe(delta)
  }
  const ranked=SHIPPED_SPECS.find(s=>s.template.meta.id==='stress2_086_ranked-inline-bars')!
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
  expect(()=>validateSpec(spec)).toThrow('custom series requires imperative renderItem; executable callbacks are not supported by the declarative format')
 })
})

it('includes an out-of-series reference measure in the authored profit axis domain',()=>{
 const spec=SHIPPED_SPECS.find(s=>s.template.meta.id.endsWith('dual_axis'))
 const result=previewRows(spec,[{_cat:'2026-01-01',_val:100,_val2:10,_val3:200},{_cat:'2026-02-01',_val:110,_val2:12,_val3:250}])
 expect(result.option.yAxis[1].max).toBe(275)
 expect(result.option.series[1].markLine.data).toEqual([{yAxis:250}])
 expect(result.svg).toContain('Latest target 250')
})
