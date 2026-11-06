import { EXPRESSION_LIMITS } from '@vilsem/core/expressions';
// Feedback must distinguish a static viewport backdrop from measured marks.
// Be conservative: data-dependent or repeated annotation series still count.
export function isStaticDecoration(series) {
    const ast = typeof series?.renderItem === 'function' ? series.renderItem.vilsemExpression?.ast : series?.renderItem;
    const root = ast?.root;
    if (series?.type !== 'custom' || series.coordinateSystem !== 'none' || series.silent !== true || series.data?.length !== 1 || ast?.language !== 'vilsem-expression' || root?.role !== 'annotation' || root.silent !== true || !['rect', 'circle', 'polygon', 'polyline', 'path'].includes(root.type))
        return false;
    const pending = [root];
    let visited = 0;
    while (pending.length) {
        if (++visited > EXPRESSION_LIMITS.nodes)
            return false;
        const node = pending.pop();
        if (!node || typeof node !== 'object')
            continue;
        if (['value', 'dataIndex', 'coord', 'size', 'visual', 'style'].includes(node.op))
            return false;
        pending.push(...Object.values(node));
    }
    return true;
}
