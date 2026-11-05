import { assessInteractions } from './interactions.js';
const list = (v) => v == null ? [] : Array.isArray(v) ? v : [v];
const overlap = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
function rgb(value) {
    if (typeof value !== 'string')
        return null;
    const hex = value.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (hex) {
        const h = hex[1].length === 3 ? [...hex[1]].map(c => c + c).join('') : hex[1];
        return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    }
    const r = value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);
    return r && (!r[4] || Number(r[4]) === 1) ? r.slice(1, 4).map(Number).map(n => n / 255) : null;
}
const luminance = (v) => v.map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((n, x, i) => n + x * [.2126, .7152, .0722][i], 0);
/** Measure the same display list serialized by ECharts' SVG renderer. This is
 * an adapter for the pinned ECharts version, not a general SVG layout engine. */
export function renderedText(chart, option) {
    const axes = ['xAxis', 'yAxis'].flatMap(key => list(option[key]).map((a, i) => ({ key, i, a })));
    const legends = [];
    chart.getModel().eachComponent('legend', model => { const group = chart.getViewOfComponentModel(model)?.group; if (!group)
        return; const rect = group.getBoundingRect().clone(), matrix = group.getComputedTransform(); if (matrix)
        rect.applyTransform(matrix); legends.push(rect); });
    return chart.getZr().storage.getDisplayList().filter(d => d.type === 'tspan' && !d.invisible && !d.ignore && d.style?.text != null).slice(0, 3000).map(d => {
        const rect = d.getBoundingRect().clone();
        const matrix = d.getComputedTransform();
        if (matrix)
            rect.applyTransform(matrix);
        const text = String(d.style.text);
        const axis = axes.find(({ a }) => list(a.data).some(v => String(v?.value ?? v) === text));
        const legend = legends.some(l => rect.x >= l.x - 1 && rect.y >= l.y - 1 && rect.x + rect.width <= l.x + l.width + 1 && rect.y + rect.height <= l.y + l.height + 1);
        return { ...rect, text, fill: d.style.fill, fontSize: d.style.fontSize || rect.height, path: axis ? `/template/template/${axis.key}/${axis.i}/axisLabel` : legend ? '/template/template/legend' : '/template/template/series' };
    });
}
export function renderedPlots(chart) {
    const plots = [];
    chart.getModel().eachComponent('grid', component => { const r = component.coordinateSystem?.getRect?.(); if (r)
        plots.push({ x: r.x, y: r.y, width: r.width, height: r.height }); });
    return plots;
}
export function critiqueVisual(spec, option, rows, width, height, geometry = [], context = {}) {
    const findings = [];
    const add = (code, path, message, suggestedFix, evidence, severity = 'warning') => {
        if (!spec.template) {
            if (['all-null', 'all-zero'].includes(code))
                path = '/bindings/measures';
            else if (code === 'pie-slices')
                path = '/type';
            else if (code === 'categorical-colors')
                path = '/formatting/seriesColors/palette';
            else if (code === 'axis-rotation')
                path = '/config/' + (path.includes('xAxis') ? 'xAxis' : 'yAxis') + 'LabelRotation';
            else if (code === 'dual-axis')
                path = '/config/secondaryAxisEnabled';
            else if (code === 'legend-over-data')
                path = '/formatting/legend/position';
            else if (path.startsWith('/template/template'))
                path = path.includes('Axis') ? '/formatting/categoryAxis/fontSize' : '/formatting/labels/fontSize';
        }
        findings.push({ code, severity, path, message, suggestedFix, ...(evidence === undefined ? {} : { evidence }) });
    };
    const series = list(option.series), base = spec.template ? '/template/template' : '/config';
    const timeline = list(option.baseOption?.timeline ?? option.timeline)[0], steps = Array.isArray(option.options) ? option.options.length : list(timeline?.data).length;
    if (steps > 60)
        add('timeline-steps', '/template/template/options', 'Timeline has more than60 states.', 'Aggregate the time grain or filter to at most60 states.', { steps });
    const definition = spec.template?.animation, duration = Math.max(definition?.enter?.duration ?? option.animationDuration ?? 0, definition?.update?.duration ?? option.animationDurationUpdate ?? 0);
    if (duration > 3000 || steps > 1 && (timeline?.playInterval ?? 1000) * steps > 3000)
        add('animation-duration', '/template/animation', 'Motion sequence exceeds the3-second preview duration.', 'Shorten durations or inspect selected states and the live animation.', { durationMs: Math.max(duration, steps > 1 ? (timeline?.playInterval ?? 1000) * steps : 0) });
    const values = (s) => list(s.data).map(d => d && typeof d === 'object' && !Array.isArray(d) && Object.hasOwn(d, 'value') ? d.value : d).flatMap(v => Array.isArray(v) ? v.slice(-1) : [v]);
    for (const [i, s] of series.entries()) {
        const p = `${base}/series/${i}`, v = values(s);
        if (v.length && v.every(v => v == null || v === '-' || typeof v === 'number' && !Number.isFinite(v)))
            add('all-null', p + '/data', 'Series has no finite values.', 'Check bindings, filters and BLANK handling.');
        if (v.length && v.every(v => v === 0))
            add('all-zero', p + '/data', 'Every series value is zero.', 'Confirm zero is meaningful; avoid implying variation.');
        if (s.type === 'pie' && list(s.data).length > 7)
            add('pie-slices', p, 'Pie/donut contains more than seven slices.', 'Use a sorted bar or a disclosed top-N plus Other transform.', { slices: s.data.length });
        const colors = new Set(list(s.data).map(d => d?.itemStyle?.color).filter(c => typeof c === 'string'));
        if (colors.size > 12)
            add('categorical-colors', p + '/data', 'More than twelve distinct mark colours.', 'Reduce categorical colour roles; use position and direct labels.', { colors: colors.size });
    }
    const colorCount = Math.min(new Set(list(option.color)).size, Math.max(series.length, ...series.filter(s => s.colorBy === 'data' || ['pie', 'sankey', 'graph', 'treemap', 'sunburst', 'funnel'].includes(s.type)).map(s => list(s.data).length)));
    if (colorCount > 12)
        add('categorical-colors', base + '/color', 'More than twelve palette colours may be used for categorical marks.', 'Reduce the categorical palette; sequential scales are a separate encoding.', { colors: colorCount });
    for (const key of ['xAxis', 'yAxis'])
        for (const [i, a] of list(option[key]).entries())
            if (Math.abs(Number(a.axisLabel?.rotate) || 0) > 45)
                add('axis-rotation', `${base}/${key}/${i}/axisLabel/rotate`, 'Axis labels rotate beyond 45 degrees.', 'Use horizontal bars, wrapping, fewer ticks or a wider plot.');
    if (list(option.yAxis).length > 1) {
        const formats = context.measures?.map(m => m.formatString).filter(Boolean) || [];
        add('dual-axis', base + '/yAxis', 'Independent axes can imply a relationship between unrelated scales.', 'Confirm units and business relationship; prefer aligned small multiples when unrelated.', { formats }, 'info');
    }
    for (const [name, slot] of Object.entries(spec.template?.slots || {}))
        if (slot.required !== false && !rows.length)
            add('empty-slot', `/template/slots/${name}`, 'Required slot has no queried rows.', 'Check fields, filter context and query coverage before committing.');
    for (const [i, m] of (context.measures || []).entries())
        if (!m.formatString && !spec.measures?.[m.name]?.format)
            add('missing-format', `/bindings/measures/${i}`, 'Bound numeric measure has no model or visual-scoped format.', 'Choose an explicit unit/format; the automatic fallback may not convey business meaning.', { name: m.name });
    let collisions = 0;
    for (let i = 0; i < geometry.length; i++) {
        const a = geometry[i];
        if (a.x < -.5 || a.y < -.5 || a.x + a.width > width + .5 || a.y + a.height > height + .5)
            add('clipped-label', a.path, 'Rendered text extends beyond the visual viewport.', 'Increase plot margins/container size, wrap text or reduce label size.', { text: a.text, bounds: { x: a.x, y: a.y, width: a.width, height: a.height } });
        if (/…|\.\.\.$/.test(a.text))
            add('truncated-category', a.path, 'Rendered text uses an ellipsis.', 'Provide the full name in a tooltip; widen, wrap or switch orientation.', { text: a.text }, 'info');
        const fg = rgb(a.fill), bg = rgb(context.background);
        if (fg && bg) {
            const l = [luminance(fg), luminance(bg)].sort((a, b) => a - b), ratio = (l[1] + .05) / (l[0] + .05), threshold = (a.fontSize ?? a.height) >= 24 ? 3 : 4.5;
            if (ratio < threshold)
                add('text-contrast', a.path, 'Text has low contrast against the preview background.', 'Use a higher-contrast foreground; labels on filled marks need a separate mark-background check.', { text: a.text, ratio: Number(ratio.toFixed(2)), threshold });
        }
        for (let j = i + 1; j < geometry.length && collisions < 30; j++)
            if (overlap(a, geometry[j])) {
                collisions++;
                add('overlapping-labels', a.path, 'Two rendered text bounds overlap.', 'Increase spacing, hide overlapping ticks or reposition labels.', { texts: [a.text, geometry[j].text] });
            }
    }
    // Legend placement must be evaluated against actual plot bounds, not a
    // guessed default grid. Only flag a grid with explicit numeric geometry.
    for (const [i, l] of list(option.legend).entries())
        if (l.show !== false) {
            const labels = geometry.filter(t => t.path.endsWith('/legend'));
            const plots = context.plotBounds || list(option.grid).filter(g => [g.left, g.top, g.width, g.height].every(Number.isFinite)).map(g => ({ x: g.left, y: g.top, width: g.width, height: g.height }));
            if (plots.some(grid => labels.some(t => overlap(t, grid))))
                add('legend-over-data', `${base}/legend/${i}`, 'Legend label bounds intersect the rendered plot area.', 'Reserve space outside the plot or move the legend.');
        }
    return { findings, interactions: assessInteractions(spec, option, rows.length), coverage: { textBounds: geometry.length, source: 'Resolved option and ECharts SVG display-list geometry', limitations: ['Text bounds are conservative; intentional rich-text/graphic overlaps require inspection.', 'Text contrast uses the page background; filled-mark backgrounds need manual review.', 'Dual-axis findings request analytical review rather than proving unrelated data.', 'No Power BI host interaction is exercised by SSR.'] } };
}
