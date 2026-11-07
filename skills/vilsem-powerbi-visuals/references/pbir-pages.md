# PBIR pages: creating pages and keeping Desktop in sync

vilsem only adds visuals to pages that already exist. Create pages yourself by editing the PBIR files, or ask the user to create them in Desktop and save.

## Project layout (enhanced PBIR)

```
<Name>.pbip
<Name>.Report/
  definition.pbir                  ← points at the semantic model (byPath or byConnection)
  definition/
    report.json                    ← report settings and registered custom visuals
    pages/
      pages.json                   ← pageOrder + activePageName
      <pageId>/
        page.json                  ← name, displayName, size
        visuals/<visualName>/visual.json
  CustomVisuals/<guid>/...         ← renderer resources (written by vilsem on first commit)
<Name>.SemanticModel/definition/   ← TMDL: tables/*.tmdl, relationships.tmdl, ...
```

If `definition/pages/` doesn't exist, the report is in the legacy format. Ask the user to save it in PBIR format in Desktop first; don't convert it yourself.

## Create a page

1. Pick an id: letters and digits, unique, no spaces. For example `vx01hero`. The folder name and the `name` field must match.
2. Write `definition/pages/<id>/page.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json",
  "name": "vx01hero",
  "displayName": "Executive Hero",
  "displayOption": "FitToPage",
  "height": 720,
  "width": 1280
}
```

   Copy the `$schema` version from an existing `page.json` in the same report, so it matches the report's version.

3. Append the id to `pageOrder` in `definition/pages/pages.json`. Keep every existing entry, and don't change `activePageName` unless the user asks. A page that isn't in `pageOrder` won't appear.
4. Edit the JSON with a script or a precise edit, not by hand-retyping the file, and keep the formatting valid.
5. Use the **id**, not the display name, as `pageName` in `commit_visual`.

## Layout tips

- Pages are 1280×720 by default. For a single full-page vilsem visual, use x=16, y=16, w=1248, h=688.
- To place a visual next to existing ones, call `list_pages` first. It returns every visual's position on every page, so you can avoid overlaps.
- Positions are in page pixels, before Desktop scales the page to fit the window.

## Desktop sync rules (tell the user)

- Desktop must be on the **same Windows machine** as the MCP server for local-model previews.
- **Before an external edit:** the user should save any changes they made in Desktop.
- **First time (the first vilsem visual in a report, or new pages):** the visual fails to render with *"To see this custom visual, add it to this report first"*, or the new pages don't appear. **Close the project without saving and reopen it.** `report.json` and page-list changes aren't live-reloaded.
- **Every later time (more visuals, or updates to existing ones):** Desktop shows an external-changes prompt. Click **apply / reload external changes**. No restart needed.
- **In both cases, don't save in Desktop before reloading or reopening**, or it overwrites the files with stale state.
- Live reload of external edits needs Desktop from August 2026 or later, with the preview feature **"Detect and reload external PBIP changes"** turned on. Earlier versions always need a close and reopen.
- The Desktop Analysis Services port changes on every reopen, so reconnect afterwards.

## What not to touch

- Native visuals, slicers, bookmarks, filters and themes. Edit these only when the user explicitly asks, with care or with a dedicated tool. `validate_visuals` checks vilsem objects only.
- The `.pbi/` folder holds Desktop's local state. Never edit or delete it.
- The semantic model. Use the Power BI Modeling MCP, and only when the user asks for model changes.
