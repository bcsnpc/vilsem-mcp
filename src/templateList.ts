// Compact template inventory for agents. The full shipped list is ~550 KB, which
// overflows agent context in clients that cannot redirect a tool result to a file.
// Default: one short entry per template. `id` returns that template in full;
// `search` filters; `full:true` keeps the previous complete output.

type Entry = Record<string, any>

const slotSummary = (slots: Record<string, any> | undefined) =>
  Object.entries(slots || {}).map(([name, slot]) => `${name}:${slot?.kind ?? 'unknown'}${slot?.count != null ? `×${typeof slot.count === 'object' ? `${slot.count.min ?? ''}-${slot.count.max ?? ''}` : slot.count}` : ''}`).join(', ')

export function templateId(t: Entry): string {
  return String(t.meta?.id ?? t.name ?? t.spec?.template?.meta?.id ?? '')
}

export function compactEntry(t: Entry) {
  if (t.unreadable) return {id: t.name, source: t.source, unreadable: true, error: t.error}
  const meta = t.meta ?? t.spec?.template?.meta ?? {}
  const description = t.meta?.description ?? t.description ?? meta.description
  const entry: Entry = {id: templateId(t), name: meta.name ?? t.name, source: t.source}
  if (description) entry.description = String(description).length > 160 ? String(description).slice(0, 157) + '...' : String(description)
  const slots = slotSummary(t.slots ?? t.spec?.template?.slots)
  if (slots) entry.slots = slots
  if (Array.isArray(t.tags) && t.tags.length) entry.tags = t.tags
  return entry
}

export function listTemplates(all: Entry[], {id, search, full = false}: {id?: string, search?: string, full?: boolean} = {}) {
  if (id) {
    const match = all.find(t => templateId(t) === id) ?? all.find(t => templateId(t).toLowerCase() === id.toLowerCase())
    if (!match) throw Error(`No template "${id}". Call list_templates without arguments for ids.`)
    return match
  }
  const needle = search?.trim().toLowerCase()
  const selected = needle ? all.filter(t => JSON.stringify(compactEntry(t)).toLowerCase().includes(needle)) : all
  if (full) return selected
  return {
    count: selected.length,
    hint: 'Compact list. Call list_templates with id:"<id>" for one complete template (slots, params, template, exampleSpec). search:"<text>" filters; full:true returns every template in full (very large).',
    templates: selected.map(compactEntry),
  }
}
