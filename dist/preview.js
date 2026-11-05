import { createRequire } from 'node:module';
const echarts = createRequire(import.meta.url)('echarts');
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveVisualSpec } from '@vilsem/core/spec/resolve';
import { resolveReportTheme } from '@vilsem/core/theme/report';
import { renderedText, renderedPlots, critiqueVisual } from './critique.js';
import { applyPaneFormatting, effectivePaneObjects } from '@vilsem/core/formatting/pane';
export function rasterizeSvg(svg, background = 'white') {
    const raster = spawnSync(process.execPath, [fileURLToPath(new URL('./rasterize.cjs', import.meta.url))], { input: JSON.stringify({ svg, background }), windowsHide: true, timeout: 30000, maxBuffer: 16 * 1024 * 1024 });
    if (raster.error || raster.status !== 0)
        throw Error(`PNG rasterization failed in an isolated worker (${raster.error?.message || raster.signal || raster.status}); the MCP server is still available. Check chart domains and clipping, then retry.`);
    return raster.stdout;
}
export function variantSheet(variants, width, height) {
    if (!variants.length || variants.length > 4)
        throw Error('A comparison requires1..4 variants');
    const escape = (v) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
    const cols = variants.length === 1 ? 1 : 2, rows = Math.ceil(variants.length / cols), header = 36;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * width}" height="${rows * (height + header)}"><rect width="100%" height="100%" fill="white"/>${variants.map((v, i) => { const x = i % cols * width, y = Math.floor(i / cols) * (height + header); return `<text x="${x + 12}" y="${y + 24}" font-family="Segoe UI" font-size="16" fill="#222">${escape(v.label.slice(0, 80))}</text><image x="${x}" y="${y + header}" width="${width}" height="${height}" href="data:image/png;base64,${v.png.toString('base64')}"/>`; }).join('')}</svg>`;
    return rasterizeSvg(svg);
}
export function previewRows(spec, rows, width = 800, height = 500, context = {}) {
    const pane = effectivePaneObjects(spec, context.formatPaneOverrides);
    context = { ...context, useReportTheme: pane.appearance?.useReportTheme ?? context.useReportTheme };
    const option = applyPaneFormatting(resolveVisualSpec(spec, rows, { ...context, width, measureText: (text, font) => echarts.format.getTextRect(text, font).width }), pane, { locale: context.locale, width, height });
    const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width, height });
    try {
        chart.setOption({ ...option, animation: false });
        const svg = chart.renderToSVGString();
        const background = resolveReportTheme(spec, context).background;
        const png = rasterizeSvg(svg, background);
        const critique = context.critique === false ? undefined : critiqueVisual(spec, option, rows, width, height, renderedText(chart, option), { ...context, background, plotBounds: renderedPlots(chart) });
        return { option, svg, png, critique };
    }
    finally {
        chart.dispose();
    }
}
