import {describe,it,expect} from 'vitest'
import {critiqueVisual,renderedText} from '../src/critique.js'
import {createRequire} from 'node:module'
const echarts=createRequire(import.meta.url)('echarts')
const spec={template:{slots:{category:{kind:'dimension'}}}}
const inspect=(option:any,geometry:any[]=[],context:any={})=>critiqueVisual(spec,option,[{}],300,200,geometry,context).findings
const label=(text:string,x=10,y=10,fill='#111111')=>({text,x,y,width:70,height:20,fill,path:'/template/template/xAxis/0/axisLabel'})
describe('actionable preview critique',()=>{
 it('ignores a static annotation invocation row while retaining real zero/data-dependent warnings',()=>{
  const panel={type:'custom',coordinateSystem:'none',silent:true,data:[0],renderItem:{language:'vilsem-expression',version:1,root:{type:'rect',role:'annotation',silent:true,shape:{x:0,y:0,width:100,height:50},style:{fill:'#ffffff'}}}}
  expect(inspect({series:[panel,{type:'bar',data:[2,3]}]}).some(f=>f.code==='all-zero')).toBe(false)
  expect(inspect({series:[panel,{type:'bar',data:[0,0]}]}).some(f=>f.code==='all-zero')).toBe(true)
  const palette=Array.from({length:13},(_,i)=>`#${i.toString().padStart(6,'0')}`)
  expect(inspect({color:palette,series:[panel,...Array.from({length:12},()=>({type:'bar',data:[1]}))]}).some(f=>f.code==='categorical-colors')).toBe(false)
  expect(inspect({backgroundColor:'#ffffff'},[label('Dark',10,10,'#17243b')],{background:'#111111'}).some(f=>f.code==='text-contrast')).toBe(false)
  expect(inspect({backgroundColor:'transparent'},[label('Light',10,10,'#eeeeee')],{background:'#111111'}).some(f=>f.code==='text-contrast')).toBe(false)
  const measured=structuredClone(panel);measured.renderItem.root.shape.width={op:'value',args:[0]} as any
  expect(inspect({series:[measured]}).some(f=>f.code==='all-zero')).toBe(true)
 })
 const fixtures:[string,any,any[],any][]=[
  ['all-null',{series:[{data:[null,null]}]},[],{}],
  ['all-zero',{series:[{data:[0,0]}]},[],{}],
  ['pie-slices',{series:[{type:'pie',data:Array(8).fill(1)}]},[],{}],
  ['categorical-colors',{color:Array.from({length:13},(_,i)=>`#${i.toString().padStart(6,'0')}`),series:Array.from({length:13},()=>({type:'line',data:[1]}))},[],{}],
  ['axis-rotation',{xAxis:{axisLabel:{rotate:60}}},[],{}],
  ['dual-axis',{yAxis:[{},{}]},[],{}],
  ['missing-format',{},[],{measures:[{name:'Margin'}]}],
  ['clipped-label',{},[label('outside',280)],{}],
  ['truncated-category',{},[label('Long…')],{}],
  ['text-contrast',{},[label('dim',10,10,'#eeeeee')],{background:'#ffffff'}],
  ['overlapping-labels',{},[label('First'),label('Second',20)],{}],
  ['legend-over-data',{legend:{},grid:{left:0,top:0,width:200,height:120}},[{...label('Revenue'),path:'/template/template/legend'}],{}],
 ]
 for(const [code,option,geometry,context] of fixtures)it(`reports ${code} with a path and fix`,()=>{const found=inspect(option,geometry,context).find(f=>f.code===code);expect(found).toMatchObject({path:expect.stringMatching(/^\//),suggestedFix:expect.any(String),severity:expect.stringMatching(/warning|info/)});expect(found!.suggestedFix.length).toBeGreaterThan(10)})
 it('reports empty required slots without treating zeros as null',()=>{expect(critiqueVisual(spec,{},[],300,200).findings[0].code).toBe('empty-slot');expect(inspect({series:[{data:[0,1]}]})).toEqual([])})
 it('measures clipped/overlapping text from the actual SVG renderer',()=>{
  const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:300,height:200})
  const option={animation:false,graphic:[{type:'text',left:290,top:10,style:{text:'outside',fill:'#111'}},{type:'text',left:10,top:30,style:{text:'First'}},{type:'text',left:15,top:30,style:{text:'Second'}}]}
  try{chart.setOption(option);expect(chart.renderToSVGString()).toContain('outside');const geometry=renderedText(chart,option),findings=inspect(option,geometry);expect(geometry).toHaveLength(3);expect(findings.some(f=>f.code==='clipped-label')).toBe(true);expect(findings.some(f=>f.code==='overlapping-labels')).toBe(true)}finally{chart.dispose()}
 })
 it('does not claim SSR verifies report interactions or painted mark contrast',()=>{const r=critiqueVisual(spec,{series:[{type:'bar',data:[1]}]},[{}],300,200);expect(r.interactions.assessment).toContain('does not verify');expect(r.coverage.limitations.join(' ')).toContain('filled-mark')})
 it('uses4.5for normal text and3for large text instead of missing borderline small labels',()=>{
  const small={...label('Normal',10,10,'#777777'),fontSize:12},large={...small,text:'Large',fontSize:24}
  expect(inspect({},[small],{background:'#ffffff'}).find(f=>f.code==='text-contrast')?.evidence).toMatchObject({threshold:4.5})
  expect(inspect({},[large],{background:'#ffffff'}).some(f=>f.code==='text-contrast')).toBe(false)
 })
})
