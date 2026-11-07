import{it,expect}from'vitest'
import{critiqueVisual}from'../src/critique.js'
import{previewRows}from'../src/preview.js'
it('reports explicit native SVG fallback with an actionable path',()=>{
 const spec={type:'custom',config:{renderer:'svg'},template:{meta:{id:'svg-fallback'},slots:{v:{kind:'measure'}},template:{series:[]}}}
 const findings=critiqueVisual(spec,{series:[{type:'heatmap',blendMode:'lighter',data:[]}]},[],800,500).findings
 expect(findings.find(f=>f.code==='renderer-fallback')).toMatchObject({severity:'warning',path:'/config/renderer',message:expect.stringContaining('falls back to Canvas'),suggestedFix:expect.stringContaining('Canvas-only')})
 expect(critiqueVisual({...spec,config:{renderer:'canvas'}},{series:[{type:'heatmap',blendMode:'lighter'}]},[],800,500).findings.some(f=>f.code==='renderer-fallback')).toBe(false)
})
it('keeps sharp SSR option and pixels unchanged when only the native painter changes',()=>{
 const spec={type:'bar',config:{animationEnabled:false}},rows=[{c:'A',v:12},{c:'B',v:24}]
 const a=previewRows(spec,rows,500,300),b=previewRows({...spec,config:{...spec.config,renderer:'svg'}},rows,500,300)
 expect(b.png).toEqual(a.png);expect(b.svg).toEqual(a.svg)
})
