import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'node:fs/promises';
import { EXAMPLE_TEMPLATES } from '@vilsem/core/templates/examples';
import { buildVisualDax, normaliseRows, normaliseTableRows, resolveRowKey } from '@vilsem/core/dax';
import { Models } from './models.js';
import { listPages, validateVisuals, validateSpec, validateBindings, commitVisual } from './reports.js';
import { previewRows } from './preview.js';
const object = z.record(z.string(), z.unknown());
const bindings = z.object({ dimensions: z.array(z.object({ table: z.string().min(1), column: z.string().min(1) })).max(6).default([]), measures: z.array(z.object({ table: z.string().min(1), name: z.string().min(1) })).min(1).max(3) });
const text = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, (_key, value) => typeof value === 'function' ? '[formatter]' : value) }] });
export function createServer(models = new Models()) {
    const server = new McpServer({ name: 'vilsem-mcp', version: '0.2.2' });
    const tool = (name, description, schema, handler) => server.registerTool(name, { description, inputSchema: schema.shape }, async (args) => {
        try {
            return await handler(args);
        }
        catch (error) {
            return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
    });
    tool('connect_model', 'Connect to an existing local Power BI Desktop model or a Fabric semantic model using Vilsem’s existing query and authentication adapters. This does not create or change the model. Keep the returned connectionId for schema, DAX and preview calls.', z.object({ source: z.discriminatedUnion('kind', [z.object({ kind: z.literal('desktop'), port: z.number().int().min(1).max(65535).optional() }), z.object({ kind: z.literal('fabric'), workspaceId: z.string().uuid(), datasetId: z.string().uuid() })]) }), async ({ source }) => text(await models.connect(source)));
    tool('get_schema', 'Read tables, columns, data types and measures from the connected semantic model. Up to ten distinct sample values are queried per column; individual sample failures are returned on that column without inventing data. No schema or model objects are changed.', z.object({ connectionId: z.string().uuid() }), async ({ connectionId }) => text(await models.schema(connectionId)));
    tool('run_dax', 'Execute a read-only DAX EVALUATE table query against a connected model. Returns at most maxRows rows, default 200. Use it to inspect data and verify visual bindings; this tool does not expose XMLA commands or persistent model changes.', z.object({ connectionId: z.string().uuid(), dax: z.string().min(1).max(100000), maxRows: z.number().int().min(1).max(10000).default(200) }), async ({ connectionId, dax, maxRows }) => text({ rows: await models.query(connectionId, dax, maxRows) }));
    tool('list_templates', 'List the shared Vilsem declarative visual templates with their slot and parameter contracts. Use these templates as starting points and read vilsem://docs/spec-format before changing token expressions or formatter templates.', z.object({}), async () => text(EXAMPLE_TEMPLATES));
    tool('validate_spec', 'Resolve a Vilsem composition or declarative template without querying a model. Returns its empty-data ECharts option or precise validation errors. Run this before preview_visual; native Power BI visual specifications are not supported.', z.object({ spec: object }), async ({ spec }) => text({ option: validateSpec(spec) }));
    tool('explain_visual', 'Explain a Vilsem custom visual spec, its field bindings, resolved empty-data ECharts option and exact DAX query before preview or commit. Does not inspect or modify native visuals or model objects.', z.object({ spec: object, bindings }), async ({ spec, bindings }) => {
        const option = validateSpec(spec);
        validateBindings(spec, bindings);
        return text({ type: spec.type || 'custom', template: spec.template?.meta?.id || null, bindings, dax: buildVisualDax({ ...bindings, maxRows: 200 }), option, interactions: ['selection', 'cross-filter', 'cross-highlight', 'native tooltip', 'context menu'] });
    });
    tool('preview_visual', 'Validate a Vilsem spec, build DAX from bound existing fields, query the connected model and render the resolved ECharts option as a deterministic PNG. Returns PNG image content and option JSON. This previews a custom visual only and does not write a report.', z.object({ connectionId: z.string().uuid(), spec: object, bindings, width: z.number().int().min(100).max(2400).default(800), height: z.number().int().min(100).max(2400).default(500) }), async ({ connectionId, spec, bindings, width, height }) => {
        validateSpec(spec);
        validateBindings(spec, bindings);
        const dimensions = bindings.dimensions.map(field => `${field.table}[${field.column}]`), measures = bindings.measures.map(field => field.name);
        const dax = buildVisualDax({ ...bindings, maxRows: 200 });
        const raw = await models.query(connectionId, dax, 200);
        const rows = (dimensions.length > 1 ? normaliseTableRows(raw, dimensions, measures) : normaliseRows(raw, dimensions[0] ? resolveRowKey(raw, dimensions[0]) : null, measures));
        const result = previewRows(spec, rows, width, height);
        return { content: [{ type: 'image', data: Buffer.from(result.png).toString('base64'), mimeType: 'image/png' }, ...text({ option: result.option, rowCount: rows.length }).content] };
    });
    tool('list_pages', 'Read existing PBIR pages and visual names, types and positions so you can choose a page and avoid overlap. This tool does not edit or validate native visuals, slicers, bookmarks, filters or report themes.', z.object({ reportDir: z.string().min(1) }), async ({ reportDir }) => text(await listPages(reportDir)));
    tool('commit_visual', 'Add one Vilsem Renderer visual to one existing PBIR page using @vilsem/core. Existing visual names are refused; the only additional changes are missing renderer resources and registration. Native visuals, slicers, bookmarks, filters, themes and model objects are not edited. If Desktop is open, accept its external-change reload prompt after this call.', z.object({ reportDir: z.string().min(1), pageName: z.string().min(1), visualName: z.string().min(1), spec: object, bindings, layout: z.object({ x: z.number().min(0), y: z.number().min(0), width: z.number().positive(), height: z.number().positive(), z: z.number().min(0).optional(), tabOrder: z.number().min(0).optional() }) }), async (args) => text(await commitVisual(args)));
    tool('validate_visuals', 'Validate only PBIR visual containers whose visualType is the stable Vilsem Renderer GUID. Reports schema errors, unreadable spec literals and unsupported current-renderer specs. Native visuals and all report-level objects are neither validated nor reported.', z.object({ reportDir: z.string().min(1) }), async ({ reportDir }) => text(await validateVisuals(reportDir)));
    for (const template of EXAMPLE_TEMPLATES) {
        const uri = `vilsem://templates/${template.meta.id}`;
        server.registerResource(template.meta.id, uri, { mimeType: 'application/json' }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(template) }] }));
    }
    server.registerResource('spec-format', 'vilsem://docs/spec-format', { mimeType: 'text/markdown' }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: await fs.readFile(new URL('../docs/spec-format.md', import.meta.url), 'utf8') }] }));
    return server;
}
