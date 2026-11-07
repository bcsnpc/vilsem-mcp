#!/usr/bin/env node
// CLI commands exit without importing the server or writing JSON-RPC to stdout.
if(process.argv.length>2){
 try{const {runCli}=await import('./skill-cli.js');await runCli(process.argv.slice(2))}
 catch(error){console.error((error as Error).message);process.exitCode=1}
}else{
 // Model adapters log diagnostics; stdout belongs exclusively to MCP JSON-RPC.
 console.log=(...args)=>console.error(...args)
 const {StdioServerTransport}=await import('@modelcontextprotocol/sdk/server/stdio.js')
 const {createServer}=await import('./server.js')
 await createServer().connect(new StdioServerTransport())
}
