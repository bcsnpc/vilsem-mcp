import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import {SHIPPED_SPECS} from '../dist/templates.js'
import {previewRows} from '../dist/preview.js'
import {fixtureRows} from '../tests/fixtures/visualRows.js'

const theme=process.argv.includes('--dark')?'dark':'light'
const folder=new URL(`../templates/thumbnails/${theme}/`,import.meta.url)
await fs.mkdir(folder,{recursive:true})
const manifest={theme,dataSource:'Deterministic synthetic regression fixtures, not model/client data',width:900,height:600,items:[]}
for(const spec of SHIPPED_SPECS){
 const id=spec.template.meta.id
 if(!/^[a-zA-Z0-9_-]+$/.test(id))throw Error('Invalid shipped template ID')
 try{
  // Render the authored design, including intentional reference backdrops.
  // Default transparency is a core contract test, not a ban on explicit fills.
  const {png,option}=previewRows(spec,fixtureRows(spec),900,600,{theme,sampleMotion:false})
  await fs.writeFile(new URL(`${id}.png`,folder),png)
  manifest.items.push({id,status:'rendered',backgroundColor:option.backgroundColor,sha256:crypto.createHash('sha256').update(png).digest('hex'),specSha256:crypto.createHash('sha256').update(JSON.stringify(spec)).digest('hex')})
 }catch(error){manifest.items.push({id,status:'failed',error:error.message});process.exitCode=1}
 await fs.writeFile(new URL('manifest.json',folder),JSON.stringify(manifest,null,2)+'\n')
 console.log(id,manifest.items.at(-1).status)
}
console.log(`${theme}: ${manifest.items.filter(i=>i.status==='rendered').length}/${SHIPPED_SPECS.length}`)
