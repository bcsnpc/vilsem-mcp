import {describe,it,expect} from 'vitest'
import {assessInteractions} from '../src/interactions.js'
describe('honest preview interaction assessment',()=>{
 it('reports selectable native-host capabilities without pretending SSR exercised them',()=>{
  const result=assessInteractions({type:'column'},{series:[{type:'bar',data:[3,2]}]},2)
  expect(result.selection).toBe('supported');expect(result.assessment).toContain('does not verify')
  expect(result.contextMenu).toContain('configured destination');expect(result.nativeTooltip).toContain('report configuration')
 })
 it.each([{series:[]},{series:[{type:'bar',silent:true,data:[1]}]}])('does not advertise selection for graphics-only/silent output',option=>{
  expect(assessInteractions({},option,1).selection).toBe('unavailable')
 })
 it('discloses empty-query and radar limitations',()=>{
  expect(assessInteractions({},{series:[{type:'bar',data:[]}]},0).warnings.join()).toContain('query is empty')
  expect(assessInteractions({},{series:[{type:'radar',data:[{value:[1,2]}]}]},2).crossHighlightIn).toBe('limited')
 })
 it('warns about transformed marks lacking explicit provenance but accepts row-indexed marks',()=>{
  const spec={template:{transforms:[{stat:{op:'sum'},as:'s'}]}}
  expect(assessInteractions(spec,{series:[{data:[{value:3}]}]},2).warnings.join()).toContain('rowIndexes')
  expect(assessInteractions(spec,{series:[{data:[{value:3,rowIndexes:[0,1]}]}]},2).warnings).toEqual([])
 })
})
