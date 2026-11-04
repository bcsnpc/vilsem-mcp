// A native rasterizer failure must never terminate the MCP server process.
const fs = require('node:fs')
const { Resvg } = require('@resvg/resvg-js')
const { svg, background } = JSON.parse(fs.readFileSync(0,'utf8'))
process.stdout.write(new Resvg(svg,{background}).render().asPng())
