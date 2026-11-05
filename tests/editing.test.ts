import {describe,it,expect,afterEach} from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {makeVisualContainer,RENDERER_GUID} from '@vilsem/core/pbir'
import {CURRENT_SPEC_VERSION} from '@vilsem/core/spec/migrate'
import {readStoredVisual,listStoredVisuals,patchVisualSpec,writeStoredVisual,specDiff} from '../src/editing.js'
const folders:string[]=[]
afterEach(async()=>{for(const root of folders.splice(0))await fs.rm(root,{recursive:true,force:true})})
async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vilsem-edit-'));folders.push(root)
 const dir=path.join(root,'definition/pages/p1/visuals/bar1');await fs.mkdir(dir,{recursive:true})
 await fs.writeFile(path.join(root,'definition/pages/pages.json'),JSON.stringify({pageOrder:['p1']}));await fs.writeFile(path.join(root,'definition/pages/p1/page.json'),JSON.stringify({name:'p1',displayName:'Analysis'}))
 const value=makeVisualContainer({visualName:'bar1',spec:{type:'bar',config:{title:'Original'}},bindings:{dimensions:[{table:'Product',column:'Category'}],measures:[{table:'Sales',name:'Revenue'}]}})
 value.visual.objects.appearance=[{properties:{transparency:{expr:{Literal:{Value:'42D'}}}}}]
 const file=path.join(dir,'visual.json');await fs.writeFile(file,JSON.stringify(value));return {root,file,value}
}
describe('persistent custom visual editing',()=>{
 it('reads migrated spec, bindings and separate manual objects without changing bytes',async()=>{
  const {root,file,value}=await fixture(),bytes=await fs.readFile(file),r=await readStoredVisual(root,'p1','bar1')
  expect(r.bindings.measures[0]).toMatchObject({table:'Sales',name:'Revenue'});expect(r.specVersion).toBe(CURRENT_SPEC_VERSION);expect(r.formatPaneOverrides.appearance).toEqual(value.visual.objects.appearance)
  expect(await fs.readFile(file)).toEqual(bytes);const list=await listStoredVisuals(root);expect(list[0]).toMatchObject({name:'bar1',layer:'composition',summary:'bar: Category by Revenue'})
 })
 it('applies real RFC6902 operations and preserves manual formatting through recommit',async()=>{
  const {root,file,value}=await fixture(),item=await readStoredVisual(root,'p1','bar1')
  const patch=[{op:'test',path:'/config/title',value:'Original'},{op:'add',path:'/config/titleFontSize',value:18},{op:'replace',path:'/config/title',value:'Changed'}]
  const next=patchVisualSpec(item.spec,patch);expect(item.spec.config.title).toBe('Original');expect(specDiff(item.spec,next)).toHaveLength(2)
  await writeStoredVisual(item,next)
  const after=JSON.parse(await fs.readFile(file,'utf8'));expect(after.visual.objects.appearance).toEqual(value.visual.objects.appearance);expect(after.visual.query).toEqual(value.visual.query);expect(after.position).toEqual(value.position)
  expect((await readStoredVisual(root,'p1','bar1')).spec.config).toMatchObject({title:'Changed',titleFontSize:18})
 })
 it('removes manual objects only with an explicit reset',async()=>{const {root}=await fixture(),item=await readStoredVisual(root,'p1','bar1');await writeStoredVisual(item,item.spec,{resetFormatting:true});expect((await readStoredVisual(root,'p1','bar1')).formatPaneOverrides).toEqual({})})
 it('keeps unknown non-format state objects even when common formatting is reset',async()=>{
  const {root,file,value}=await fixture();value.visual.objects.internalState=[{properties:{state:{expr:{Literal:{Value:"'preserve'"}}}}}];await fs.writeFile(file,JSON.stringify(value))
  const item=await readStoredVisual(root,'p1','bar1');await writeStoredVisual(item,item.spec,{resetFormatting:true})
  const after=JSON.parse(await fs.readFile(file,'utf8'));expect(after.visual.objects.internalState).toEqual(value.visual.objects.internalState);expect(after.visual.objects.appearance).toBeUndefined()
 })
 it.each(['/visualType','/guid','/rendererGuid','/specVersion','/__proto__/polluted','/config/constructor/prototype'])('refuses protected path%s',path=>expect(()=>patchVisualSpec({type:'bar'},[{op:'add',path,value:'evil'}])).toThrow(/cannot change/))
 it('rejects failed tests, invalid paths and native types before writes',()=>{
  expect(()=>patchVisualSpec({type:'bar'},[{op:'test',path:'/type',value:'line'}])).toThrow()
  expect(()=>patchVisualSpec({type:'bar'},[{op:'replace',path:'/missing',value:1}])).toThrow()
  expect(()=>patchVisualSpec({type:'bar'},[{op:'replace',path:'/type',value:'nativeBar'}])).toThrow(/not supported/)
  expect(({} as any).polluted).toBeUndefined()
 })
 it('detects intervening Desktop saves rather than overwriting them',async()=>{
  const {root,file}=await fixture(),item=await readStoredVisual(root,'p1','bar1'),changed=Buffer.from(JSON.stringify({...item.value,external:'keep'}))
  await fs.writeFile(file,changed);await expect(writeStoredVisual(item,item.spec)).rejects.toThrow('changed since');expect(await fs.readFile(file)).toEqual(changed);expect(await fs.readdir(path.dirname(file))).toEqual(['visual.json'])
 })
 it('refuses native visuals and folder traversal',async()=>{
  const {root,file,value}=await fixture();value.visual.visualType='card';await fs.writeFile(file,JSON.stringify(value))
  await expect(readStoredVisual(root,'p1','bar1')).rejects.toThrow('Only vilsem');expect(await listStoredVisuals(root)).toEqual([])
  await expect(readStoredVisual(root,'../p1','bar1')).rejects.toThrow(/internal PBIR/)
  expect(RENDERER_GUID).toBe('semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D')
 })
})
