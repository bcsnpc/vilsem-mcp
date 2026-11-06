import {it,expect} from 'vitest'
import {previewRows,rasterizeSvg,rasterizeSvgBatch} from '../src/preview.js'
import {critiqueVisual} from '../src/critique.js'
it('batches distinct raster states with identical pixels to individual isolated renders',()=>{
 const svg=color=>`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><rect x="3" y="4" width="17" height="12" fill="${color}"/></svg>`
 const states=['red','blue'].map(svg),batch=rasterizeSvgBatch(states,'#ffffff')
 expect(batch).toHaveLength(2)
 expect(batch[0]).toEqual(rasterizeSvg(states[0],'#ffffff'))
 expect(batch[1]).toEqual(rasterizeSvg(states[1],'#ffffff'))
 expect(batch[0]).not.toEqual(batch[1])
 expect(()=>rasterizeSvgBatch([])).toThrow(/1\.\.12/)
 expect(()=>rasterizeSvgBatch(Array(13).fill(states[0]))).toThrow(/1\.\.12/)
})
it('contains a failed raster batch and can render a subsequent request',()=>{
 expect(()=>rasterizeSvgBatch(['<svg not valid'])).toThrow(/isolated worker/)
 expect(rasterizeSvgBatch(['<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>'])[0].length).toBeGreaterThan(0)
})
it('renders final timeline state plus distinct bounded APNG states and a contact sheet',()=>{
 const spec={type:'custom',template:{meta:{id:'timeline-preview',formatVersion:4},slots:{value:{kind:'measure'}},template:{baseOption:{timeline:{axisType:'category',autoPlay:true,playInterval:1000,data:['Before','After']},xAxis:{type:'category',data:['A']},yAxis:{type:'value',min:0,max:10},series:[{id:'stable',type:'bar',data:[1]}]},options:[{series:[{id:'stable',type:'bar',data:[1]}]},{series:[{id:'stable',type:'bar',data:[9]}]}]}}}
 const result=previewRows(spec,[{_cat:'A',_val:1}],320,240,{frames:2,critique:false});expect(result.png.length).toBeGreaterThan(100);expect(result.apng?.length).toBeLessThanOrEqual(2097152);expect(result.apng?.includes(Buffer.from('acTL'))).toBe(true);expect(result.contactSheet?.length).toBeGreaterThan(100);expect(result.motion.sampledIndices).toEqual([0,1]);expect(result.svg).not.toContain('NaN')
 expect(result.svg).not.toContain('@keyframes')
 expect(result.png).toEqual(rasterizeSvg(result.svg))
 const thumbnail=previewRows(spec,[{_cat:'A',_val:1}],320,240,{frames:2,critique:false,sampleMotion:false})
 expect(thumbnail.png).toEqual(result.png);expect(thumbnail.apng).toBeUndefined();expect(thumbnail.contactSheet).toBeUndefined();expect(thumbnail.motion.sampledIndices).toEqual([]);expect(thumbnail.motion.kind).toBe('static')
})
it('flags motion duration and excessive timeline steps with editable paths',()=>{
 const result=critiqueVisual({template:{animation:{enter:{duration:5000}}}},{baseOption:{timeline:{playInterval:500}},options:Array(61).fill({})},[],800,500)
 expect(result.findings.map(f=>f.code)).toContain('animation-duration');expect(result.findings.find(f=>f.code==='timeline-steps')?.path).toBe('/template/template/options')
})
