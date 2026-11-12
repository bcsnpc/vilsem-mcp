import {it,expect,vi,afterEach} from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
const connector=vi.hoisted(()=>({connect:vi.fn(async source=>({source})),query:vi.fn(),schema:vi.fn()}))
const factory=vi.hoisted(()=>vi.fn(()=>connector))
vi.mock('@vilsem/core/connect',()=>({createConnector:factory}))
import {Models,ONLINE_DISABLED} from '../src/models.js'
const dirs:string[]=[]
afterEach(async()=>{vi.unstubAllEnvs();vi.clearAllMocks();for(const dir of dirs.splice(0))await fs.rm(dir,{recursive:true,force:true})})
async function report(ref:any){const root=await fs.mkdtemp(path.join(os.tmpdir(),'vilsem-online-'));dirs.push(root);await fs.mkdir(path.join(root,'model'));await fs.writeFile(path.join(root,'definition.pbir'),JSON.stringify({datasetReference:ref}));return root}
it('blocks Fabric and SSAS/byConnection before even constructing the core connector or invoking auth',async()=>{
 vi.stubEnv('VILSEM_ENABLE_ONLINE','')
 const models=new Models()
 await expect(models.connect({kind:'fabric',workspaceId:'id',datasetId:'id'})).rejects.toThrow(ONLINE_DISABLED)
 for(const endpoint of ['powerbi://api.powerbi.com/v1.0/myorg/workspace','fake-ssas']){
  const root=await report({byConnection:{connectionString:`Data Source=${endpoint};Initial Catalog=Model`}})
  await expect(models.connect({kind:'report',reportDir:root})).rejects.toThrow(ONLINE_DISABLED)
 }
 expect(factory).not.toHaveBeenCalled();expect(connector.connect).not.toHaveBeenCalled()
})
it('preserves local Desktop/byPath and permits online only with the exact experimental opt-in',async()=>{
 vi.stubEnv('VILSEM_ENABLE_ONLINE','0');const models=new Models()
 await models.connect({kind:'desktop',port:12345})
 await models.connect({kind:'report',reportDir:await report({byPath:{path:'model'}})})
 expect(connector.connect).toHaveBeenCalledTimes(2)
 vi.stubEnv('VILSEM_ENABLE_ONLINE','true');await expect(models.connect({kind:'fabric',workspaceId:'id',datasetId:'id'})).rejects.toThrow(ONLINE_DISABLED)
 vi.stubEnv('VILSEM_ENABLE_ONLINE','1')
 await models.connect({kind:'fabric',workspaceId:'id',datasetId:'id'})
 await models.connect({kind:'report',reportDir:await report({byConnection:{connectionString:'fake'}})})
 expect(connector.connect).toHaveBeenCalledTimes(4)
})
it('still refuses network model paths inside a local report before the core connector',async()=>{
 const root=await report({byPath:{path:'\\\\evil\\share\\model'}})
 await expect(new Models().connect({kind:'report',reportDir:root})).rejects.toThrow('Network paths are not allowed')
 expect(factory).not.toHaveBeenCalled()
})
