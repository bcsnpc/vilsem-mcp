import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
// Connections own their target IDs. No process-global dataset mutation is used.
export class Models {
    adapter;
    connections = new Map();
    constructor(adapter = new VilsemAdapter()) {
        this.adapter = adapter;
    }
    async connect(source) { const connection = await this.adapter.connect(source); const connectionId = crypto.randomUUID(); this.connections.set(connectionId, connection); return { connectionId, kind: source.kind }; }
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
        const connection = this.get(id), schema = await this.adapter.schema(connection);
        const columnTasks = [];
        for (const table of schema.tables || [])
            for (const column of table.columns || [])
                columnTasks.push({ table, column });
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
                    column.sampleValues = [];
                    column.sampleError = error.message;
                }
            }
        }));
        return schema;
    }
}
export class VilsemAdapter {
    appRequire;
    load() {
        if (this.appRequire)
            return this.appRequire;
        const candidates = [process.env.VILSEM_APP_PATH, path.resolve(process.cwd(), '../semantic_app'), path.resolve(process.cwd(), '../vilsem')].filter(Boolean);
        const root = candidates.find(candidate => fs.existsSync(path.join(candidate, 'src/powerbi/localRuntime.js')));
        if (!root)
            throw Error('Set VILSEM_APP_PATH to an installed Vilsem source checkout; its existing model and authentication adapters are required for connections');
        this.appRequire = createRequire(path.join(root, 'package.json'));
        // Reuse Vilsem configuration and authentication; never print credentials.
        this.appRequire('dotenv').config({ path: path.join(root, '.env'), quiet: true });
        return this.appRequire;
    }
    bridge(payload) { return this.load()('./src/powerbi/localRuntime.js').bridge(payload); }
    async connect(source) {
        if (source.kind === 'desktop') {
            if (process.platform !== 'win32')
                throw Error('Power BI Desktop connections require Windows');
            let port = source.port;
            if (!port) {
                const script = `$found=@(); foreach($engine in @(Get-CimInstance Win32_Process -Filter "Name='msmdsrv.exe'")){ $match=[regex]::Match($engine.CommandLine,'-s\\s+"([^\"]+)"'); if($match.Success){ $file=Join-Path $match.Groups[1].Value 'msmdsrv.port.txt'; if(Test-Path -LiteralPath $file){$found += [int]([IO.File]::ReadAllText($file,[Text.Encoding]::Unicode).Trim())} } }; ConvertTo-Json -InputObject @($found) -Compress`;
                const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 15000 });
                const ports = JSON.parse(stdout || '[]');
                if (ports.length !== 1)
                    throw Error(ports.length ? 'Multiple Desktop models are open; provide source.port' : 'No local Analysis Services instance found; open the model in Power BI Desktop');
                port = ports[0];
            }
            const { catalogs } = await this.bridge({ action: 'catalogs', port });
            if (catalogs.length !== 1)
                throw Error('The Desktop instance must expose exactly one model');
            const catalog = catalogs[0].CATALOG_NAME;
            const metadata = await this.bridge({ action: 'metadata', port, catalog });
            return { source: { ...source, port }, catalog, metadata };
        }
        const auth = this.load()('./src/auth/auth.js');
        await auth.getToken();
        return { source };
    }
    async query(connection, dax, maxRows) {
        if (connection.source.kind === 'desktop')
            return (await this.bridge({ action: 'query', port: connection.source.port, catalog: connection.catalog, dax })).rows.slice(0, maxRows);
        const { workspaceId, datasetId } = connection.source;
        const token = await this.load()('./src/auth/auth.js').getToken();
        const response = await fetch(`https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/executeQueries`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ queries: [{ query: dax }], serializerSettings: { includeNulls: true } }), signal: AbortSignal.timeout(60000) });
        const body = await response.json();
        if (!response.ok || body.error || body.results?.[0]?.error)
            throw Error(`Power BI query failed (${response.status}): ${body.error?.message || body.results?.[0]?.error?.message || 'Check model query permissions'}`);
        return (body.results?.[0]?.tables?.[0]?.rows || []).slice(0, maxRows);
    }
    async schema(connection) {
        if (connection.source.kind === 'desktop') {
            const metadata = connection.metadata;
            return { tables: metadata.tables.map(table => ({ ...table, columns: metadata.columns.filter(column => column.tableId === table.id).map(column => ({ ...column, dataType: { 1: "automatic", 2: "string", 6: "int64", 8: "double", 9: "dateTime", 10: "decimal", 11: "boolean", 17: "binary", 19: "unknown", 20: "variant" }[column.dataType] || String(column.dataType) })) })), measures: metadata.measures.map(measure => ({ ...measure, table: metadata.tables.find(table => table.id === measure.tableId)?.name })) };
        }
        const load = this.load(), token = await load('./src/auth/auth.js').getToken();
        return load('./src/fabric/metadata.js').discoverViaItemDefinition(connection.source.workspaceId, connection.source.datasetId, token);
    }
}
