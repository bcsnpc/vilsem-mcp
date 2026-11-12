import { assertLocalPath, assertLocalLinks, safeEnvironmentPath } from './paths.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { constants } from 'node:fs';
import { validateSpec } from './reports.js';
const MAX_BYTES = 1048576;
export function templatesDirectory(env = process.env) {
    return assertLocalPath(path.resolve(safeEnvironmentPath(env.VILSEM_TEMPLATES_DIR, 'VILSEM_TEMPLATES_DIR') || path.join(process.platform === 'win32' ? (env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')) : (env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share')), 'vilsem', 'templates')), 'template library');
}
function filename(name) {
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name))
        throw Error('Template name must be a safe lowercase slug, 1..80 characters (letters, digits, underscore, hyphen), not a reserved device name');
    return name + '.vilsem-visual.json';
}
export async function readUserTemplate(name, root = templatesDirectory()) {
    await assertLocalLinks(root, 'template library');
    const file = path.join(root, filename(name)), stat = await fs.lstat(file, { bigint: true });
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > BigInt(MAX_BYTES))
        throw Error('User template must be a regular JSON file up to 1 MiB; symlinks are refused');
    const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    let raw;
    try {
        const current = await handle.stat({ bigint: true });
        if (!current.isFile() || current.ino !== stat.ino || current.dev !== stat.dev || current.size > BigInt(MAX_BYTES))
            throw Error('Template changed during read; retry from the library inventory');
        raw = await handle.readFile('utf8');
    }
    finally {
        await handle.close();
    }
    if (Buffer.byteLength(raw) > MAX_BYTES)
        throw Error('Template exceeds 1 MiB');
    const saved = JSON.parse(raw);
    if (saved.name !== name || saved.version !== 1 || !saved.spec)
        throw Error('Unrecognized user template envelope');
    validateSpec(saved.spec);
    return { ...saved, source: 'user', uri: `vilsem://templates/user/${name}` };
}
export async function saveUserTemplate({ name, description = '', spec, tags = [] }, root = templatesDirectory()) {
    await assertLocalLinks(root, 'template library');
    const file = path.join(root, filename(name));
    validateSpec(spec);
    if (description.length > 2000 || tags.length > 20 || tags.some(t => typeof t !== 'string' || t.length > 80))
        throw Error('Description limit is 2000 characters; tags limit is 20 strings of up to 80 characters');
    const value = { version: 1, name, description, tags: [...new Set(tags)], spec }, raw = JSON.stringify(value, null, 2) + '\n';
    if (Buffer.byteLength(raw) > MAX_BYTES)
        throw Error('Template exceeds 1 MiB');
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const handle = await fs.open(file, 'wx', 0o600);
    try {
        await handle.writeFile(raw);
        await handle.sync();
    }
    catch (error) {
        await handle.close();
        await fs.unlink(file).catch(() => { });
        throw error;
    }
    await handle.close();
    return { ...value, source: 'user', uri: `vilsem://templates/user/${name}` };
}
export async function listUserTemplates(root = templatesDirectory()) {
    await assertLocalLinks(root, 'template library');
    let files;
    try {
        files = await fs.readdir(root);
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return [];
        throw error;
    }
    const results = [];
    for (const file of files.filter(f => f.endsWith('.vilsem-visual.json')).sort()) {
        const name = file.slice(0, -'.vilsem-visual.json'.length);
        try {
            results.push(await readUserTemplate(name, root));
        }
        catch (error) {
            results.push({ name, source: 'user', unreadable: true, error: error.message });
        }
    }
    return results;
}
export async function deleteUserTemplate(name, root = templatesDirectory()) {
    await assertLocalLinks(root, 'template library');
    const file = path.join(root, filename(name)), stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink())
        throw Error('Only regular user-template files can be deleted');
    await fs.unlink(file);
    return { name, deleted: true };
}
