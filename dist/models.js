import crypto from 'node:crypto';
import { createConnector } from '@vilsem/core/connect';
// Connections own their target IDs. No process-global dataset mutation is used.
export class Models {
    adapter;
    connections = new Map();
    constructor(adapter = new VilsemAdapter()) {
        this.adapter = adapter;
    }
    async connect(source) { const connection = await this.adapter.connect(source); const connectionId = crypto.randomUUID(); this.connections.set(connectionId, connection); return { connectionId, kind: source.kind, ...(connection.discovery ? { discovery: connection.discovery, port: connection.source.port } : {}) }; }
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
    async schema(id) {
        const connection = this.get(id), discovered = await this.adapter.schema(connection);
        // Introspection may include raw model definitions for Desktop app export.
        // The MCP schema contract exposes fields/relationships only, never data sources.
        const schema = { tables: discovered.tables || [], measures: discovered.measures || [], relationships: discovered.relationships || [] };
        const columnTasks = [];
        for (const table of schema.tables || [])
            for (const column of table.columns || []) {
                if (/^RowNumber-/.test(column.name)) {
                    column.sampleValues = [];
                    column.sampleSkipped = 'Internal Analysis Services row identity is not queryable';
                    continue;
                }
                columnTasks.push({ table, column });
            }
        let index = 0;
        const quoteTable = name => `'${String(name).replace(/'/g, "''")}'`;
        const quoteColumn = name => `[${String(name).replace(/\]/g, ']]')}]`;
        await Promise.all(Array.from({ length: Math.min(4, columnTasks.length) }, async () => {
            while (index < columnTasks.length) {
                const { table, column } = columnTasks[index++];
                const ref = `${quoteTable(table.name)}${quoteColumn(column.name)}`;
                try {
                    const rows = await this.adapter.query(connection, `EVALUATE TOPN(10, VALUES(${ref}), ${ref}, ASC)`, 10);
                    column.sampleValues = rows.slice(0, 10).map(row => Object.values(row)[0]);
                }
                catch (error) {
                    // Field-parameter display columns require a row projection, not VALUES
                    // over one member of their composite key. Keep source data types intact.
                    if (/composite key/i.test(error.message)) {
                        try {
                            const rows = await this.adapter.query(connection, `EVALUATE SELECTCOLUMNS(TOPN(10, ${quoteTable(table.name)}, ${ref}, ASC), "__vilsem_sample", ${ref})`, 10);
                            column.sampleValues = [...new Set(rows.slice(0, 10).map(row => Object.values(row)[0]))];
                            continue;
                        }
                        catch (fallback) {
                            error = fallback;
                        }
                    }
                    column.sampleValues = [];
                    column.sampleError = error.message;
                }
            }
        }));
        return schema;
    }
}
export class VilsemAdapter {
    connector = createConnector();
    connect(source) { return this.connector.connect(source); }
    query(connection, dax, maxRows) { return this.connector.query(connection, dax, maxRows); }
    schema(connection) { return this.connector.schema(connection); }
}
