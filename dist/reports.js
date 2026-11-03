import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { injectVisual, validateVisualContainer, RENDERER_GUID } from '@vilsem/core/pbir';
import { resolveVisualSpec } from '@vilsem/core/spec/resolve';
import { instantiateVisual, buildThemeContext, slotCount } from '@vilsem/core/templates';
import { getThemeTokens } from '@vilsem/core/theme';
export function validateSpec(spec) {
    if (spec?.version != null && spec.version !== 1)
        throw Error(`Unsupported spec version ${spec.version}; current renderer supports version 1`);
    const option = resolveVisualSpec(spec);
    if (spec.template) {
        const resolved = instantiateVisual({ template: spec.template, rows: [], params: spec.params || {}, theme: buildThemeContext(getThemeTokens(spec.canvasTheme === 'light' ? 'light' : 'dark')) });
        // Numeric array indexes may legitimately be absent before data is queried.
        const errors = resolved.warnings.filter(warning => /token .*resolved to undefined/.test(warning) && !/[.]\d+(?:[.]|\b)/.test(warning));
        if (errors.length)
            throw Error(errors.join('\n'));
    }
    return option;
}
export function validateBindings(spec, bindings) {
    if (!spec.template)
        return;
    let dimensions = 0, measures = 0;
    for (const slot of Object.values(spec.template.slots || {})) {
        if (slot.kind === 'measure')
            measures += slotCount(slot.count);
        else if (slot.kind === 'dimension' || slot.kind === 'time')
            dimensions++;
    }
    if ((bindings.dimensions?.length || 0) < dimensions || (bindings.measures?.length || 0) < measures)
        throw Error(`Template requires ${dimensions} dimension/time bindings and ${measures} measure bindings`);
}
const read = async (file) => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
export async function listPages(reportDir) {
    const root = await fs.realpath(reportDir);
    const pagesDir = path.join(root, 'definition', 'pages');
    const metadata = await read(path.join(pagesDir, 'pages.json'));
    const pages = [];
    for (const name of metadata.pageOrder || []) {
        if (!/^[\w-]+$/.test(name))
            throw Error('Invalid PBIR page name');
        const dir = path.join(pagesDir, name);
        const page = await read(path.join(dir, 'page.json'));
        const visuals = [];
        for (const folder of await fs.readdir(path.join(dir, 'visuals'), { withFileTypes: true }).catch(error => {
            if (error.code === 'ENOENT')
                return [];
            throw error;
        })) {
            if (!folder.isDirectory())
                continue;
            const visual = await read(path.join(dir, 'visuals', folder.name, 'visual.json'));
            visuals.push({ name: visual.name, type: visual.visual?.visualType, position: visual.position });
        }
        pages.push({ name, displayName: page.displayName, width: page.width, height: page.height, visuals });
    }
    return pages;
}
export async function validateVisuals(reportDir) {
    const root = await fs.realpath(reportDir);
    const pages = path.join(root, 'definition', 'pages');
    const results = [];
    for (const page of await fs.readdir(pages, { withFileTypes: true })) {
        if (!page.isDirectory())
            continue;
        const dir = path.join(pages, page.name, 'visuals');
        for (const visual of await fs.readdir(dir, { withFileTypes: true }).catch(error => {
            if (error.code === 'ENOENT')
                return [];
            throw error;
        })) {
            if (!visual.isDirectory())
                continue;
            const file = path.join(dir, visual.name, 'visual.json');
            const text = await fs.readFile(file, 'utf8');
            let value;
            try {
                value = JSON.parse(text.replace(/^\uFEFF/, ''));
            }
            catch (error) {
                if (text.includes(RENDERER_GUID))
                    results.push({ path: file, valid: false, error: 'Unreadable Vilsem visual JSON' });
                continue;
            }
            if (value.visual?.visualType !== RENDERER_GUID)
                continue;
            try {
                await validateVisualContainer(value);
                const literal = value.visual.objects?.semantica?.[0]?.properties?.primitiveSpec?.expr?.Literal?.Value;
                if (typeof literal !== 'string' || !literal.startsWith("'") || !literal.endsWith("'"))
                    throw Error('Missing primitiveSpec literal');
                const spec = JSON.parse(literal.slice(1, -1).replace(/''/g, "'"));
                validateSpec(spec);
                results.push({ path: file, valid: true });
            }
            catch (error) {
                results.push({ path: file, valid: false, error: error.message });
            }
        }
    }
    return results;
}
export async function desktopWarning(reportDir) {
    const warnings = [];
    const root = await fs.realpath(reportDir);
    if (await fs.stat(path.join(root, '.pbi')).then(() => true, () => false))
        warnings.push('A .pbi state folder exists; Desktop may have this report open.');
    if (process.platform === 'win32') {
        const script = "Get-CimInstance Win32_Process -Filter \"Name='PBIDesktop.exe'\" | Select-Object CommandLine | ConvertTo-Json -Compress";
        try {
            const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 15000 });
            // Desktop may have opened a PBIP from its UI, leaving no path in CommandLine.
            if (stdout.trim() && stdout.trim() !== 'null')
                warnings.push('Power BI Desktop is running. After this write, accept its external-change reload prompt if this project is open.');
        }
        catch {
            warnings.push('Could not inspect Desktop processes. If this project is open, accept its external-change reload prompt; avoid saving stale Desktop state.');
        }
    }
    if (warnings.length)
        warnings.push('Accept the reload prompt in Desktop after the write; do not save stale Desktop state over the external changes.');
    return warnings;
}
export async function commitVisual(args) {
    validateSpec(args.spec);
    validateBindings(args.spec, args.bindings);
    const warnings = await desktopWarning(args.reportDir);
    return { ...await injectVisual(args), warnings };
}
