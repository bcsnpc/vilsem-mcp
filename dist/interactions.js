/** Capability assessment, not a simulated Power BI host or certification. */
import { collectTimelineSeries } from '@vilsem/core/templates';
export function assessInteractions(spec, option, rowCount) {
    const series = collectTimelineSeries(option ?? {});
    const active = series.filter(s => !s.silent && Array.isArray(s.data) && s.data.length);
    const warnings = [];
    const aggregate = active.some(s => s.data.some(d => Array.isArray(d?.rowIndexes) && d.rowIndexes.length > 1));
    if (aggregate)
        warnings.push('Aggregate marks select their contributing rows on click, but the current native context menu uses one source identity. Whole-group drill-through is not verified; do not assume it represents the entire aggregate.');
    if (spec.template?.transforms?.some(t => t.density2d?.contourFractions))
        warnings.push('Contour selection refers to local sampled-kernel contributors, not every entity inside a contour or a confidence region.');
    let selectable = active.length > 0;
    if (!selectable)
        warnings.push('No interactive data marks: graphics-only or silent series cannot select report rows.');
    if (active.some(s => s.type === 'radar'))
        warnings.push('Radar uses indicator hover for point identity; per-point polygon dimming is not supported.');
    if (spec.template?.transforms?.length && active.some(s => s.data.some(d => d && typeof d === 'object' && !Array.isArray(d) && !Array.isArray(d.rowIndexes))))
        warnings.push('Transformed marks without rowIndexes may have incomplete source identity mapping; test selection with the native host.');
    if (!rowCount) {
        selectable = false;
        warnings.push('The query is empty. Selection cannot be exercised until the visual has rows.');
    }
    return {
        assessment: 'Declared/runtime capabilities only; this SSR preview does not verify Power BI host interactions.',
        selection: selectable ? 'supported' : 'unavailable', multiSelection: selectable ? 'Ctrl/Command-click or keyboard modifier' : 'unavailable',
        crossFilterOut: selectable ? 'supported; report interaction settings control targets' : 'unavailable',
        crossHighlightIn: active.some(s => s.type === 'radar') ? 'limited' : 'supported for data marks',
        nativeTooltip: selectable ? 'supported; report-page tooltips require report configuration' : 'unavailable',
        contextMenu: selectable ? (aggregate ? 'available for one source identity; whole-group drill-through unverified' : 'supported; drill-through requires a configured destination') : 'unavailable',
        bookmarks: selectable ? 'host selection callback supported; bookmark must capture Data state' : 'no selectable data marks',
        keyboard: selectable ? 'Tab to focus; arrows choose, Enter/Space select, Escape clears' : 'focusable empty state',
        filteredEmpty: 'explicit empty state', resize: 'uses host-supplied dataView; no query from renderer', warnings,
    };
}
