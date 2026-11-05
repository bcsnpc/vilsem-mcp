import {it,expect} from 'vitest'
import {previewRows} from '../src/preview.js'
import {critiqueVisual} from '../src/critique.js'
it('renders final timeline state plus distinct bounded APNG states and a contact sheet',()=>{
 const spec={type:'custom',template:{meta:{id:'timeline-preview',formatVersion:4},slots:{value:{kind:'measure'}},template:{baseOption:{timeline:{axisType:'category',autoPlay:true,playInterval:1000,data:['Before','After']},xAxis:{type:'category',data:['A']},yAxis:{type:'value',min:0,max:10},series:[{id:'stable',type:'bar',data:[1]}]},options:[{series:[{id:'stable',type:'bar',data:[1]}]},{series:[{id:'stable',type:'bar',data:[9]}]}]}}}
 const result=previewRows(spec,[{_cat:'A',_val:1}],320,240,{frames:2,critique:false});expect(result.png.length).toBeGreaterThan(100);expect(result.apng?.length).toBeLessThanOrEqual(2097152);expect(result.apng?.includes(Buffer.from('acTL'))).toBe(true);expect(result.contactSheet?.length).toBeGreaterThan(100);expect(result.motion.sampledIndices).toEqual([0,1]);expect(result.svg).not.toContain('NaN')
 expect(result.svg).not.toContain('@keyframes')
})
it('flags motion duration and excessive timeline steps with editable paths',()=>{
 const result=critiqueVisual({template:{animation:{enter:{duration:5000}}}},{baseOption:{timeline:{playInterval:500}},options:Array(61).fill({})},[],800,500)
 expect(result.findings.map(f=>f.code)).toContain('animation-duration');expect(result.findings.find(f=>f.code==='timeline-steps')?.path).toBe('/template/template/options')
})
