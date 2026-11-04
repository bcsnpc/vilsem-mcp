import { createRequire } from 'node:module'
const echarts = createRequire(import.meta.url)('echarts')
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolveVisualSpec } from '@vilsem/core/spec/resolve'
import { getThemeTokens } from '@vilsem/core/theme'

export function previewRows(spec: any, rows: any[], width = 800, height = 500) {
  const option = resolveVisualSpec(spec, rows)
  const chart = echarts.init(null, undefined, {renderer:'svg', ssr:true, width, height})
  try {
    chart.setOption({...option, animation:false})
    const svg = chart.renderToSVGString()
    const raster = spawnSync(process.execPath,[fileURLToPath(new URL('./rasterize.cjs',import.meta.url))],{
      input:JSON.stringify({svg,background:getThemeTokens(spec.canvasTheme==='light'?'light':'dark').canvasBg}),
      windowsHide:true,timeout:30000,maxBuffer:16*1024*1024,
    })
    if(raster.error || raster.status!==0)throw Error(`PNG rasterization failed in an isolated worker (${raster.error?.message || raster.signal || raster.status}); the MCP server is still available. Check chart domains and clipping, then retry.`)
    const png=raster.stdout
    return { option, svg, png }
  } finally {
    chart.dispose()
  }
}
