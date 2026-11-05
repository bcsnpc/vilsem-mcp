// Deterministic synthetic fixtures, never model/client data.
export const rows=Array.from({length:12},(_,i)=>({_cat:`2026-${String(i+1).padStart(2,'0')}-01`,_cat2:i%2?'West':'East',_cats:[`2026-${String(i+1).padStart(2,'0')}-01`,i%2?'West':'East','Red'],_val:i%2?-2:10,_val2:15,_val3:8}))
// All six host measure roles are populated. OHLC order is open/close/low/high,
// so financial examples render real marks rather than an empty title-only SVG.
export const positive=rows.map((r,i)=>({...r,_val:10+i%3,_val2:12,_val3:8,_vals:[10+i%3,12,8,15,50,30]}))
// This template facets by Country (six panels), then Category (three axes).
// The generic twelve-month fixture is not a valid country-cardinality fixture.
export const countryRadar=Array.from({length:18},(_,i)=>({_cat:`Country ${Math.floor(i/3)+1}`,_cat2:`Category ${i%3+1}`,_cats:[`Country ${Math.floor(i/3)+1}`,`Category ${i%3+1}`],_val:(i+1)*10}))
export function fixtureRows(spec) {
 const id=spec.template.meta.id
 if(/^stress2_(006|007|068|069|070)_/.test(id))return Array.from({length:72},(_,i)=>{
  const date=`2026-${String(i%12+1).padStart(2,'0')}-01`,group=`Group ${Math.floor(i/12)+1}`
  return {_cat:date,_cat2:group,_cats:[date,group],_val:100+Math.floor(i/12)*12+(i%12)*3+Math.sin(i%12)*15}
 })
 if(id==='stress2_071_gantt-country')return Array.from({length:12},(_,i)=>{
  const order=`Order ${i+1}`,owner=`Country ${i%3+1}`,start=`2022-01-${String(i+1).padStart(2,'0')}`,end=`2022-01-${String(i+5).padStart(2,'0')}`
  return {_cat:order,_cats:[order,owner,start,end],_val:3+i%4}
 })
 if(id==='stress2_016_revenue-strip')return Array.from({length:24},(_,i)=>{
  const group=`Category ${Math.floor(i/8)+1}`,value=50+i%8*23+Math.floor(i/8)*7
  return {_cat:group,_cat2:value,_cats:[group,value],_val:1}
 })
 if(id==='stress2_037_calendar-margin')return Array.from({length:90},(_,i)=>{
  const date=new Date(Date.UTC(2022,0,1+i)).toISOString().slice(0,10)
  return {_cat:date,_cats:[date],_val:.2+(i%17)/100}
 })
 if(id==='stress2_060_radar-small-multiples'||id==='stress2_083_bar-shared-axis')return countryRadar
 if(id==='stress2_084_line-free-axis')return countryRadar.map((r,i)=>({...r,_cat2:`2026-0${i%3+1}-01`,_cats:[r._cat,`2026-0${i%3+1}-01`]}))
 if(id==='stress2_066_bump-rank')return countryRadar.map((r,i)=>({_cat:`2026-0${i%3+1}-01`,_cat2:r._cat,_cats:[`2026-0${i%3+1}-01`,r._cat],_val:(Math.floor(i/3)+i%3)%6+1}))
 if(id==='stress2_067_slope-movers')return Array.from({length:6},(_,i)=>({_cat:`Country ${i+1}`,_cats:[`Country ${i+1}`],_val:100+i*3,_val2:105+i*7,_val3:i+1}))
 if(id==='stress2_081_forest-range')return Array.from({length:6},(_,i)=>({_cat:`Country ${i+1}`,_val:80+i,_val2:120+i,_val3:100+i}))
 if(id==='stress2_085_kpi-sparkline')return positive.map((r,i)=>({...r,_val:100+i*5,_val2:i?0.03:null,_vals:[100+i*5,i?0.03:null]}))
 if(/^stress2_(078|082)_/.test(id))return Array.from({length:6},(_,i)=>({_cat:`Country ${i+1}`,_val:80+i,_val2:120+i,_val3:100+i}))
 if(id==='stress2_008_100-percent-column')return positive.map(r=>({...r,_vals:[.35,.65]}))
 if(id==='stress2_019_semi-donut-kpi')return [{_val:42,_val2:58}]
 if(id==='stress2_026_linear-gauge')return [{_val:42}]
 if(id==='stress2_027_multi-ring-progress')return [{_val:75,_val2:42,_val3:3}]
 if(id==='stress2_029_dual-axis-reference')return positive.map((r,i)=>({...r,_vals:[1000+i*80,.35+i%3*.03,.4]}))
 if(id==='stress2_075_labelled-quadrants')return positive.map((r,i)=>({...r,_vals:[100+i*15,.2+i%4*.05,10+i]}))
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
 if(id==='stress2_116_word-cloud')return positive.map((r,i)=>{
  const product=`${i%2?'Mountain':'Road'} Bike ${i%3?'Red':'Blue'} ${i+10}`
  return {...r,_cat:product,_cats:[product]}
 })
 if(id==='stress2_118_hierarchy-flame')return positive.map((r,i)=>({...r,_cats:[`Category ${i%3}`,`Subcategory ${i%6}`,`Product ${i}`]}))
 if(/^stress2_0(91|92|93|94|96)_/.test(id))return Array.from({length:18},(_,i)=>({_cat:`Group ${Math.floor(i/(id.includes('_093_')?6:3))+1}`,_cats:[`Group ${Math.floor(i/(id.includes('_093_')?6:3))+1}`,`Product ${i+1}`,50+i%9*75],_val:1}))
 return id.endsWith('gantt')?positive.map((r,i)=>({...r,_cats:[`Order ${i+1}`,'2026-01-01','2026-01-05']})):positive
}
