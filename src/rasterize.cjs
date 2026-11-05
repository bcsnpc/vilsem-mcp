// A native rasterizer failure must never terminate the MCP server process.
const fs = require('node:fs')
const { Resvg } = require('@resvg/resvg-js')
// resvg-js does not consistently consume the font shorthand emitted by
// ECharts. Expand only its known pixel-font grammar; preserve all other CSS.
function expandFontShorthand(svg) {
  return svg.replace(/\bstyle="([^"]*)"/g,(_,style)=>`style="${style.replace(/\bfont:\s*((?:(?:normal|italic|oblique|small-caps|bold|bolder|lighter|[1-9]00)\s+)*)(\d+(?:\.\d+)?)px\s+([^;\r\n]+)(?=;|$)/g,
    (_,prefix,size,family)=>{
      const tokens=prefix.trim().split(/\s+/)
      const weight=tokens.find(t=>/^(bold|bolder|lighter|[1-9]00)$/.test(t)) || 'normal'
      const style=tokens.find(t=>/^(italic|oblique)$/.test(t)) || 'normal'
      const variant=tokens.includes('small-caps')?'small-caps':'normal'
      return `font-family:${family};font-size:${size}px;font-weight:${weight};font-style:${style};font-variant:${variant}`
    })}"`)
}
module.exports={expandFontShorthand}
if(require.main===module) {
  const { svg, background } = JSON.parse(fs.readFileSync(0,'utf8'))
  process.stdout.write(new Resvg(expandFontShorthand(svg),{background}).render().asPng())
}
