import fs from 'node:fs/promises'
import path from 'node:path'

export function assertLocalPath(value:string,label='path'){
 const normalized=value.trim().replace(/\\/g,'/')
 const localExtended=/^\/\/\?\/[a-z]:\//i.test(normalized)
 if((normalized.startsWith('//')&&!localExtended)||/^\/\?\?\//.test(normalized)||/^[a-z][a-z0-9+.-]*:/i.test(normalized)&&!/^([a-z]:)/i.test(normalized))throw Error(`Network paths are not allowed (${label}). Use a local drive path such as C:\\Reports\\…`)
 return value
}
// Inspect link targets before following them, then validate realpath as well.
// This also handles a non-existent local write target through its existing parents.
export async function assertLocalLinks(value:string,label='path',depth=0):Promise<void>{
 assertLocalPath(value,label)
 if(depth>40)throw Error(`Too many linked paths (${label})`)
 const absolute=path.resolve(value),root=path.parse(absolute).root
 let current=root
 for(const segment of absolute.slice(root.length).split(path.sep).filter(Boolean)){
  current=path.join(current,segment)
  let stat
  try{stat=await fs.lstat(current)}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error}
  if(stat.isSymbolicLink()){
   const target=await fs.readlink(current);assertLocalPath(target,label)
   await assertLocalLinks(path.resolve(path.dirname(current),target),label,depth+1)
  }
 }
}
export async function localRealpath(value:string,label='path'){
 await assertLocalLinks(value,label)
 return assertLocalPath(await fs.realpath(value),label)
}
export function safeEnvironmentPath(value:string|undefined,label:string){
 if(!value)return undefined
 try{return assertLocalPath(value,label)}catch{return undefined}
}
export async function checkPathEnvironment(env:NodeJS.ProcessEnv=process.env,warn=(message:string)=>console.error(message)){
 for(const key of ['VILSEM_TEMPLATES_DIR','VILSEM_PREVIEW_BROWSER_PATH'])if(env[key]){
  try{await assertLocalLinks(env[key]!,key);try{await localRealpath(env[key]!,key)}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}}
  catch{warn(`Ignoring ${key}: network paths are not allowed. Use a local drive path.`);delete env[key]}
 }
}
export async function validateInputPaths(args:{reportDir?:string,source?:{kind?:string,reportDir?:string},reference_image?:string,image?:string}){
 const paths:[[string|undefined,string],[string|undefined,string]]=[[args.reportDir,'reportDir'],[args.source?.reportDir,'source.reportDir']]
 for(const key of ['reference_image','image'] as const){const value=args[key];if(value&&!/^data:|^(?:iVBORw0KGgo|\/9j\/)[A-Za-z0-9+/=\r\n]+$/i.test(value))paths.push([value,key])}
 // Reject every supplied network path before performing any filesystem work.
 for(const [value,label]of paths)if(value!==undefined)assertLocalPath(value,label)
 for(const [value,label]of paths)if(value!==undefined)await localRealpath(value,label)
}
