import crypto from 'node:crypto';
import { createConnector } from '@vilsem/core/connect';
import { enrichSchema, schemaDetail } from '@vilsem/core/connect/context';
// Connections own their target IDs. No process-global dataset mutation is used.
export class Models {
    adapter;
    connections = new Map();
    metadata = new Map();
    profiles = new Map();
    constructor(adapter = new VilsemAdapter()) {
        this.adapter = adapter;
    }
    async connect(source) { const connection = await this.adapter.connect(source); const connectionId = crypto.randomUUID(); this.connections.set(connectionId, connection); return { connectionId, kind: source.kind, schemaOnly: !!connection.schemaOnly, ...(connection.discovery ? { discovery: connection.discovery, ...(connection.source.port ? { port: connection.source.port } : {}) } : {}) }; }
    get(id) { const connection = this.connections.get(id); if (!connection)
        throw Error('Unknown connectionId; connect_model first'); return connection; }
    async query(id, dax, maxRows = 200) {
        // This endpoint is for DAX table queries, not XMLA/model commands.
        const code = dax.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim();
        if (!/^(EVALUATE\b|DEFINE\b[\s\S]*?\bEVALUATE\b)/i.test(code))
            throw Error('Only DAX EVALUATE queries are supported');
        const rows = await this.adapter.query(this.get(id), dax, maxRows);
        return rows.slice(0, maxRows);
    }
    reportDir(id) { return this.get(id).reportDir; }
    async schema(id, { detail = 'summary', refresh = false } = {}) {
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
        return schemaDetail(structuredClone(await entry.promise), detail);
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
    connector = createConnector();
    connect(source) { return this.connector.connect(source); }
    query(connection, dax, maxRows) { return this.connector.query(connection, dax, maxRows); }
    schema(connection, options) { return this.connector.schema(connection, options); }
}
