#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './server.js'
// Model adapters log diagnostics; stdout belongs exclusively to MCP JSON-RPC.
console.log=(...args)=>console.error(...args)
await createServer().connect(new StdioServerTransport())
