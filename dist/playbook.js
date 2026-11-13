import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const version = createRequire(import.meta.url)('../package.json').version;
const skillRoot = new URL('../skills/vilsem-powerbi-visuals/', import.meta.url);
export const CORE_IDS = [
    'division-of-labour-vilsem-draws-you-do-everything-else', 'ground-rules',
    '1-locate-the-project', '2-connect', '7-validate-preview-and-iterate',
    '8-make-sure-the-page-exists', '9-commit',
];
export const normalizeMarkdown = (source) => source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const slug = (title) => title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-');
export function parseMarkdown(source) {
    const text = normalizeMarkdown(source), headings = [];
    let offset = 0, fence;
    for (const line of text.split('\n')) {
        const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
        if (fence) {
            if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim())
                fence = undefined;
        }
        else if (marker)
            fence = { char: marker[1][0], length: marker[1].length };
        else {
            const match = /^ {0,3}(#{2,3})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
            if (match) {
                const title = match[2], id = slug(title);
                if (headings.some(h => h.id === id))
                    throw Error(`Duplicate playbook heading id: ${id}`);
                headings.push({ id, title, level: match[1].length, start: offset });
            }
        }
        offset += line.length + 1;
    }
    return headings.map((h, i) => ({ ...h, text: text.slice(h.start, headings.slice(i + 1).find(next => next.level <= h.level)?.start ?? text.length).trimEnd() + '\n' }));
}
export const approximateTokens = (text) => Math.ceil(Buffer.byteLength(text, 'utf8') / 4);
const index = (title, sections) => `## ${title}\n\n` + sections.map(s => `- \`${s.id}\` — ${s.title} (~${approximateTokens(s.text)} tokens)`).join('\n') + '\n';
const aliases = {
    '9a': '9a-measures-for-shareable-reports', commit: '9-commit', edit: '10-edit-later',
    'known-issues': 'known-vilsem-issues-and-workarounds',
    gotchas: 'environment-and-setup-gotchas-windows',
    'cookbook:sankey': 'cookbook:sankey-multi-level-flows',
};
export async function getPlaybook(section = 'core') {
    const id = aliases[section] ?? section;
    const header = `vilsem-playbook ${version} · section: ${id}`;
    try {
        const [source, cookbookSource, pagesSource, artSource] = await Promise.all(['SKILL.md', 'references/spec-cookbook.md', 'references/pbir-pages.md', 'references/data-art-recipes.md'].map(file => fs.readFile(new URL(file, skillRoot), 'utf8').then(normalizeMarkdown)));
        const skill = parseMarkdown(source), cookbook = parseMarkdown(cookbookSource), art = parseMarkdown(artSource);
        const missing = CORE_IDS.filter(id => !skill.some(s => s.id === id));
        const core = CORE_IDS.flatMap(id => skill.find(s => s.id === id)?.text ?? []).join('\n');
        const coreNote = missing.length ? `\nNote: unavailable core sections: ${missing.join(', ')}. Serving the remaining sections.\n` : '';
        const cooked = cookbook.map(s => ({ ...s, id: 'cookbook:' + s.id })), recipes = art.map(s => ({ ...s, id: 'art:' + s.id }));
        const cookbookIndex = index('Cookbook index', cooked), artIndex = index('Data-art recipes index', recipes);
        const other = [...skill.filter(s => !CORE_IDS.includes(s.id)),
            { id: 'all', title: 'Complete skill', text: source }, { id: 'pbir-pages', title: 'PBIR pages reference', text: pagesSource },
            { id: 'cookbook', title: 'Cookbook index', text: cookbookIndex }, { id: 'art', title: 'Data-art recipes index', text: artIndex }];
        const bodies = new Map([['core', core + coreNote + '\n' + index('On-demand section index', other)], ['all', source], ['pbir-pages', pagesSource], ['cookbook', cookbookIndex], ['art', artIndex], ...skill.map(s => [s.id, s.text]), ...cooked.map(s => [s.id, s.text]), ...recipes.map(s => [s.id, s.text])]);
        const body = bodies.get(id);
        if (body === undefined)
            throw Error(`Unknown playbook section ${JSON.stringify(section)}. Valid ids: ${[...bodies.keys(), ...Object.keys(aliases)].join(', ')}`);
        return { text: header + '\n' + body, coreBytes: Buffer.byteLength(core, 'utf8'), coreTokens: approximateTokens(core) };
    }
    catch (error) {
        throw Error(header + '\n' + error.message);
    }
}
