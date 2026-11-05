import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { RENDERER_GUID, validateVisualContainer } from '@vilsem/core/pbir';
import { migrate } from '@vilsem/core/spec/migrate';
import { PANE_GROUPS } from '@vilsem/core/formatting/pane';
import { listPages, validateSpec } from './reports.js';
const { applyPatch, compare } = createRequire(import.meta.url)('fast-json-patch');
const parse = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const segment = (value) => { if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value))
    throw Error('Use an internal PBIR page/visual folder name from list_visuals'); return value; };
export async function readStoredVisual(reportDir, pageName, visualName) {
    const root = await fs.realpath(reportDir);
    const file = await fs.realpath(path.join(root, 'definition', 'pages', segment(pageName), 'visuals', segment(visualName), 'visual.json'));
    const relative = path.relative(root, file);
    if (relative.startsWith('..' + path.sep) || path.isAbsolute(relative))
        throw Error('Visual resolves outside the report');
    const bytes = await fs.readFile(file), value = parse(bytes);
    if (value.visual?.visualType !== RENDERER_GUID)
        throw Error('Only vilsem Renderer visuals can be read or edited; native visuals are outside MCP scope');
    const literal = value.visual.objects?.semantica?.[0]?.properties?.primitiveSpec?.expr?.Literal?.Value;
    if (typeof literal !== 'string' || !literal.startsWith("'") || !literal.endsWith("'"))
        throw Error('Visual has an unreadable primitiveSpec literal');
    const storedSpec = JSON.parse(literal.slice(1, -1).replace(/''/g, "'")), spec = migrate(storedSpec);
    validateSpec(spec);
    const dimensions = [], measures = [], warnings = [];
    const query = value.visual.query?.queryState || {};
    for (const role of ['category', 'category2', 'category3', 'category4', 'category5', 'category6'])
        for (const p of query[role]?.projections || []) {
            const c = p.field?.Column;
            if (c)
                dimensions.push({ table: c.Expression?.SourceRef?.Entity, column: c.Property });
            else
                throw Error(`Unsupported custom-visual category binding in role ${role}; not safe to reconstruct`);
        }
    for (const role of ['content', 'secondary', 'tertiary', 'quaternary', 'quinary', 'senary'])
        for (const p of query[role]?.projections || []) {
            const m = p.field?.Measure, n = p.field?.NativeMeasure;
            if (m)
                measures.push({ table: m.Expression?.SourceRef?.Entity, name: m.Property });
            else if (n) {
                const name = n.ProposedName || p.nativeQueryRef, metadata = spec.bindings?.measures?.find(m => m.name === name);
                measures.push({ table: typeof metadata?.table === 'string' ? metadata.table : null, name, inline: true, formatString: n.Format });
                if (!metadata?.table)
                    warnings.push(`Inline measure ${name} has no original home-table metadata in legacy PBIR; preview may use an explicit temporary namespace. Stored query remains unchanged for formatting-only edits.`);
            }
            else
                throw Error(`Unsupported custom-visual measure binding in role ${role}; not safe to reconstruct`);
        }
    const formatPaneOverrides = structuredClone(value.visual.objects || {});
    delete formatPaneOverrides.semantica;
    return { file, bytes, value, spec, storedSpec, bindings: { dimensions, measures }, layout: value.position, formatPaneOverrides, specVersion: spec.specVersion, sourceSpecVersion: storedSpec.specVersion ?? '0.1', warnings, etag: crypto.createHash('sha256').update(bytes).digest('hex'), lastModified: (await fs.stat(file)).mtime.toISOString() };
}
export function patchVisualSpec(spec, patch) {
    if (!Array.isArray(patch) || !patch.length || patch.length > 200)
        throw Error('patch requires1..200 RFC6902 operations');
    for (const op of patch) {
        for (const key of ['path', 'from'])
            if (op[key] != null) {
                if (typeof op[key] !== 'string' || !op[key].startsWith('/'))
                    throw Error('Patch paths must address spec fields; whole-document replacement is not allowed');
                const parts = op[key].slice(1).split('/').map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
                if (parts.some(p => ['__proto__', 'prototype', 'constructor', 'visualType', 'guid', 'rendererGuid', 'specVersion'].includes(p)))
                    throw Error(`Patch cannot change renderer identity, version or prototype paths: ${op[key]}`);
            }
    }
    const next = applyPatch(structuredClone(spec), patch, true, false, true).newDocument;
    if (next.visualType !== spec.visualType || next.guid !== spec.guid || next.rendererGuid !== spec.rendererGuid)
        throw Error('Patch cannot change the renderer identity');
    validateSpec(next);
    return migrate(next);
}
export const specDiff = (before, after) => compare(before, after);
// The report folder, rather than a separate manifest, is the source of truth.
export async function listStoredVisuals(reportDir) {
    const result = [];
    for (const page of await listPages(reportDir))
        for (const visual of page.visuals) {
            if (visual.type !== RENDERER_GUID)
                continue;
            try {
                const item = await readStoredVisual(reportDir, page.name, visual.name);
                const t = item.spec.template, layer = t ? (JSON.stringify(t.template).includes('"language":"vilsem-expression"') ? 'expression' : 'template') : 'composition';
                const family = t?.meta?.name || t?.meta?.id || item.spec.type;
                result.push({ page: page.name, pageName: page.displayName, name: visual.name, layer, summary: `${family}: ${item.bindings.dimensions.map(d => d.column).join(' → ') || 'KPI'} by ${item.bindings.measures.map(m => m.name).join(', ')}`, bindings: item.bindings, lastModified: item.lastModified, specVersion: item.specVersion, layout: item.layout, warnings: item.warnings });
            }
            catch (error) {
                result.push({ page: page.name, name: visual.name, readable: false, error: error.message });
            }
        }
    return result;
}
/** Change exactly one existing custom visual. A lock serializes this tool's
 * writers; etag checks detect a Desktop save during preview. Desktop does not
 * honor this lock, so keep the final compare/rename window minimal. */
