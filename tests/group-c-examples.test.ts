import {it,expect} from 'vitest'
import {SHIPPED_SPECS} from '../src/templates.js'
import {previewRows} from '../src/preview.js'
import {collectTimelineSeries} from '@vilsem/core/templates'
// Deterministic synthetic model-grain fixtures. Numeric dimensions remain
// numeric, and periods/countries/categories form unique query groups.
function records(spec:any){
 const fields=spec.bindings.dimensions,count=!fields.length?1:fields.length===1&&fields[0].column==='Country'?6:fields.length===1&&fields[0].column==='Year'?3:fields.length===2&&fields.some(f=>f.column==='CategoryName')?18:36
 return Array.from({length:count},(_,i)=>{
  const timeGrain=fields.length===1?1:fields.some(f=>f.column==='CategoryName')?18:6;const values=fields.map(({column})=>({Country:['Australia','Canada','France','Germany','United Kingdom','United States'][i%6],CategoryName:['Bikes','Clothing','Accessories'][Math.floor(i/6)%3],ProductKey:i+1,ProductName:`Road Bike ${i+1}`,ProductPrice:50+i%12*25,ProductCost:25+i%12*12,ProductColor:i%2?'Black':'Red',ProductStyle:i%3?'U':'M',PricePoint:i%4?'High':'Low','Start of Month':new Date(Date.UTC(2020,Math.floor(i/timeGrain),1)).toISOString(),Date:new Date(Date.UTC(2020,0,i+1)).toISOString(),Year:2020+i})[column]??`Group ${i%3}`)
  const measures=spec.bindings.measures.map(({name})=>/Count/i.test(name)?1:/Orders/i.test(name)?i%20+1:/Profit/i.test(name)?30+i*3:100+i*15)
  return {_cat:values[0],_cat2:values[1],_cats:values,_val:measures[0],_val2:measures[1],_val3:measures[2],_vals:measures,_sourceIndex:i}
 })
}
it.each(SHIPPED_SPECS.filter(s=>s.template.meta.id.startsWith('stress3-')).map(s=>[s.template.meta.id,s]))('draws populated GroupC example %s rather than accepting an empty PNG',(_id,spec:any)=>{
 const result=previewRows(spec,records(spec),800,500,{frames:2,critique:false}),series=collectTimelineSeries(result.option)
 expect(result.svg).not.toContain('NaN');expect(result.png.length).toBeGreaterThan(1000)
 if(series.length)expect(series.reduce((sum,s)=>sum+(s.data?.length??0),0)).toBeGreaterThan(0)
 else expect(result.option.graphic?.length).toBeGreaterThan(0)
 for(const s of series)if(s.type==='custom'){
  // A silent viewport panel is decoration, not a model-backed data mark.
  // Interactive custom series must still retain exact source identities.
  if(s.silent===true&&s.coordinateSystem==='none'){
   expect(s.tooltip?.show).toBe(false)
   expect(s.renderItem.vilsemExpression.ast.root.silent).toBe(true)
  }else expect(s.data.some(d=>d.rowIndexes?.length)).toBe(true)
 }
})
