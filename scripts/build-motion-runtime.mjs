import {build}from'esbuild';
import fs from 'node:fs'
import path from 'node:path'
import {buildNotices,packageRootFromPath,asBlockComment} from './notices-lib.mjs'
const result=await build({entryPoints:['src/motionRuntime.js'],bundle:true,platform:'browser',format:'iife',globalName:'VilsemMotion',outfile:'dist/motion-runtime.js',target:'es2020',minify:true,legalComments:'eof',metafile:true});
for(const input of Object.keys(result.metafile.inputs))if(/[/\\]src[/\\]connect[/\\]|keytar|msal|node:|[/\\]electron[/\\]/i.test(input))throw Error('Connector/Node/auth code must not enter the browser renderer: '+input)

// Third-party notices for what esbuild actually bundled into the browser motion runtime.
const dirs=new Set()
for(const input of Object.keys(result.metafile.inputs)){const dir=packageRootFromPath(input);if(dir)dirs.add(path.resolve(dir))}
const notices=buildNotices([...dirs],{
 title:'Third-party notices: vilsem-mcp',
 intro:'vilsem-mcp is MIT-licensed (see LICENSE). Its browser motion runtime (dist/motion-runtime.js) bundles the third-party components below, generated from the bundler\'s own module graph. Each component remains under its own license. Runtime dependencies that npm installs separately carry their own license files; the Claude Desktop extension (.mcpb) ships a complete notices file covering everything it contains.',
 exclude:['@vilsem/core','vilsem-mcp'],
})
if(!notices.packages.some(p=>p.startsWith('echarts@')))throw Error('Expected echarts in the motion runtime; refusing to write incomplete notices')
fs.writeFileSync('THIRD_PARTY_NOTICES.md',notices.text)
// The .mcpb build merges these with everything it ships in node_modules (build/ is not published).
fs.mkdirSync('build',{recursive:true})
fs.writeFileSync('build/motion-runtime.packages.json',JSON.stringify([...dirs].sort(),null,1))
const runtime=fs.readFileSync('dist/motion-runtime.js','utf8')
fs.writeFileSync('dist/motion-runtime.js',asBlockComment(notices.text)+runtime)
console.log(`motion runtime notices: ${notices.packages.length} packages`)
