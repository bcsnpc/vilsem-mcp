import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { SKILL_FILES } from './agent-instructions.js';
const skillName = 'vilsem-powerbi-visuals';
export const skillSource = fileURLToPath(new URL('../skills/vilsem-powerbi-visuals/', import.meta.url));
export function skillDestination(target, home = os.homedir()) {
    if (!target.trim())
        throw Error('--target must name claude, codex, or a skills-root directory');
    const root = target === 'claude' ? path.join(home, '.claude', 'skills') : target === 'codex' ? path.join(home, '.agents', 'skills') : target === '~' ? home : /^~[\\/]/.test(target) ? path.join(home, target.slice(2)) : path.resolve(target);
    return path.join(root, skillName);
}
async function noLinks(file) {
    for (let current = path.resolve(file);; current = path.dirname(current)) {
        try {
            const stat = await fs.lstat(current);
            if (stat.isSymbolicLink())
                throw Error(`Refusing a linked skill destination: ${current}`);
            if (!stat.isDirectory() && current !== file)
                throw Error(`Skill parent is not a directory: ${current}`);
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
        if (path.dirname(current) === current)
            break;
    }
}
export async function installSkill(target, force = false) {
    const destination = skillDestination(target);
    await noLinks(destination);
    let exists = false;
    try {
        const info = await fs.lstat(destination);
        if (!info.isDirectory())
            throw Error('Skill destination must be a directory');
        exists = true;
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
    }
    if (exists && !force)
        throw Error(`Skill already exists at ${destination}; use --force to replace the packaged files`);
    // Preflight every source and destination before writing. Force overwrites only
    // these packaged files; unrelated user files are retained, never recursively deleted.
    const files = await Promise.all(SKILL_FILES.map(async (relative) => {
        const source = path.join(skillSource, relative), file = path.join(destination, relative), sourceInfo = await fs.lstat(source);
        if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink())
            throw Error('Packaged skill must contain regular files');
        await noLinks(path.dirname(file));
        try {
            const info = await fs.lstat(file);
            if (!info.isFile() || info.isSymbolicLink())
                throw Error(`Refusing non-regular skill file: ${file}`);
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
        return { file, bytes: await fs.readFile(source) };
    }));
    await fs.mkdir(destination, { recursive: true });
    for (const { file, bytes } of files) {
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, bytes, { flag: force ? 'w' : 'wx' });
    }
    return destination;
}
export async function runCli(args) {
    if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
        console.error('vilsem-mcp [install-skill [--target claude|codex|<skills-root-dir>] [--force]]\nNo arguments: start the stdio MCP server. install-skill defaults to claude.');
        return;
    }
    if (args[0] !== 'install-skill')
        throw Error('Unknown command. Use vilsem-mcp --help; no arguments starts MCP stdio.');
    let target = 'claude', force = false, seenTarget = false;
    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--force' && !force)
            force = true;
        else if (args[i] === '--target' && !seenTarget && args[i + 1] && !args[i + 1].startsWith('--')) {
            target = args[++i];
            seenTarget = true;
        }
        else
            throw Error(`Invalid install-skill argument: ${args[i]}`);
    }
    console.error(`Installed ${skillName}: ${await installSkill(target, force)}`);
}
