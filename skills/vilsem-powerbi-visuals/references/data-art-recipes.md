# Contoso data-art recipes

Field references from the Contoso 10M build (renderer 4.43 / core 0.8.0); these are not shipped templates and are not added to `list_templates`. Call `get_playbook` with section `art` for the index, then `art:<slug>`.

Except Isotype, these use `formatVersion:4`, a custom series and `renderItem.language:"vilsem-expression"`. Select the latest full year from the global last-sale date using `YEAR([Last Sale Date])` and `REMOVEFILTERS('Date')`; check whether the source year is complete. Discover and adapt actual fields before reuse. Example specs contain preview-only `spec.measures`; promote them with user approval before sharing (playbook section 9a).

Example links are relative to the MCP package tree. Native `install-skill` copies the playbook references, not the example JSON: find those under the installed MCP package's `docs/examples/contoso/`.

## Du Bois spiral

- **Idea:** one bar per category. Each bar runs straight, then coils around a spiral; bigger value = longer coil. Parchment background with red, gold and green.
- **Bindings:** category dim, plus measures `s` (value), `sh` (share of max), `r` (rank).
- **DAX:** rank with `ROUND` (see the playbook's known-issues section); `sh = s / MAXX(ALLSELECTED(cat), s)`.
- **Draw:** `top` transform (order), then `points`. Use a `path` per item: `M x0 y L x1 y A rx ry 0 large 1 x2 y2` built with `concat`. The ring radius shrinks by rank (`viewportHeight*k - rank*gap`); the arc sweep is ∝ `sh`. Text labels via the repeat pattern (see cookbook:literal-labels-in-expression-series).
- **Pitfalls:**
  - The first draft crowded the rings. Widen the ring spacing and thicken the bars after checking the preview.
  - Credit "inspired by W.E.B. Du Bois's 1900 data portraits".

References: [artDuBois.json](../../../docs/examples/contoso/artDuBois.json), [demoDuBoisSpiral.json](../../../docs/examples/contoso/demoDuBoisSpiral.json).

## Ridgelines

- **Idea:** one ridge per month of the last 3 years, daily values as peaks, stacked vertically.
- **Bindings:** `Date[Date]` dim; measures `d` (day of month), `l` (line index = (year offset)*12 + month - 1), `v` (value rounded to 2 dp), `n` (next day's value, for the segment end).
- **Draw:** a `polygon` per day from `coord([d, -l + v*k])` to `coord([d+1, -l + n*k])` with a base at `-l`. Fill with the background colour so ridges occlude each other; stroke in white.
- **Pitfalls:** restrict to about 3 years (row limit). `when: value(3) >= 0` skips gaps.

References: [artRidges.json](../../../docs/examples/contoso/artRidges.json).

## Data flowers

- **Idea:** one flower per category, arranged in a 4-wide grid. Petals = months: length ∝ sales, colour = growth.
- **Bindings:** category × month; measures `c` (category rank, ROUNDed), `m` (month number), `l` (length = share of max over category × month), `g` (YoY growth).
- **Draw:** grid cell from rank (`mod 4`, `floor /4`); petal angle = `m/12 * 2π` via `sin`/`cos`; a `polyline` petal from the centre. A second custom series draws the stems and labels.
- **Pitfalls:** RANKX float ties stacked two flowers on one cell; fixed with `ROUND`. Labels need the repeat pattern.

References: [artFlowers.json](../../../docs/examples/contoso/artFlowers.json).

## Periodic table

- **Idea:** subcategories as "elements": column = category, row = rank within category; tile shows a symbol, value and growth.
- **Bindings:** sub × category; measures `c` (category column via `SWITCH`), `r` (row = 8 - rank within category), `n` (global rank number), `s` (sales), `g` (growth).
- **DAX:** the global rank must `REMOVEFILTERS(Product[Sub], Product[Category])`; the per-category rank only `REMOVEFILTERS(Product[Sub])`.
- **Draw:** `rect` tiles at `coord([c, r])`; `text` for the abbreviation, rank and value; fill by growth via `colorScale`.

References: [artPeriodic.json](../../../docs/examples/contoso/artPeriodic.json).

## Minard flow

- **Idea:** cohort flow over years; band width = surviving customers from the first-year cohort, with a return-path band.
- **Bindings:** year slot **`kind:"time"`** (order matters); measures `a` (active cohort customers), `s` (cohort sales), `r` (retention).
- **DAX:** cohort with `INTERSECT` over customer sets. **Expensive**: keep it to 3 measures (six measures timed out at 30 s).
- **Draw:** `window` transforms (`lag`) give the previous year's values; draw trapezoid `polygon` segments from previous to current with width ∝ `a`.
- **Pitfalls:** rows out of order until the year slot became `time`.

References: [artMinard.json](../../../docs/examples/contoso/artMinard.json).

## Isotype

- **Idea:** rows of repeated icons, one icon = N units.
- **Draw:** standard `pictorialBar` with `symbolRepeat:true`, `symbolSize`, `symbolClip` (no expression language needed), after a `top` transform for order. Exclude non-geographic members (e.g. "Online") in DAX.

- **Bindings / DAX:** `Store[CountryName]` and country sales for the latest full year, divided by a declared icon-unit scale. Exclude `Online`; the full example supplies the scoped DAX.
- **Pitfall:** state the units per icon so repeated symbols cannot be mistaken for individual customers.

References: [artIsotype.json](../../../docs/examples/contoso/artIsotype.json).

## Dear Data

- **Idea:** one glyph per day of the year in a month × day grid; glyph shape and size encode the value against that month's average, weekday tint.
- **Bindings:** `Date[Date]`; measures `m` (month index), `d` (day), `r` (ratio to that month's daily average), `w` (weekday).
- **Draw:** small `circle`/`path` glyphs at grid positions from `m`/`d`; size from `r`; weekday-based colour.

- **Pitfall:** label the monthly-average ratio and day grid; check missing days and leap-year handling against the chosen year.

References: [artDearData.json](../../../docs/examples/contoso/artDearData.json).

## Botanical garden

- **Idea:** each store is a plant: stem height = years open, leaf size = latest-year sales, colour = country.
- **Bindings:** store dim; measures `x` (rank position), `h` (age), `s` (sales), `c` (country index via `SWITCH`), `l` (lifetime sales).
- **Draw:** stem `line` plus leaf `path`s (quadratic curves via `concat`), with leaf scale **0.12** (0.25 overlapped badly).
- **Pitfalls:** exclude the "Online store" member in DAX.

References: [artBotanical.json](../../../docs/examples/contoso/artBotanical.json).

The accompanying non-art examples cover cumulative and bubble races, radial monthly bars, source-coloured Sankey, a calendar, a decade spiral and a year clock. Fetch the matching cookbook pattern; all example JSON lives under `docs/examples/contoso`.
