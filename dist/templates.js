import fs from 'node:fs';
// Shipped examples are standalone specs; core's original template catalog stays compatible.
const root = new URL('../templates/', import.meta.url);
export const SHIPPED_SPECS = fs.readdirSync(root).filter(name => name.endsWith('.vilsem-visual.json')).sort().map(name => JSON.parse(fs.readFileSync(new URL(name, root), 'utf8')));
// Keep the template contract and carry a complete example envelope: scoped DAX
// lives outside template, so returning only template would silently lose it.
export const SHIPPED_TEMPLATES = SHIPPED_SPECS.map(spec => ({ ...spec.template, exampleSpec: spec }));