export async function writeStoredVisual(item, spec, { resetFormatting = false, queryState } = {}) {
    validateSpec(spec);
    const next = structuredClone(item.value);
    if (next.visual.visualType !== RENDERER_GUID)
        throw Error('Renderer identity mismatch');
    if (resetFormatting)
        for (const { name } of PANE_GROUPS)
            delete next.visual.objects[name];
    const literal = next.visual.objects.semantica[0].properties.primitiveSpec.expr.Literal;
    literal.Value = `'${JSON.stringify(migrate(spec)).replace(/'/g, "''")}'`;
    if (queryState)
        next.visual.query = { ...next.visual.query, queryState };
    await validateVisualContainer(next);
    const lockFile = item.file + '.vilsem-lock', temp = item.file + `.vilsem-${crypto.randomUUID()}.tmp`;
    const lock = await fs.open(lockFile, 'wx').catch(error => { if (error.code === 'EEXIST')
        throw Error('Visual is being edited by another MCP call; retry after it finishes'); throw error; });
    try {
        if (!(await fs.readFile(item.file)).equals(item.bytes))
            throw Error('Visual changed since it was read; read_visual again before retrying');
        await fs.writeFile(temp, JSON.stringify(next, null, 2) + '\n', { flag: 'wx' });
        if (!(await fs.readFile(item.file)).equals(item.bytes))
            throw Error('Visual changed during update; retry after Desktop finishes saving');
        await fs.rename(temp, item.file);
    }
    finally {
        await lock.close();
        await fs.rm(lockFile, { force: true });
        await fs.rm(temp, { force: true });
    }
    return { path: item.file, formattingPreserved: !resetFormatting, etag: crypto.createHash('sha256').update(await fs.readFile(item.file)).digest('hex') };
}
