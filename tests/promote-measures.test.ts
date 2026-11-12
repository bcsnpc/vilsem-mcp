import {it,expect,afterEach} from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
const exec=promisify(execFile),temporary:string[]=[]
const script=path.resolve('skills/vilsem-powerbi-visuals/scripts/promote-measures.py')
const python=process.env.PYTHON??(process.platform==='win32'?'python':'python3')
const run=(report:string,...args:string[])=>exec(python,[script,report,...args],{env:{...process.env,PYTHONIOENCODING:'utf-8'}})
afterEach(async()=>{
 const temp=await fs.realpath(os.tmpdir())
 for(const dir of temporary.splice(0)){
  const real=await fs.realpath(dir)
  if(!real.startsWith(temp+path.sep)||!path.basename(real).startsWith('vilsem-promote-'))throw Error('Unsafe test cleanup')
  await fs.rm(real,{recursive:true,force:true})
 }
})
async function fixture(existing=''){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vilsem-promote-'));temporary.push(root)
 const report=path.join(root,'Demo.Report'),model=path.join(root,'Demo.SemanticModel')
 const table=path.join(model,'definition/tables/KPI Measures.tmdl')
 const visual=path.join(report,'definition/pages/demo/visuals/vilsem_demo/visual.json')
 const spec={version:1,type:'custom',measures:{'Demo Sales':{expression:"SUM('Sales'[Amount])",format:'$#,0.00'}},bindings:{measures:[{table:'Sales',name:'Demo Sales'}]}}
 const v={name:'vilsem_demo',visual:{visualType:'semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D',objects:{semantica:[{properties:{primitiveSpec:{expr:{Literal:{Value:"'"+JSON.stringify(spec).replaceAll("'","''")+"'"}}}}}]},query:{queryState:{content:{projections:[{field:{NativeMeasure:{ProposedName:'Demo Sales'}},queryRef:'Sales.Demo Sales',nativeQueryRef:'Demo Sales'}]}}}}}
 for(const file of [table,visual])await fs.mkdir(path.dirname(file),{recursive:true})
 await fs.writeFile(table,"table 'KPI Measures'\n"+existing+'\n\tcolumn Placeholder\n\t\tdataType: int64\n')
 await fs.writeFile(visual,JSON.stringify(v,null,2))
 await fs.writeFile(path.join(report,'definition.pbir'),JSON.stringify({datasetReference:{byPath:{path:'../Demo.SemanticModel'}}}))
 await fs.writeFile(path.join(report,'definition/pages/demo/page.json'),JSON.stringify({name:'demo',displayName:'Demo page'}))
 const native=path.join(report,'definition/pages/demo/visuals/native/visual.json');await fs.mkdir(path.dirname(native),{recursive:true});await fs.writeFile(native,JSON.stringify({visual:{visualType:'barChart'}}))
 return {root,report,model,table,visual,native}
}
async function snapshot(root:string):Promise<Record<string,string>>{
 const out:Record<string,string>={}
 for(const item of await fs.readdir(root,{withFileTypes:true})){
  const full=path.join(root,item.name)
  if(item.isDirectory())for(const [relative,bytes]of Object.entries(await snapshot(full)))out[path.join(item.name,relative)]=bytes
  else out[item.name]=(await fs.readFile(full)).toString('base64')
 }
 return out
}
it('dry-runs a local PBIP promotion without writing any file',async()=>{
 const f=await fixture(),before=await snapshot(f.root),result=await run(f.report)
 expect(result.stdout).toContain('Visuals to rewire : 1');expect(result.stdout).toMatch(/New model measures:\s+1/)
 expect(result.stdout).toContain('Dry run only');expect(await snapshot(f.root)).toEqual(before)
})
it('applies with original-file backups, model bindings and ownership, then is idempotent',async()=>{
 const f=await fixture(),before=await snapshot(f.root);await run(f.report,'--apply')
 const tmdl=await fs.readFile(f.table,'utf8');expect(tmdl).toContain("measure 'Demo Sales' = SUM('Sales'[Amount])")
 expect(tmdl).toContain('annotation VilsemOwned = true');expect(tmdl).toContain('displayFolder: "Vilsem\\Demo page"')
 expect(tmdl.indexOf("measure 'Demo Sales'")).toBeLessThan(tmdl.indexOf('\tcolumn'))
 const v=JSON.parse(await fs.readFile(f.visual,'utf8')),projection=v.visual.query.queryState.content.projections[0]
 expect(projection).toMatchObject({field:{Measure:{Expression:{SourceRef:{Entity:'KPI Measures'}},Property:'Demo Sales'}},queryRef:'KPI Measures.Demo Sales',nativeQueryRef:'Demo Sales'})
 expect(projection.field).not.toHaveProperty('NativeMeasure')
 const spec=JSON.parse(v.visual.objects.semantica[0].properties.primitiveSpec.expr.Literal.Value.slice(1,-1).replaceAll("''","'"))
 expect(spec).not.toHaveProperty('measures');expect(spec.bindings.measures[0].table).toBe('KPI Measures')
 expect((await snapshot(f.root))[path.relative(f.root,f.native)]).toBe(before[path.relative(f.root,f.native)])
 const backups=await snapshot(path.join(f.root,'.vilsem-backup'))
 for(const file of [f.table,f.visual])expect(Object.entries(backups).find(([name])=>name.endsWith(path.relative(f.root,file)))?.[1]).toBe(before[path.relative(f.root,file)])
 const applied=await snapshot(f.root);expect((await run(f.report,'--apply')).stdout).toContain('Nothing to promote');expect(await snapshot(f.root)).toEqual(applied)
})
it('refuses collisions with business measures without writing anything',async()=>{
 const f=await fixture("\tmeasure 'Demo Sales' = 123\n"),before=await snapshot(f.root)
 await expect(run(f.report,'--apply')).rejects.toMatchObject({code:2})
 expect(await snapshot(f.root)).toEqual(before)
})
it('refuses a different owned expression even when it contains the proposed DAX as a substring',async()=>{
 const f=await fixture("\tmeasure 'Demo Sales' = SUM('Sales'[Amount]) * 2\n\t\tannotation VilsemOwned = true\n"),before=await snapshot(f.root)
 await expect(run(f.report,'--apply')).rejects.toMatchObject({code:2})
 expect(await snapshot(f.root)).toEqual(before)
})
it.each(["\tmeasure 'Demo Sales' = SUM('Sales'[Amount])\n\t\tannotation VilsemOwned = true\n","\tmeasure 'Demo Sales' = ```\n\t\t\tSUM('Sales'[Amount])\n\t\t\t```\n\t\tannotation VilsemOwned = true\n"])(
 'reuses an actually identical owned expression (%#)',async existing=>{
 const f=await fixture(existing),before=await fs.readFile(f.table,'utf8'),result=await run(f.report,'--apply')
 expect(result.stdout).toMatch(/New model measures:\s+0\s+reused:\s+1/)
 expect(await fs.readFile(f.table,'utf8')).toBe(before)
})
