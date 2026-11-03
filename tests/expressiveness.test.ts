import {describe,it,expect} from 'vitest'
import fs from 'node:fs'
import {SHIPPED_SPECS} from '../src/templates.js'
import {validateSpec,validateBindings} from '../src/reports.js'
import {previewRows} from '../src/preview.js'
const rows=Array.from({length:12},(_,i)=>({_cat:`2026-${String(i+1).padStart(2,'0')}-01`,_cat2:i%2?'West':'East',_cats:[`2026-${String(i+1).padStart(2,'0')}-01`,i%2?'West':'East','Red'],_val:i%2?-2:10,_val2:15,_val3:8}))
const positive=rows.map(r=>({...r,_val:Math.abs(r._val)}))
describe('shipped expressiveness specs',()=>{
 it('ships only the nine declarative passing examples',()=>{expect(SHIPPED_SPECS).toHaveLength(9);expect(new Set(SHIPPED_SPECS.map(s=>s.template.meta.id)).size).toBe(9)})
 it.each(SHIPPED_SPECS.map(s=>[s.template.meta.id,s]))('resolves and renders %s without imperative callbacks',(_name,spec)=>{
  expect(()=>validateSpec(spec)).not.toThrow()
  const ownRows=spec.template.meta.id.endsWith('gantt')?positive.map((r,i)=>({...r,_cats:[`Order ${i+1}`,'2026-01-01','2026-01-05']})):positive
  const result=previewRows(spec,ownRows,900,600)
  expect(result.png.length).toBeGreaterThan(1500)
  expect(Buffer.from(result.png).readUInt32BE(16)).toBe(900)
  expect(()=>previewRows(spec,[],900,600)).not.toThrow()
 })
 it('retains exact signed waterfall segment geometry across zero',()=>{
  const spec=SHIPPED_SPECS.find(s=>s.template.meta.id.endsWith('waterfall'))
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
