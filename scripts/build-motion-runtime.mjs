import {build}from'esbuild';
const result=await build({entryPoints:['src/motionRuntime.js'],bundle:true,platform:'browser',format:'iife',globalName:'VilsemMotion',outfile:'dist/motion-runtime.js',target:'es2020',minify:true,legalComments:'eof',metafile:true});
for(const input of Object.keys(result.metafile.inputs))if(/[/\\]src[/\\]connect[/\\]|keytar|msal|node:|[/\\]electron[/\\]/i.test(input))throw Error('Connector/Node/auth code must not enter the browser renderer: '+input)
