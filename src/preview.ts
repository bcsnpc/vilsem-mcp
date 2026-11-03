import { createRequire } from 'node:module'
const echarts = createRequire(import.meta.url)('echarts')
import { Resvg } from '@resvg/resvg-js'
import { resolveVisualSpec } from '@vilsem/core/spec/resolve'
import { getThemeTokens } from '@vilsem/core/theme'

export function previewRows(spec: any, rows: any[], width = 800, height = 500) {
  const option = resolveVisualSpec(spec, rows)
  const chart = echarts.init(null, undefined, {renderer:'svg', ssr:true, width, height})
  try {
    chart.setOption({...option, animation:false})
    const svg = chart.renderToSVGString()
    const png = new Resvg(svg,{background:getThemeTokens(spec.canvasTheme==='light'?'light':'dark').canvasBg}).render().asPng()
    return { option, svg, png }
  } finally {
    chart.dispose()
  }
}
