// Offline release acceptance. The supplied install must be under a task-owned
// vilsem-090-* OS temp folder if --without-playwright is used.
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
import {localRealpath} from '../dist/paths.js'
const root=await localRealpath(process.argv[2],'verification install'),pkg=await localRealpath(path.join(root,'node_modules/vilsem-mcp'),'installed package'),require=createRequire(path.join(pkg,'package.json'))
const {Client}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js'))),{StdioClientTransport}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')))
const metadata=JSON.parse(await fs.readFile(path.join(pkg,'package.json'),'utf8')),lock=JSON.parse(await fs.readFile(path.join(pkg,'npm-shrinkwrap.json'),'utf8'))
assert.equal(metadata.version,'0.9.2');assert.equal(lock.version,'0.9.2');assert(metadata.optionalDependencies['playwright-core']);assert(lock.packages['node_modules/@vilsem/core'].integrity)
const without=process.argv.includes('--without-playwright')
if(without){
 const temp=await fs.realpath(os.tmpdir()),relative=path.relative(temp,root),owner=relative.split(path.sep)[0]
 assert(!relative.startsWith('..')&&!path.isAbsolute(relative)&&owner.startsWith('vilsem-090-'),'Refusing to modify an install outside the owned verification temp folder')
 const target=path.dirname(require.resolve('playwright-core/package.json'))
 assert(target.startsWith(root+path.sep)&&path.basename(target)==='playwright-core','Refusing an optional package outside the owned install')
 assert.equal(await localRealpath(target,'optional package'),target,'Refusing a linked optional package')
 await fs.rm(target,{recursive:true,force:true})
}
const unpack=result=>{assert(!result.isError,JSON.stringify(result));return JSON.parse(result.content.find(c=>c.type==='text').text)}
async function session(entry,online,run){
 const client=new Client({name:'packed-local-verification',version:'1'}),transport=new StdioClientTransport({command:process.execPath,args:[entry],cwd:root,stderr:'pipe',env:{...process.env,VILSEM_ENABLE_ONLINE:online,VILSEM_TEMPLATES_DIR:path.join(root,'templates'),VILSEM_SCHEMA_SAMPLES:'1'}})
 try{await client.connect(transport);return await run(client)}finally{await client.close();await transport.close()}
}
const source={kind:'fabric',workspaceId:'12345678-1234-4234-8234-123456789012',datasetId:'12345678-1234-4234-8234-123456789013'}
const real=await session(path.join(pkg,'dist/index.js'),'0',async client=>{
 const tools=await client.listTools();assert.equal(tools.tools.length,20)
 const unc=await client.callTool({name:'list_pages',arguments:{reportDir:'\\\\evil\\share\\report'}});assert(unc.isError);assert(unc.content[0].text.includes('Network paths are not allowed'))
 const fabric=await client.callTool({name:'connect_model',arguments:{source}});assert(fabric.isError);assert(fabric.content[0].text.includes('Online models (Power BI Service / Fabric) are not supported'))
 const playbook=await client.callTool({name:'get_playbook',arguments:{}});assert(!playbook.isError);assert(playbook.content[0].text.startsWith('vilsem-playbook 0.9.2'))
 return{tools:tools.tools.length,uncRejected:true,fabricRejected:true}
})
const helper=path.join(root,'mock-stdio.mjs'),serverUrl=pathToFileURL(path.join(pkg,'dist/server.js')).href,modelsUrl=pathToFileURL(path.join(pkg,'dist/models.js')).href,stdioUrl=pathToFileURL(require.resolve('@modelcontextprotocol/sdk/server/stdio.js')).href
await fs.writeFile(helper,`import {createServer} from ${JSON.stringify(serverUrl)};import {Models} from ${JSON.stringify(modelsUrl)};import {StdioServerTransport} from ${JSON.stringify(stdioUrl)};
const models=new Models({connect:async source=>({source}),schema:async()=>({tables:[{name:'T',columns:[{name:'Category',dataType:'string'}]}],measures:[{table:'Measures',name:'Sales'}]}),query:async(_connection,dax)=>dax.startsWith('EVALUATE ROW')?[{'[__rows]':5,'[c0Distinct]':2,'[c0Blanks]':0}]:dax.includes('VALUES(')?[{sample:'CONFIDENTIAL_SAMPLE'}]:[{'T[Category]':'A','[Sales]':20}]});await createServer(models).connect(new StdioServerTransport());`)
const mock=await session(helper,'0',async client=>{
 const {connectionId}=unpack(await client.callTool({name:'connect_model',arguments:{source:{kind:'desktop',port:12345}}}))
 const hidden=unpack(await client.callTool({name:'get_schema',arguments:{connectionId,samples:false}}));assert(!JSON.stringify(hidden).includes('CONFIDENTIAL_SAMPLE'));assert(!('sampleValues'in hidden.tables[0].columns[0]));assert.equal(hidden.tables[0].columns[0].cardinality,2)
 const shown=unpack(await client.callTool({name:'get_schema',arguments:{connectionId,samples:true}}));assert.deepEqual(shown.tables[0].columns[0].sampleValues,['CONFIDENTIAL_SAMPLE'])
 const preview=await client.callTool({name:'preview_visual',arguments:{connectionId,spec:{type:'bar',config:{animationEnabled:false}},bindings:{dimensions:[{table:'T',column:'Category'}],measures:[{table:'Measures',name:'Sales'}]}}});assert(!preview.isError,JSON.stringify(preview));assert(preview.content.some(c=>c.type==='image'&&c.mimeType==='image/png'))
 return{schemaSamplesHidden:true,countsPreserved:true,staticPreview:true}
})
const experimental=await session(helper,'1',async client=>{const connected=unpack(await client.callTool({name:'connect_model',arguments:{source}}));assert.equal(connected.kind,'fabric');return{experimentalFabricAcceptedByMock:true}})
const result={version:metadata.version,...real,...mock,...experimental,playwrightOptional:true,playwrightAbsent:without,coreIntegrityLocked:true,liveConnectionsTested:false}
await fs.writeFile(path.join(root,without?'verification-without-playwright.json':'verification.json'),JSON.stringify(result,null,2));process.stdout.write(JSON.stringify(result,null,2)+'\n')
