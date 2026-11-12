import fs from 'node:fs/promises';
import path from 'node:path';
import { assertLocalPath, localRealpath } from './paths.js';
import { validateInputPaths } from './paths.js';
import crypto from 'node:crypto';
import { createConnector } from '@vilsem/core/connect';
import { enrichSchema, schemaDetail } from '@vilsem/core/connect/context';
export const ONLINE_DISABLED = 'Online models (Power BI Service / Fabric) are not supported in this release. Open the model in Power BI Desktop and connect with kind:"report" or kind:"desktop".';
async function checkConnectionSource(source) {
    if (source.kind === 'fabric' && process.env.VILSEM_ENABLE_ONLINE !== '1')
        throw Error(ONLINE_DISABLED);
    if (source.kind !== 'report')
        return;
    const root = await localRealpath(source.reportDir, 'source.reportDir');
    const file = await localRealpath(path.join(root, 'definition.pbir'), 'definition.pbir');
    const definition = JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '')), ref = definition.datasetReference;
    if (ref && Object.hasOwn(ref, 'byConnection')) {
        if (process.env.VILSEM_ENABLE_ONLINE !== '1')
            throw Error(ONLINE_DISABLED);
        return;
    }
    if (typeof ref?.byPath?.path !== 'string' || !ref.byPath.path.trim())
        throw Error('Report must have a local byPath dataset reference');
    assertLocalPath(ref.byPath.path, 'datasetReference.byPath.path');
    await localRealpath(path.resolve(root, ref.byPath.path), 'datasetReference.byPath.path');
}
// Preserve quoted DAX strings, table names and bracketed identifiers while
// removing comments. Cleaned queries also pass core 0.8.0's older prefix guard.
export function stripDaxComments(source) {
    let result = '', quote = '', i = 0;
    while (i < source.length) {
        const c = source[i], next = source[i + 1];
        if (quote) {
            result += c;
            i++;
            if (c === quote) {
                if (source[i] === quote) {
                    result += source[i++];
                }
                else
                    quote = '';
            }
            ;
            continue;
        }
        if (c === '"' || c === "'" || c === '[') {
            quote = c === '[' ? ']' : c;
            result += c;
            i++;
            continue;
        }
        if ((c === '-' && next === '-') || (c === '/' && next === '/')) {
            while (i < source.length && !/[\r\n]/.test(source[i])) {
                result += ' ';
                i++;
            }
            continue;
        }
        if (c === '/' && next === '*') {
            const end = source.indexOf('*/', i + 2);
            if (end < 0)
                throw Error('Unterminated DAX block comment');
            result += source.slice(i, end + 2).replace(/[^\r\n]/g, ' ');
            i = end + 2;
            continue;
        }
        result += c;
        i++;
    }
    return result.trim();
}
// Connections own their target IDs. No process-global dataset mutation is used.
export class Models {
    adapter;
    connections = new Map();
    metadata = new Map();
    profiles = new Map();
    constructor(adapter = new VilsemAdapter()) {
        this.adapter = adapter;
    }
    async connect(source) { await validateInputPaths({ source }); await checkConnectionSource(source); const connection = await this.adapter.connect(source); const connectionId = crypto.randomUUID(); this.connections.set(connectionId, connection); return { connectionId, kind: source.kind, schemaOnly: !!connection.schemaOnly, ...(connection.discovery ? { discovery: connection.discovery, ...(connection.source.port ? { port: connection.source.port } : {}) } : {}) }; }
    get(id) { const connection = this.connections.get(id); if (!connection)
        throw Error('Unknown connectionId; connect_model first'); return connection; }
    async query(id, dax, maxRows = 200) {
        // run_dax only accepts EVALUATE/DEFINE DAX queries, which cannot modify
        // the model. XMLA/TMSL commands are rejected; the engine validates syntax.
        const code = stripDaxComments(dax);
        if (!/^(EVALUATE\b|DEFINE\b[\s\S]*?\bEVALUATE\b)/i.test(code))
            throw Error('Only DAX EVALUATE queries are supported');
        const rows = await this.adapter.query(this.get(id), code, maxRows);
        return rows.slice(0, maxRows);
    }
    reportDir(id) { return this.get(id).reportDir; }
    async schema(id, { detail = 'summary', refresh = false, samples = process.env.VILSEM_SCHEMA_SAMPLES !== '0' } = {}) {
        const connection = this.get(id);
        if (refresh) {
            this.metadata.delete(id);
            this.profiles.delete(id);
        }
        let entry = this.profiles.get(id);
        if (!entry || entry.expires < Date.now()) {
            const next = { expires: Infinity, promise: Promise.resolve(null) };
            next.promise = this.fields(id, refresh).then(schema => enrichSchema(schema, (dax, maxRows) => this.query(id, dax, maxRows), { schemaOnly: !!connection.schemaOnly })).then(value => { next.expires = Date.now() + 60000; return value; }).catch(error => { if (this.profiles.get(id) === next)
                this.profiles.delete(id); throw error; });
            this.profiles.set(id, next);
            entry = next;
        }
        const result = schemaDetail(structuredClone(await entry.promise), detail);
        if (!samples)
            for (const table of result.tables)
                for (const column of table.columns)
                    delete column.sampleValues;
        return result;
    }
    async fields(id, refresh = false) {
        if (!refresh && this.metadata.has(id))
            return this.metadata.get(id);
        const discovered = await this.adapter.schema(this.get(id), { refresh });
        const schema = { tables: discovered.tables || [], measures: discovered.measures || [], relationships: discovered.relationships || [], ...(discovered.relationshipWarning ? { relationshipWarning: discovered.relationshipWarning } : {}) };
        this.metadata.set(id, schema);
        return schema;
    }
}
export class VilsemAdapter {
    connector;
    getConnector() { return this.connector ??= createConnector(); }
    connect(source) { return this.getConnector().connect(source); }
    query(connection, dax, maxRows) { return this.getConnector().query(connection, dax, maxRows); }
    schema(connection, options) { return this.getConnector().schema(connection, options); }
}
