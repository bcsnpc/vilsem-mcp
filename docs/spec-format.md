# Vilsem custom visual specification

Run `validate_spec` before `preview_visual`, then preview actual data before committing. `commit_visual` accepts only a spec that resolves through `@vilsem/core`. A spec is declarative JSON, never JavaScript or arbitrary ECharts code.

## Composition

```json
{"version":1,"type":"bar","config":{"title":"Sales","dataLabels":true}}
```

The current headless composition types are bar, column, stacked_bar, grouped_bar, line, area, stacked_area, bump, donut, pie, scatter, bubble, treemap, radar, gauge, slope and lollipop. DOM-adapter visuals are not ECharts compositions and are not supported by the MCP resolver. Validation without data returns an empty-data option; it does not prove field-role suitability or rendering with a particular dataset.

## Template

New advanced examples declare `template.meta.formatVersion:3`, requiring renderer
4.28 or later. Formats1 and2 remain readable. Older readers reject format3
explicitly instead of silently resolving unsupported fields to blank charts.

```json
{
  "version":1,
  "type":"custom",
  "params":{"dotSize":14},
  "template":{
    "meta":{"id":"ranking","name":"Ranking"},
    "slots":{"category":{"kind":"dimension","count":1},"value":{"kind":"measure","count":1}},
    "params":[{"name":"dotSize","type":"number","default":14}],
    "template":{"xAxis":{"type":"category","data":"$slot.category.categories"},"yAxis":{"type":"value"},"series":[{"type":"bar","data":"$slot.value.values"}]}
  }
}
```

`list_templates` returns the full shared examples with their slots and params. Template `params` declares defaults/coercion; spec `params` supplies instance values. Slots are populated in declaration order from normalized category/measure fields. The renderer uses the same core resolver as previews.

Tokens occupy an entire string value: `$slot.<name>.categories`, `.values`, `.series.<i>`, `.pairs`, `.pairsSwapped`, `.cells`, `.pieData`, `.dateRange`; `$param.<name>`; `$theme.palette`, `.palette.<i>`, `.font`, `.textPrimary`, `.textMuted`, `.gridStroke`, `.gridStrokeOn`, `.axisLine`, `.accent`, `.background`. Scalar slot summaries include `.first`, `.last`, `.sum`, `.avg`, `.min`, `.max`, `.delta`, `.deltaPct`, `.lastLabel`, `.sumLabel`, `.deltaLabel`, `.deltaPctLabel`. Transforms may define named calculations referenced through `$calc.<name>`; use an existing template's transform contract. Unknown slots and token roots are errors.

Allowed `formatterTemplate` placeholders: `{value}`, `{value:thousands}`, `{value:percent}`, `{name}`, `{seriesName}`, and ECharts aliases `{a}`, `{b}`, `{c}`, `{c:thousands}`, `{c:percent}`, `{d}` / `{percent}`. Unknown formatter placeholders are errors at the MCP boundary. Formatters are built by the allowlisted resolver; functions, script strings and `eval` are not accepted as an execution mechanism.

## Data and bindings

`bindings` uses existing semantic model fields:

```json
{"dimensions":[{"table":"Product","column":"Category"}],"measures":[{"table":"Measures","name":"Sales"},{"table":"Measures","name":"Profit"}]}
```

Rows normalize to `_cat` (primary category), `_val` (first measure), `_val2` and `_val3`. Multiple dimensions also supply `_cat2`, `_cats`; measures supply `_vals`. Measure values are evaluated directly through qualified semantic-model references. Structured bindings escape quoted table, column and measure names. Scalar visuals should use an ungrouped measure query; ratios and distinct counts require their own model evaluation.

The PBIR property is `objects.semantica.primitiveSpec`, stored as a JSON string inside a Power BI literal. Keep that compatibility name. Visual type is the stable GUID `semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D`. Layout is in report-page pixels: x, y, width, height, z and tabOrder.

This server creates Vilsem custom visuals only. It does not create or change native visuals, slicers, filters, bookmarks, themes or model objects.
## Expressive templates (formatVersion 2; core 0.3 / renderer 4.14+)

New templates declare `meta.formatVersion: 2`. The envelope remains `spec.version: 1` for PBIR compatibility. Re-import renderer 4.14.2.0 or newer into existing reports before committing these templates: commit_visual deliberately does not overwrite existing renderer resources. Old templates remain supported. See the nine shipped specs in `templates/` and `list_templates`; they were authored independently for the expressiveness exercise, not copied from the older catalog.

Slots consume up to **six** dimension/time fields, in declaration order, from `_cats`, and up to six semantic-model measures from `_vals`. `lastIndex` is the normalized row index of the last non-null numeric value. Data-item `rowIndexes` arrays identify contributing normalized rows so native selection and tooltips retain field identities after grouping or sorting. Derived sums require additive measures; ratios/distinct counts must be evaluated at the required grain by the model.

### Transform contracts

Transforms run in array order and require a unique safe `as` name. A field name refers to a slot or an earlier transform, without `$`. Calculations continue to expose the full numeric accessor set under `$calc.<as>`. These operations are pure, bounded algorithms shipped in core, not caller-supplied code.

| Operation | Example | Output / semantics |
| --- | --- | --- |
| Arithmetic | `{"calculate":"actual - previous","as":"delta"}` | Numeric per-row result; null inputs stay null. Math allowlist: abs, min, max, round, floor, ceil, sqrt. Unknown fields/functions are errors. |
| Ordered window | `{"window":{"op":"sum","field":"amount","orderBy":"month","partitionBy":"country"},"as":"running"}` | Running total; stable order within each partition, results aligned to original rows. Null contributions skipped. |
| Previous observation | `{"window":{"op":"lag","field":"amount","orderBy":"month","offset":1},"as":"previous"}` | Prior row in ordered partition, null when absent; optional numeric default. This is **not** an automatic prior-calendar-period query. Missing periods require a complete date grain or an existing prior-period model measure. |
| Share | `{"window":{"op":"percentOfTotal","field":"amount","partitionBy":"country"},"as":"share"}` | Share of partition total; zero denominator or null input gives null. |
| Date | `{"date":{"field":"start","take":16},"as":"starts"}` | Strict ISO calendar date to UTC milliseconds; invalid/missing dates give null. Optional take limits output; no date guessing. Desktop ADOMD serializes source DateTimes to ISO, without local-time JSON conversion. |
| Bounded sample | `{"take":{"field":"task","count":16},"as":"tasks"}` | First N aligned field values; values also become its category labels. Explicit sample, not a top-N aggregate. |
| Weighted edges | `{"links":{"source":"from","target":"to","value":"units"},"as":"flow"}` | `.nodes` and `.links`; duplicated edges summed. Node IDs are field-namespaced, labels remain human-readable. Negative weights are rejected; null weights skipped. Both retain contributing rowIndexes. For native Sankey or graph series. |
| Hierarchy | `{"hierarchy":{"levels":["category","subcategory","colour"],"value":"units"},"as":"tree"}` | `.children` tree, 2..6 levels, path-scoped IDs and parent totals. Duplicate leaves summed; negative weights rejected; null skipped. For native sunburst. |
| Facet | `{"facet":{"by":"country","category":"category","value":"units","columns":3,"maxPanels":12},"as":"facets"}` | `.panels` and `.max` across summed category cells. Panels contain name, index, categories, data, left/top/width/height percentage geometry. Shared category/scale domains; maxPanels overflow is an error, never a silently dropped panel. 1..6 columns, 1..36 panels. |

Window order uses numeric-aware ascending comparison (ISO dates sort chronologically). Equal keys preserve row order. `calculate` arithmetic has no object access, conditions, assignments, JavaScript callbacks or model mutation. Declare measure semantics explicitly; a local sum of a ratio is not a valid replacement for evaluating the ratio in DAX. These transforms operate on the returned data, not the entire semantic model.

### Bounded repeat and formatters

A repeat replaces one array-valued skeleton property, for example:

```json
{"series":{"repeat":"$calc.facets.panels","template":{"type":"bar","name":"$item.name","xAxisIndex":"$item.index","yAxisIndex":"$item.index","data":"$item.data"}}}
```

Use matching repeated grid, xAxis and yAxis definitions as shown in small_multiples.vilsem-visual.json. `$item.<field>` reads an own property of the current repeated record. Tokens still occupy entire strings; no template strings or embedded source code. A repeat must resolve to an array. Limits: 10,000 source rows/items, four repeat levels, 20,000 total expanded repeated records, 128 transforms, 64 levels of template nesting. Prototype keys and executable function values are rejected.

Additional formatter placeholders: `{label}` (data.label, falling back to name) and `{value:date}` / `{c:date}` (UTC YYYY-MM-DD, including axis formatter scalar inputs). Existing placeholders remain supported. Unknown placeholders are rejected before a query.

### Limits and imperative extensions

`preview_visual` queries at most 200 rows and reports a warning at the limit. The renderer receives Power BI's filtered/reduced DataView; previews do not establish full data coverage or interaction parity. Gantt intentionally shows 16 rows. Network previews are bounded samples when their query reaches 200 rows. Scalar period comparisons use existing measures at the selected date grain, not invented prior values.

The declarative resolver rejects `renderItem`, including strings pretending to be functions. Marimekko variable-width rectangles are a recorded imperative gap; no arbitrary code is enabled as a workaround. The proposed isolated extension contract and security requirements are in [expressiveness-gaps.md](expressiveness-gaps.md). This release does not implement that extension.


## Visual-scoped DAX measures

An envelope may declare `measures: { "Name": "scalar DAX expression" }`.
These definitions are query-only: preview emits `DEFINE MEASURE`, and report
projections use PBIR `NativeMeasure` DAX expressions evaluated by Power BI's host.
Nothing writes measures, columns, partitions or metadata to TMDL.

Bind a declared name using the same `{table, name}` measure binding shape.
The table must exist; all local bindings use the first measure binding's table.
Names must be unique case-insensitively and cannot shadow model measures or collide with model column names. This prevents DEFINE overrides or iterator name precedence from changing dependency meanings between the preview and inline host expression. Real unqualified iterator columns are recognized; the DAX engine resolves their row context.
Dependencies on other scoped measures are allowed; cycles are rejected.
Inline dependency expansion preserves measure context transition with CALCULATE.
Limits: 32 definitions, 16000 characters per expression, 100000 expanded characters.

`validate_spec({spec, connectionId})` is required when measures are declared.
It checks references against the connected schema and sends a read-only scalar
query to Analysis Services for authoritative DAX syntax/type/binding validation.
The lightweight lexical/reference pass is not a complete DAX parser.
Pass `connectionId` to `explain_visual` and `commit_visual` too. `explain_visual`
returns the complete DEFINE/EVALUATE query; `preview_visual` queries the same
measure expressions and grain. Validation evaluates every declared measure at
scalar context: expressions must be safe there (use SELECTEDVALUE/aggregation
instead of an unaggregated bare column). No model update operation is exposed.

Examples (replace table/field names with actual get_schema results):

```json
{"measures":{"Margin":"DIVIDE([Total Profit], [Total Revenue])"}}
```

```json
{"measures":{"Prior Year":"CALCULATE([Total Revenue], SAMEPERIODLASTYEAR('Calendar Lookup'[Date]))"}}
```

```json
{"measures":{"Category Rank":"RANKX(ALL('Product Categories Lookup'[CategoryName]), [Total Revenue], , DESC, DENSE)"}}
```

Power BI host support for inline NativeMeasure projections must be tested on the
intended Desktop/Service version; a PNG or valid PBIR schema is not runtime proof.


### Stress2 layout additions (renderer 4.15+)

Templates support up to six measure bindings (the original content, secondary,
tertiary roles plus quaternary, quinary and senary). Normalized `_vals` preserves
all values. More than six is a validation error; older renderer packages must be
upgraded before using the new roles. Existing three-measure specs are unchanged.

Use `{ "concat": [arrayOrRepeat, arrayOrRepeat] }` where ECharts expects one list,
for example to concatenate repeated facet layers into `series`. Each member must
resolve to an array. Only this explicit list is flattened once; scatter coordinate
arrays remain intact. Maximum 20000 result items; no callbacks/code execution.

The renderer now registers native heatmap, tree, boxplot, candlestick, parallel,
themeRiver, pictorialBar and funnel series, with polar/calendar/singleAxis/parallel
coordinate systems, markArea/markPoint, visualMap and slider zoom components.
These registrations are implementation support, not acceptance for every option;
see individual Desktop stress evidence before treating a visual as verified.


### Bounded scalar statistics

`{"stat":{"field":"revenue","op":"max"},"as":"peak"}` computes a statistic
across the current returned rows and broadcasts it as a numeric vector to those
same rows, so later `calculate` expressions can use it. Optional `partitionBy`
computes separately per group. Operations: min, max, sum, mean, median, count,
quantile (`q` in 0..1, linear interpolation at `(n-1)*q`), stddev (population by
default, `sample:true` uses n-1). Nulls are omitted; all-null gives null except
count=0. Sample stddev with fewer than two numbers is null. No implicit zero fill.
Statistics describe the returned data window, not unseen model rows: use a scoped
DAX measure for a population statistic or a specific calendar filter context.
This supports median reference lines and horizon bands sized to the observed peak
without truncating high values. The existing 10000-row bound applies.


Shipped template resources retain their `meta`, `slots`, `params` and skeleton
contract, and also expose `exampleSpec`, a complete runnable envelope including
query-scoped measures. Preserve `exampleSpec.measures` when using an example;
copying only the skeleton loses its query definitions. Stress-round authorship
creates new specs independently rather than using those examples as starting files.


Facet repeat panels additionally expose `last`, `lastLabel`, `sum`, `max` and `avg` for their own data. `last` is the latest finite observation in the facet category order, not necessarily the last calendar period if that period is null. `lastLabel` uses the same deterministic thousands formatting as measure slots. Group summaries must not be confused with population/model statistics beyond the returned query window.


### Bounded detail and proportional layouts

These transforms operate on the returned query rows, not an unseen model population. Aggregations in `chunk`, `top`, and `allocate` require additive values evaluated at the intended grain; never sum ratios/distinct counts as a substitute for a model measure. Empty input produces empty arrays.

- `{"points":{"fields":["raw","category"],"numeric":["raw"],"name":"category"},"as":"dots"}` exposes `.data`: `{name,value:[...],rowIndexes:[sourceIndex]}`. It preserves every input row without grouping; explicit numeric fields coerce finite numbers, missing/invalid values become null. One to six fields.
- `{"chunk":{"category":"category","value":"amount","size":6,"columns":3},"as":"wrapped"}` aggregates duplicate categories and splits every resulting category into successive panels. `.panels` exposes index/name/categories/data/left/top/width/height, compatible with bounded repeat. Size 1?1000; columns 1?6; exceeding 36 panels is an error.
- `{"top":{"category":"category","value":"amount","count":5,"other":"Other"},"as":"buckets"}` exposes `.pieData`, `.categories`, `.values`. Sort descending by aggregated value; ties keep first-seen order. The remaining categories become one bucket with all contributing identities. A bucket label colliding with a retained category is an explicit error; count 1?10000.
- `{"allocate":{"category":"category","value":"amount","total":100,"layout":"grid","columns":10},"as":"seats"}` exposes `.groups` (name/value/index/seats/data/rowIndexes) and `.total`. Use repeat over groups to create named scatter series. Layout `grid` uses integer cell coordinates; `hemicycle` uses deterministic concentric semicircles in x ?1..1, y 0..1. Hamilton largest remainders allocate exactly the requested mark count, stable ties. These are rounded proportional representations, not actual parliamentary seat records. Nonnegative weights required; zero total produces no marks. Total 1?2000, columns 1?100, 20000 maximum expanded selection-lineage entries. Aggregation overflow refuses with a rescale instruction. No executable callbacks.


### Financial sequence transforms

- `{"waterfall":{"category":"country","detail":"category","value":"profit","subtotals":true},"as":"steps"}` groups interleaved category rows, aggregates repeated category/detail contributions, and inserts **cumulative** boundary totals (labelled `country ? cumulative`, not standalone country totals). Omit detail/subtotals for a simple ordered category bridge. It exposes `.categories` and `.base`, `.positive`, `.negative`, `.totals`, `.endpoints` arrays of `{value,rowIndexes}`. Use helper base and all segment bar series in the same stack with `stackStrategy:"all"`, including the invisible helper, so negative baselines and crossings of zero remain correct. Increase/decrease heights are positive magnitudes from the lesser endpoint; total bars are signed from zero. A step line over endpoints can show bridge connectors.
- Optional `start:"priorGlobal"` requires a finite, identical start measure across returned rows; it inserts a Start bar. `total:true` inserts a final Total bar. `startLabel`/`totalLabel` are bounded plain labels. Start has no category selection; contribution bars retain their input rows, cumulative/final totals retain all contributing rows. Input/output arithmetic overflow is refused. Maximum 10000 output bars and 20000 expanded source-lineage entries. Values must be additive; missing contributions are omitted, and no contributions yield an empty result.
- `{"heikinAshi":{"open":"open","close":"close","low":"low","high":"high"},"as":"ha"}` exposes `.data` objects with `[HA-open,HA-close,HA-low,HA-high]`, source row identity and date/category name. Inputs must already be ordered chronologically (declare a time slot). HA-close is the four-value mean; initial HA-open is the open/close mean, subsequent HA-open is the previous HA-open/HA-close mean. High/low include the derived endpoints. Missing values produce a null bar and restart recursion at the next valid bar; inconsistent OHLC bounds are explicit errors. This is a fixed core algorithm, not template-supplied imperative logic.

These operations shape the returned query window. A limited preview starts its recursion at its first sampled observation; this can differ from the full host window. Never interpret the first sampled Heikin-Ashi candle as proof of a full-history seed.


`explain_visual` and `preview_visual` accept matching `maxRows` (1-10000, default 200). Use the same explicit value for both. Preview returns its selected bound and warns if it reaches it; a bound is never proof of full population coverage. For recursive Heikin-Ashi and statistics, request the complete available bounded window (for example 10000 for the 911-date QA model) before comparing with Desktop. The host data reduction remains independently bounded at 2000; neither operation writes the model.

Waterfall inactive stack channels use numeric zero, not null, because ECharts 6 can stop accumulating a stack after a null intermediate segment and omit valid totals. Zero-height placeholders retain the exact baseline and do not fabricate contributions. Real missing input contributions are still omitted; Heikin-Ashi null gaps remain null.
# Renderer compatibility

`commit_visual` refuses new features when the report already registers an older
vilsem Renderer. It leaves existing resources untouched; import the updated
renderer package in Desktop, then retry. `validate_visuals` reports the same
incompatibility for Vilsem visuals only. Features introduced in this round need
4.15 (scoped measures, six measure roles, concat/stat and additional chart
components), 4.16 (points/chunk/top/allocate), 4.17 (Heikin-Ashi), or 4.18
(waterfall with correctly rendered subtotal/start/end stacks).

Renderer 4.20 adds tuple formatters `{value.0}` through `{value.5}` (also
`{c.0}`..`{c.5}`), with optional `:thousands`, `:percent`, or `:date`. Indexes
outside 0..5 are rejected; missing/null elements display blank, while numeric
zero remains zero. Existing `{value}` still selects the last tuple component.
For example a two-measure treemap can use tooltip `formatterTemplate`:
`{name} | Revenue {value.0:thousands} | Profit {value.1:thousands}`.
Native Power BI host tooltips honour the same resolved formatter and preserve
selection identities/report-page tooltip routing. Without an explicit formatter,
tuple numbers use grouped formatting and nulls display `(Blank)`.

## Hierarchy colour and bounded layouts (renderer 4.19+)

`{"hierarchy":{"levels":["category","subcategory"],"value":"revenue","color":"profit"},"as":"h"}`
emits `children` with two-dimensional `[sumRevenue,sumProfit]` values. Set a
treemap's `visualDimension:1` to colour independently from area. Both measures
must be additive at the supplied leaf grain; this does not aggregate ratios.

Optional `layout:"partition"` adds `nodes` with `id,name,value,depth,rowIndexes`,
normalized `offset/span`, and aligned `base/data` arrays for stacked horizontal
bars at each depth. Optional `layout:"pack",size:400` adds packed
`cx,cy,radius,diameter,data` (scatter data with per-point symbolSize). Match
scatter grid width/height to size, use axes 0..size, and fit that square inside
the authored visual. `size` is finite 1..2000, default 400. Empty/zero input yields
no nodes; negative size weights fail. Layouts are bounded to 2000 nodes and
20000 lineage entries. Only leaves contribute to sums, so parents are never
double-counted. Deterministic D3 hierarchy algorithms run in our trusted core;
templates still cannot execute callbacks. Circle areas compare leaves; enclosing
parent circles include packing space and are not an exact aggregate-area scale.
Algorithm references: [D3 partition](https://d3js.org/d3-hierarchy/partition) and
[D3 circle packing](https://d3js.org/d3-hierarchy/pack).



## Multi-stage flows and graph coordinates (renderer 4.22+)

`{"flows":{"levels":["country","category","subcategory"],"value":"revenue","order":"value"},"as":"flow"}`
adds `.nodes` and `.links` for 2..6 categorical stages. Each row contributes its
nonnegative additive weight once to each stage and adjacent link. Intermediate
nodes therefore preserve flow conservation. Labels repeated at different stages
remain distinct via depth-scoped IDs. Node names are IDs; use
`formatterTemplate:"{label}"` for human labels. `order:"value"` sorts nodes
within each stage by decreasing weight with stable ties. For a Sankey preserving
this order, set `layoutIterations:0`; otherwise ECharts may reorder nodes to
reduce crossings. See the [Apache Sankey options](https://apache.googlesource.com/echarts-website/+/b3f88a6049c8206c87aa08c5bec7cfbb11b8fc94/en/documents/option-parts/option.series-sankey.json).

Optional `layout:"line"` gives nodes deterministic x=index*100,y=0 coordinates
for graph arc diagrams. `layout:"bipartite"` requires exactly two stages and
places them at x=0/600 with evenly spaced y in 0..400. For native graph series,
use `layout:"none"`. All nodes expose a bounded 10..42 `symbolSize`, scaled by
the square root of their share of the largest node weight. Circular/force
layouts can instead be supplied by the native ECharts graph series. Chord is
registered in the native renderer as an ECharts 6 series; it uses these same
nodes/links. No caller callbacks or renderItem are introduced.

Zero/missing/non-finite weights are omitted; negatives and finite-sum overflow
are explicit errors. Limits: 2000 nodes, 10000 links, 20000 expanded source-row
identities across nodes and links. Every aggregate retains its contributing
`rowIndexes` for Power BI interactions. These operations only summarize the
returned bounded query window, not an unseen full population.

Facet repeat panels now also expose `.values` (aligned numeric/null vector)
and `.rowIndexes` (all contributing panel rows), useful for radar series. A
radar polygon represents the whole panel identity; individual spokes do not
create independent source marks.

Within a bounded repeat, `$item` copies the current scalar/object as data. For example `radar.indicator:{repeat:"$slot.country.categories",template:{name:"$item"}}`. Bare `$item` outside a repeat is an error. Field paths still reject unknown/prototype properties. Native fixed-line graphs should use `preserveAspect:true`; non-uniform view scaling stretches collinear graph symbols and arcs.

Renderer 4.23 fixes source-identified graph/Sankey/chord edge selection: unrelated edges dim relative to authored line opacity and clear restores the original option. Flow links also expose a human `label` (source to target), supported by `{label}`. Native radar tooltips without an explicit formatter use the matching radar panel indicator names and values (up to 50, then an explicit omitted count), preserving nulls, zeros and identities. Avoid a generic `{value}` formatter for an entire radar polygon: that legacy scalar accessor selects the final tuple component. Explicit formatters still take precedence.

Renderer 4.24 adds `$calc.<facet>.indicators`: ordered `{name,min,max}` domains shared across all facet panels, matching each panel values vector. Use this as every radar panel indicator array to compare countries/categories with consistent axes. Domains include zero, preserve negative bounds, and use 0..1 for all-zero axes. They describe the returned query window, and recompute after filtering. Facet expansion now explicitly refuses more than 20000 aligned panel/category cells before allocating missing records.

Renderer 4.25 adds bounded repeat over normalized `points.data` records: `$item.name`, `$item.value`, safe tuple indexes and `$item.rowIndexes`, or bare `$item` to copy the record. Prototype path segments fail validation. Optional `points.sample:N` (1..10000) chooses deterministic evenly spaced rows, including first/last when N>1, from the returned query window; it preserves original source indexes. This is not statistical sampling of the unseen model population. Point count follows actual field-vector lengths, so limiting all inputs does not create phantom null marks.

## Stream and interval shaping (renderer 4.25+)

`{"stream":{"by":"country","category":"date","value":"revenue","offset":"wiggle"},"as":"stream"}`
aggregates nonnegative additive weights into aligned category/layer cells. Categories
retain input order; use a time slot or sort the query for chronological order.
`offset` is `wiggle` (default, weighted slope minimization) or `silhouette`
(centered). Trusted [D3 stack offsets](https://d3js.org/d3-shape/stack#stackOffsetWiggle)
and inside-out ordering compute the layout, with normalized intermediates to
avoid overflow. Output `.categories`, `.baseline` and `.panels` (each `name`,
`index`, `data`) are in stack order. Render baseline as a silent invisible line,
then repeat the panels as area lines, all with the same `stack` and
`stackStrategy:"all"`. Baseline values can be negative. Panel data contains
original weights, not cumulative boundaries; ECharts performs the stacking.
Missing cells become zero with no invented identities. Limits: 36 layers,
20000 aligned cells and 20000 expanded lineage entries. Negative weights or
non-finite aggregates/layouts fail with a precise error. Empty input returns
empty arrays. This summarizes the returned query window only.

`{"intervals":{"group":"country","category":"order","start":"stockDate","end":"orderDate","limit":16},"as":"tasks"}`
provides a bounded Gantt overview. `group` is optional; `limit` is 1..1000
(default 1000). Renderer 4.26 accepts strict ISO dates, zoned timestamps, timezone-free
Tabular model DateTime strings (including ADOMD seven-digit fractions), or finite
epoch milliseconds. Timezone-free model wall clocks use UTC consistently across
hosts; sub-millisecond digits are truncated. Invalid clock fields are refused. Missing endpoints are skipped; invalid/reversed endpoints
are errors identifying the source row. Selection is round-robin across groups,
earliest start first within each group, then displayed in group/start order.
This does not assert task ownership or a complete model population.

Outputs `.categories`, `.base`, `.duration`, `.milestones`, `.min`, `.max`,
`.total`, `.shown`, `.skipped`, `.omitted` and `.summary` describe the selected
overview. Base/duration data records include human UTC `label` and original
`rowIndexes`; use `{label}` for tooltips. Stack invisible base + visible duration
bars with `stackStrategy:"all"`. Overlay `.milestones` as scatter diamonds so
zero-duration records remain visible. These points contain
`[epochMilliseconds, categoryIndex]`. Equal extents expand by 12 hours, empty
extents are null. Show `.summary` to disclose truncation. No model writes,
arbitrary expressions or caller callbacks are introduced.

## Stage conversion, calendar bands and EWMA (renderer 4.27+)

`{"conversion":{"category":"stage","value":"amount"},"as":"stages"}`
aggregates nonnegative additive values by category, preserving first-seen order.
It returns `.data` records with `name`, `value`, `conversion`, human `label` and
original `rowIndexes`. `conversion` is value / previous-stage value; the first
stage and a zero prior stage have null conversion, with explicit labels instead
of Infinity. Values above 100% are allowed; this operation does not establish
that arbitrary categories form a genuine sales pipeline. Use funnel data
`$calc.stages.data`, `sort:"none"`, and `{label}` for conversion labels.
Limits: 2000 stages, 10000 input rows; negative, aggregate/ratio/percentage
overflow is refused. It summarizes only the returned query window.

`{"dateBands":{"field":"date","weekdays":[0,6]},"as":"weekends"}`
returns `.areas`, suitable for `markArea.data`. Weekdays use UTC Sunday=0 through
Saturday=6. The operation groups duplicate calendar dates and merges adjacent
selected dates into half-open start/end epoch ranges. It does not fill dates
that are absent from the query or infer holidays. Missing dates are skipped;
invalid dates fail with the source row. Calendar-date prefixes from Tabular
DateTime strings are accepted. Up to 5000 bands, within the 10000-row input bound.
Bands contain source identities but should normally be `silent:true` decoration.

`{"window":{"field":"revenue","op":"ewma","alpha":0.3,"orderBy":"date","partitionBy":"country"},"as":"smooth"}`
returns the existing `.values`/scalar shape. `partitionBy` and `orderBy` are
optional. Alpha must be finite, greater than zero and at most one. Each
partition seeds from its first finite observation, then computes
`alpha * current + (1-alpha) * previous`. A missing observation emits null and
retains the previous smoothing state; zero is an observation. Results retain
the original row positions. Sort order follows the existing window semantics;
use ISO dates for time. No caller expressions or executable callbacks are used.

## Distribution shaping (renderer 4.28+, source implementation under live test)

`{"histogram":{"field":"price","bins":"auto"},"as":"bins"}` returns
`.categories`, `.data` and `.count`. Each finite input row is one observation;
this does not weight observations by a sales measure. Numeric strings in dimension
slots are accepted, missing/non-finite values omitted. Data records contain bin
`name`, count `value`, `lower`, `upper` and original `rowIndexes`. Intervals are
left-closed/right-open except the final bin, which includes the maximum.
Auto mode uses a Freedman-Diaconis count (Sturges fallback for zero IQR), capped
at 200. An integer `bins:1..200` sets the count. Alternatively `width` sets a
positive width, or `widthParam:"binWidth"` references a declared numeric parameter.
Only one bin mode may be supplied. Width bins start at the returned minimum;
the last interval ends at the returned maximum. More than 200 width bins is an
explicit error. Constant data produces one bin; empty input produces none.
All summaries describe the bounded returned rows, not the unseen population.
Algorithm background: [D3 binning](https://d3js.org/d3-array/bin).

`{"boxplot":{"by":"subcategory","field":"price","whisker":1.5},"as":"box"}`
returns `.categories`, `.boxes` and `.outliers`. Group order follows input order.
Quartiles use [R7 interpolation](https://d3js.org/d3-array/summarize#quantileSorted);
whiskers are the extreme observed values inside Q1/Q3 plus/minus the specified
IQR multiple (default1.5, range0..10). Box records contain
`[lowerWhisker,Q1,median,Q3,upperWhisker]` and the group's source identities.
Outlier records contain `[categoryIndex,value]` and their individual identity.
Limit2000 groups/10000 input rows. Empty groups are omitted; singleton boxes
retain their actual value.

`{"ecdf":{"field":"price"},"as":"cdf"}` returns `.data` and `.count`.
It starts at `[minimum,0]` with no identity, then has one point per distinct
observed value `[value,cumulativeCount/N]`. Render with `step:"end"`.
Tied observations share a point. Selecting that point selects observations at
that exact value, not every preceding observation; cumulative identities are
not expanded quadratically.

`stat` optionally accepts `records:true`. In addition to its existing aligned
vector/scalars it returns `.data` with one `{name,value,rowIndexes}` record per
partition, suitable for group mean markers. Only finite contributing rows are
included in record identities. Statistic means, quantiles and deviations use
normalized intermediates; unrepresentable results are explicit errors asking
for rescaled input. No random sampling, model writes or executable callbacks
are introduced. Native package/live acceptance for these additions is still
pending in the ongoing stress round.

### Density and collision layout (4.28+, native acceptance pending)

`{"density":{"by":"subcategory","field":"price","layout":"violin","samples":64},"as":"density"}`
returns `.panels`, `.categories`, value-domain `.min`/`.max` and `.groupMax`.
Each panel has `name`, `index`, `data`, positive `bandwidth` and contributing
`rowIndexes`. The fixed trusted estimator uses a Gaussian kernel truncated at
four bandwidths and normalized by the retained mass. The default bandwidth is a
normal-reference heuristic based on sample deviation and IQR; constant groups
have a positive fallback. It is not bit-identical to R's estimator. See
[R bandwidth documentation](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/bandwidth.html).
An explicit positive `bandwidth` is in input-value units. `samples` is16..256,
groups at most36, and expansion/contributor identities at most20000, checked
before excessive allocation. Non-finite bounds/results and a grid that misses
all kernel peaks are explicit errors, not blank successful charts.

Violin data forms a closed, mirrored `[groupIndex +/- peakScaledDensity,value]`
path; line+area can render it without `renderItem` if the native geometry check
passes. Widths normalize each group's peak to0.4, not group sample count.
`layout:"ridgeline"` instead gives `[value,groupIndex + peakScaledDensity*0.8]`;
set each repeated line's `areaStyle.origin` to `$item.index`. Point `label`
provides group/value/density text; `{label}` is suitable for tooltips. Only rows
within kernel support belong to a point's identities. Empty tails have no
invented source identity. These are estimates from returned rows, not model
measures, confidence bounds or observations outside the source range.

`{"jitter":{"by":"subcategory","field":"price","name":"product","method":"collision","width":700,"height":420,"radius":3},"as":"swarm"}`
preserves each finite original x value and row identity, assigning deterministic
vertical offsets within category bands. `name` is optional. Output `.data`
contains `[originalValue,pixelY]`, human `label`, `name` and `rowIndexes`;
`.groups` provides names, band-center `value` and group identities. Set the
scatter `symbolSize` to `$calc.swarm.symbolSize`: the algorithm may reduce the
requested radius to fit, down to1 pixel, and refuses layouts that still cannot
fit. It never silently overlaps or randomly moves x values.

Use a matching fixed-size plot grid and x-domain `.min`/`.max`, y-domain
0..`.height`. The x-domain includes mark padding. This is an explicitly sized
layout; changing plot dimensions requires recomputing with matching dimensions.
It is not a claim of automatic responsive collision preservation. Width/height
are100..2000, radius1..12; limits2000 points,36 groups and2million collision
checks. All bounds/density refusals ask for filtered/rescaled input or a larger
viewport. No caller callbacks, randomness or sandbox privileges are introduced.

### Strict ranking and current-period KPI values (4.28+)

`top` retains its existing Other bucket by default. Set `other:false` to return
only the requested ranked items. A string `other` still sets the tail label.
This lets ranked lists omit the aggregate tail while donuts keep it.

Numeric slots and scalar/vector transform outputs expose `.lastRowValue` and
`.lastRowLabel`. These refer to the final aligned row, including a null value;
they do not scan backward for an older finite value. Existing `.last` and
`.lastLabel` retain their legacy finite-value behavior. Use positional accessors
when a current-period value must not accidentally reuse an older result.

A formatter node may include `formatterEmptyText:"No prior month"` alongside
`formatterTemplate`. It is a literal string of at most200 characters and is
compiled into the trusted formatter, then omitted from the ECharts option.
Null, empty and non-finite numeric values use this fallback; zero remains a
number. The default fallback is the existing empty string. ECharts rich-text
styles may style a fallback in a compatible consumer; they cannot run callbacks.

The shipped KPI fixture evaluates previous-calendar-month revenue in query-only
DAX, retaining non-date report filters. Its change measure is blank when there
is no prior revenue, and is blank when the current revenue is absent, so it does
not invent a future month. The current-row change is displayed with an explicit
no-prior state and positive/negative/neutral formatting. This requires live model
and native verification before acceptance in the ongoing stress round.

## Bounded statistical operations (renderer 4.29)

These trusted core transforms accept slot/earlier-transform field names, preserve
source `rowIndexes`, run without callbacks, and require renderer4.29 at commit.
The input limit remains10000 rows. Output expansion is at most20000 cells and
20000 contributor identities; exceeding a bound gives a precise refusal.

| Transform | Inputs | Output / semantics |
| --- | --- | --- |
| `qq` | `{field}` | `data` of `[normal quantile, observed value]`, `count`; finite observations sorted stably, plotting positions `(i+0.5)/n`. Standard normal CDF inversion uses the A&S26.2.17 approximation; suitable for QQ geometry, not inferential p-values. |
| `hexbin` | `{x,y,bins:24}` | Axial hexagonal bins in independently normalized x/y domains; `data:[{value:[xCentre,yCentre,count],rowIndexes}]`, `max`. Bins4..64; each finite observation contributes exactly once. Fixed declarative hex symbols render the counts. |
| `density2d` | `{x,y,bins:24}` | Fixed Gaussian kernel evaluated at a regular normalized grid; bandwidth `max(1/bins,0.15*n^(-1/6))`, radial cutoff4h. Values are density per normalized unit square, not raw-unit density or probability per cell. At most2million kernel evaluations. Finite points within4h supply local identities. No arbitrary contours/callbacks. |
| `groupShare` | `{by,category,value,subtotals:true}` | Additive nonnegative values grouped then normalized within each group; `categories`, `data`. Optional subtotal rows carry `subtotal` and value1, with a total in the label. Zero-total groups are null. |
| `conditional` | `{value,condition,label?,labelFormat:"percent",positive?,negative?,zero?}` | `data` with bound value, formatted `label`, sign-derived `itemStyle.color`, identities. Colours are six-digit hex; zero/missing condition is neutral. Label format is `number` or `percent`. |
| `rebase` | `{field,partitionBy,orderBy,base:100}` | Aligned numeric accessor object; each group uses its chronologically first finite nonzero observation as divisor. Zero-only groups stay null. Base within +/-1000000. |
| `pivot` | `{row,column,value}` | Additive long-to-wide `rows`, `columns`, heatmap `data` `[columnIndex,rowIndex,value]`, `max`. Duplicates sum; absent cells are null, actual zero stays zero. |
| `correlation` | `{fields:[...],names?:[...]}` |2..6 fields; pairwise-complete Pearson `data` `[xIndex,yIndex,r]`, `categories`. Constant/insufficient pairs are null; each cell includes its pairwise `count` and row identities. Normalized intermediates avoid overflow. |
| `cohort` | `{date,entity,value,firstDay,maxPeriods:36}` | Positive activity, UTC first-purchase day since1970 supplied by a query-only measure. Distinct observed entities form cohort membership; duplicates do not inflate retention. `cohorts`, numeric `periods`, heatmap `data`, per-cell `cohortSize`; maxPeriods1..120. **Membership is limited to the returned query/filter window**. It does not infer customers missing from a truncated host window. Missing cells remain null. Author an explicit caption and query an appropriate complete cohort before population-level interpretation. |
| `pareto` | `{category,value,threshold:0.8}` | Aggregate/sort nonnegative additive values, return `categories`, source-identified `data`, normalized `cumulative`, and minimal `thresholdCount` reaching threshold0..1. Empty/zero totals yield count0. |

`top` additionally accepts `countParam:"topN"` instead of literal `count`.
The parameter must be declared numeric and resolve to an integer1..10000;
all existing literal-count and Other-bucket semantics remain unchanged.

Mathematical references: [NIST normal distribution](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm)
and the original author's [hex-coordinate and rounding algorithms](https://www.redblobgames.com/grids/hexagons/).
The 4.29 statistical examples remain under live acceptance; documentation of an
operation is not a claim that every authored chart has passed Desktop QA.

`tiles:{category,value,positions:[{name,x,y},...]}` adds a fixed categorical
tile-grid layout. Positions1..2000 must have unique names and cells, with integer
coordinates within +/-1000. Category values aggregate additively; every returned
category must have an explicit position, otherwise the operation refuses rather
than inventing a geocode. Output `data` contains `[x,y,value]`, names and source
identities; `max` is the maximum aggregate. A native heatmap can render this grid
without external map assets. Coordinates are an authored layout, not measured
latitude/longitude.

Unavailable geo maps and unshipped series types (including wordCloud, GL/3D,
and callback-based custom series) are rejected explicitly during validation and
after token resolution. Unsupported combinations cannot silently commit a blank
visual. No maps, extension scripts, remote code or GL plugins are loaded.

## Word packing (renderer4.31) and dense heatmap cells (renderer4.30)

`words:{text,weight,limit:24,width:750,height:400,minFont:12,maxFont:36}`
normalizes NFKC/lowercase Unicode letter/number terms,2..40 code points, and adds
each positive additive row weight once per distinct term in that row. It is
revenue-weighted word occurrence, not a partition of total revenue. Negative
weights refuse; null/zero weights skip. `limit`1..100 selects ranked terms;
`omittedCount` discloses terms outside that limit. At most20000 source identities,
2000 placement candidates per word and2million collision checks are permitted.
Impossible layouts refuse rather than hide words or overlap them silently.

Output `data` is ordinary graph-node data with `[x,y,weight]`, `name`, identities,
conservative `bounds`, and fixed Segoe UI labels whose font sizes reflect weight.
`width`, `height` and `count` are scalars. Render with a `graph` on numeric
`cartesian2d` axes fixed0..width and0..height; use a grid matching those explicit
pixel dimensions and inverse y. The no-overlap guarantee applies to that fixed
plot/font; changing the viewport/grid/font requires re-authoring its dimensions.
No wordCloud plugin, callbacks, randomness, browser measurements or custom
series are needed. Term tie ordering is deterministic Unicode lexical order.
The word feature requires4.31 so native selection preserves invisible symbols,
dims unrelated labels and restores authored opacity on deselection. Helper
series and per-item label/mark opacity are multiplied by the selection factor,
never replaced with an opaque mark merely because selection is active.

`density2d` retains its raw XY `data` and additionally exposes `columns`, `rows`
and `cells` for a true category-axis heatmap. Each `cells` record contains
`[columnIndex,rowIndex,density]`, local contributor identities and a formatted
coordinate/density `label`. Empty input supplies all three empty arrays. This
avoids fixed-size scatter-symbol gaps; new heatmap-cell consumers require4.30.

Partition hierarchy nodes additionally expose `pixelSpan`, `labelWidth` and
`labelVisible` for opt-in bounded labels. `hierarchy.size` declares the exact
plot width used for normalized spans (default400); `pixelSpan=span*size`,
`labelWidth=max(0,pixelSpan-8)`, `labelVisible=labelWidth>=32`. A consumer can
bind these to label width/show, use `overflow:"truncate"` and hide overlaps.
Match the declared size to a fixed grid width; existing node geometry/labels
are unchanged unless these new fields are consumed. Tooltips/selection retain
the complete source identity when a tiny mark's text is hidden.

## Stress2 transform examples by item

These fragments are copied from passing shipped specs. Slot and calc names retain their original context; follow the complete-example link for its slot declarations, preceding transforms and bindings. All items below have native screenshot provenance in the Round2 matrix.

### `allocate` â€” items 23, 24

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-023-waffle-share.vilsem-visual.json). Regression: `stress2-layout-shaping.test.js`.

```json
{
  "allocate": {
    "category": "date",
    "value": "m0",
    "total": 100,
    "layout": "grid",
    "columns": 10
  },
  "as": "seats"
}
```

### `boxplot` â€” items 91

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-091-box-detail-prices.vilsem-visual.json). Regression: `stress2-distribution-shaping.test.js`.

```json
{
  "boxplot": {
    "by": "subcategory",
    "field": "price",
    "whisker": 1.5
  },
  "as": "box"
}
```

### `calculate` â€” items 4, 5, 6, 14, 28, 29, 32, 33, 36, 59, 67, 74, 75, 79

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-004-confidence-band.vilsem-visual.json). Regression: `instantiateVisual.test.js`.

```json
{
  "calculate": "m1-m0",
  "as": "span"
}
```

### `chunk` â€” items 15

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-015-wrapped-bar.vilsem-visual.json). Regression: `stress2-layout-shaping.test.js`.

```json
{
  "chunk": {
    "category": "date",
    "value": "m0",
    "size": 6,
    "columns": 3
  },
  "as": "wrapped"
}
```

### `cohort` â€” items 105

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-105-cohort-retention.vilsem-visual.json). Regression: `stress2-statistical-shaping.test.js`.

```json
{
  "cohort": {
    "date": "month",
    "entity": "customer",
    "value": "activity",
    "firstDay": "firstPurchase",
    "maxPeriods": 36
  },
  "as": "retention"
}
```

### `conditional` â€” items 102

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-102-yoy-variance.vilsem-visual.json). Regression: `stress2-statistical-shaping.test.js`.

```json
{
  "conditional": {
    "value": "current",
    "condition": "variance",
    "label": "variance",
    "positive": "#2dd4bf",
    "negative": "#f87171",
    "zero": "#94a3b8",
    "labelFormat": "percent"
  },
  "as": "coloured"
}
```

### `conversion` â€” items 73

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-073-funnel-conversion.vilsem-visual.json). Regression: `stress2-analytic-shaping.test.js`.

```json
{
  "conversion": {
    "category": "category",
    "value": "revenue"
  },
  "as": "stages"
}
```

### `correlation` â€” items 107

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-107-pearson-six.vilsem-visual.json). Regression: `stress2-statistical-shaping.test.js`.

```json
{
  "correlation": {
    "fields": [
      "m0",
      "m1",
      "m2",
      "m3",
      "m4",
      "m5"
    ],
    "names": [
      "Total Revenue",
      "Total Profit",
      "Total Cost",
      "Total Orders",
      "Quantity Sold",
      "Total Customers"
    ]
  },
  "as": "correlation"
}
```

### `date` â€” items 72, 77

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-072-event-timeline.vilsem-visual.json). Regression: `instantiateVisual.test.js`.

```json
{
  "date": {
    "field": "date"
  },
  "as": "dates"
}
```

### `dateBands` â€” items 77

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-077-weekend-bands.vilsem-visual.json). Regression: `stress2-analytic-shaping.test.js`.

```json
{
  "dateBands": {
    "field": "date",
    "weekdays": [
      0,
      6
    ]
  },
  "as": "weekends"
}
```

### `density` â€” items 92, 96

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-092-violin-density.vilsem-visual.json). Regression: `stress2-density-shaping.test.js`.

```json
{
  "density": {
    "by": "subcategory",
    "field": "price",
    "layout": "violin",
    "samples": 64
  },
  "as": "density"
}
```

### `density2d` â€” items 99

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-099-density2d-price-cost.vilsem-visual.json). Regression: `stress2-statistical-shaping.test.js`.

```json
{
  "density2d": {
    "x": "price",
    "y": "cost",
    "bins": 24
  },
  "as": "binned"
}
```

### `ecdf` â€” items 95

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-095-ecdf.vilsem-visual.json). Regression: `stress2-distribution-shaping.test.js`.

```json
{
  "ecdf": {
    "field": "price"
  },
  "as": "cdf"
}
```

### `facet` â€” items 6, 7, 59, 60, 66, 69, 70, 83, 84, 103

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-006-horizon.vilsem-visual.json). Regression: `instantiateVisual.test.js`.

```json
{
  "facet": {
    "by": "country",
    "category": "date",
    "value": "band0",
    "columns": 1,
    "maxPanels": 8
  },
  "as": "f0"
}
```

### `flows` â€” items 49, 50, 51, 52, 53, 54, 55, 56, 58

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-049-sankey-two-levels.vilsem-visual.json). Regression: `stress2-flow-shaping.test.js`.

```json
{
  "flows": {
    "levels": [
      "d0",
      "d1"
    ],
    "value": "revenue",
    "order": "input"
  },
  "as": "flow"
}
```

### `groupShare` â€” items 101

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-101-group-percent-subtotals.vilsem-visual.json). Regression: `stress2-statistical-shaping.test.js`.

```json
{
  "groupShare": {
    "by": "country",
    "category": "category",
    "value": "revenue",
    "subtotals": true
  },
  "as": "shares"
}
```

### `heikinAshi` â€” items 35

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-035-heikin-ashi.vilsem-visual.json). Regression: `stress2-sequence-shaping.test.js`.

```json
{
  "heikinAshi": {
    "open": "m0",
    "close": "m1",
    "low": "m2",
    "high": "m3"
  },
  "as": "ohlc"
}
```

### `hexbin` â€” items 98

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-098-hexbin-price-cost.vilsem-visual.json). Regression: `stress2-statistical-shaping.test.js`.

```json
{
  "hexbin": {
    "x": "price",
    "y": "cost",
    "bins": 24
  },
  "as": "binned"
}
```

### `hierarchy` â€” items 20, 40, 41, 42, 43, 44, 45, 46, 47, 48, 118

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-020-nested-donut.vilsem-visual.json). Regression: `stress2-hierarchy-color.test.js`.

```json
{
  "hierarchy": {
    "levels": [
      "category",
      "subcategory"
    ],
    "value": "revenue"
  },
  "as": "tree"
}
```

### `histogram` â€” items 89, 90, 110

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-089-histogram-auto.vilsem-visual.json). Regression: `stress2-distribution-shaping.test.js`.

```json
{
  "histogram": {
    "field": "price",
    "bins": "auto"
  },
  "as": "bins"
}
```

### `intervals` â€” items 71

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-071-gantt-country.vilsem-visual.json). Regression: `stress2-temporal-shaping.test.js`.

```json
{
  "intervals": {
    "group": "owner",
    "category": "order",
    "start": "start",
    "end": "end",
    "limit": 16
  },
  "as": "tasks"
}
```

### `jitter` â€” items 93

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-093-beeswarm.vilsem-visual.json). Regression: `stress2-jitter-shaping.test.js`.

```json
{
  "jitter": {
    "by": "category",
    "field": "price",
    "name": "product",
    "method": "collision",
    "width": 700,
    "height": 420,
    "radius": 3
  },
  "as": "swarm"
}
```

### `pareto` â€” items 108

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-108-pareto-count.vilsem-visual.json). Regression: `stress2-statistical-shaping.test.js`.

```json
{
  "pareto": {
    "category": "subcategory",
    "value": "revenue",
    "threshold": 0.8
  },
  "as": "pareto"
}
```

### `pivot` â€” items 106

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-106-pivot-heatmap.vilsem-visual.json). Regression: `stress2-statistical-shaping.test.js`.

```json
{
  "pivot": {
    "row": "country",
    "column": "category",
    "value": "revenue"
  },
  "as": "pivot"
}
```

### `points` â€” items 16, 25, 34, 61, 62, 63, 64, 65, 67, 72, 75, 77, 78, 81, 82, 94

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-016-revenue-strip.vilsem-visual.json). Regression: `stress2-layout-shaping.test.js`.

```json
{
  "points": {
    "fields": [
      "raw",
      "group"
    ],
    "numeric": [
      "raw"
    ],
    "name": "group"
  },
  "as": "dots"
}
```

### `qq` â€” items 97

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-097-normal-qq.vilsem-visual.json). Regression: `stress2-statistical-shaping.test.js`.

```json
{
  "qq": {
    "field": "price"
  },
  "as": "qq"
}
```

### `rebase` â€” items 103

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-103-rebase-index.vilsem-visual.json). Regression: `stress2-statistical-shaping.test.js`.

```json
{
  "rebase": {
    "field": "revenue",
    "partitionBy": "country",
    "orderBy": "month",
    "base": 100
  },
  "as": "indexed"
}
```

### `stat` â€” items 6, 36, 62, 75, 79, 94

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-006-horizon.vilsem-visual.json). Regression: `instantiateVisual.test.js`.

```json
{
  "stat": {
    "field": "revenue",
    "op": "max"
  },
  "as": "peak"
}
```

### `stream` â€” items 68

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-068-wiggle-streamgraph.vilsem-visual.json). Regression: `stress2-temporal-shaping.test.js`.

```json
{
  "stream": {
    "by": "country",
    "category": "date",
    "value": "revenue",
    "offset": "wiggle"
  },
  "as": "stream"
}
```

### `tiles` â€” items 115

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-115-country-tile-grid.vilsem-visual.json). Regression: `stress2-statistical-shaping.test.js`.

```json
{
  "tiles": {
    "category": "country",
    "value": "revenue",
    "positions": [
      {
        "name": "Canada",
        "x": 0,
        "y": 2
      },
      {
        "name": "United States",
        "x": 0,
        "y": 1
      },
      {
        "name": "United Kingdom",
        "x": 2,
        "y": 2
      },
      {
        "name": "France",
        "x": 2,
        "y": 1
      },
      {
        "name": "Germany",
        "x": 3,
        "y": 1
      },
      {
        "name": "Australia",
        "x": 4,
        "y": 0
      }
    ]
  },
  "as": "tiles"
}
```

### `top` â€” items 21, 86, 100

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-021-pie-top-other.vilsem-visual.json). Regression: `stress2-layout-shaping.test.js`.

```json
{
  "top": {
    "category": "date",
    "value": "m0",
    "count": 5,
    "other": "Other"
  },
  "as": "buckets"
}
```

### `waterfall` â€” items 31, 33

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-031-waterfall-subtotals.vilsem-visual.json). Regression: `stress2-sequence-shaping.test.js`.

```json
{
  "waterfall": {
    "category": "country",
    "detail": "category",
    "value": "profit",
    "subtotals": true
  },
  "as": "steps"
}
```

### `window` â€” items 30, 32, 69, 70, 80

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-030-pareto.vilsem-visual.json). Regression: `instantiateVisual.test.js`.

```json
{
  "window": {
    "op": "percentOfTotal",
    "field": "m0"
  },
  "as": "share"
}
```

### `words` â€” items 116

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-116-word-cloud.vilsem-visual.json). Regression: `stress2-word-layout.test.js`.

```json
{
  "words": {
    "text": "word",
    "weight": "revenue",
    "limit": 24,
    "width": 750,
    "height": 400,
    "minFont": 12,
    "maxFont": 36
  },
  "as": "words"
}
```

### `concat` â€” items 6, 43, 59, 68, 78, 81, 82, 94, 118

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-006-horizon.vilsem-visual.json). Regression: `stress2-repeat-data.test.js`.

```json
{
  "concat": [
    {
      "repeat": "$calc.f0.panels",
      "template": {
        "type": "line",
        "name": "$item.name",
        "xAxisIndex": "$item.index",
        "yAxisIndex": "$item.index",
        "data": "$item.data",
        "symbol": "none",
        "lineStyle": {
          "width": 0
        },
        "areaStyle": {
          "color": "#a7f3d0",
          "opacity": 1
        },
        "z": 1
      }
    },
    {
      "repeat": "$calc.f1.panels",
      "template": {
        "type": "line",
        "name": "$item.name",
        "xAxisIndex": "$item.index",
        "yAxisIndex": "$item.index",
        "data": "$item.data",
        "symbol": "none",
        "lineStyle": {
          "width": 0
        },
        "areaStyle": {
          "color": "#34d399",
          "opacity": 1
        },
        "z": 2
      }
    },
    {
      "repeat": "$calc.f2.panels",
      "template": {
        "type": "line",
        "name": "$item.name",
        "xAxisIndex": "$item.index",
        "yAxisIndex": "$item.index",
        "data": "$item.data",
        "symbol": "none",
        "lineStyle": {
          "width": 0
        },
        "areaStyle": {
          "color": "#059669",
          "opacity": 1
        },
        "z": 3
      }
    }
  ]
}
```

### `formatterEmptyText` â€” items 85

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-085-kpi-sparkline.vilsem-visual.json). Regression: `stress2-kpi-accessors.test.js`.

```json
{
  "formatterEmptyText": "No revenue"
}
```

### `formatterTemplate` â€” items 1, 2, 3, 4, 5, 8, 9, 11, 12, 13, 14, 15, 17, 22, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 38, 39, 40, 43, 44, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 106, 107, 108, 109, 115, 116, 118

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-001-step-line.vilsem-visual.json). Regression: `stress2-native-tooltip.test.js`.

```json
{
  "formatterTemplate": "{value:thousands}"
}
```

### `lastRowValue/lastRowLabel` â€” items 85

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-085-kpi-sparkline.vilsem-visual.json). Regression: `stress2-kpi-accessors.test.js`.

```json
"$slot.revenue.lastRowValue"
```

### `repeat/$item` â€” items 6, 7, 15, 23, 24, 43, 44, 59, 60, 65, 66, 67, 68, 69, 70, 78, 81, 82, 83, 84, 92, 93, 94, 96, 103, 118

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-006-horizon.vilsem-visual.json). Regression: `stress2-repeat-data.test.js`.

```json
{
  "repeat": "$calc.f0.panels"
}
```

### `visual-scoped measures` â€” items 1, 3, 4, 5, 7, 8, 9, 10, 11, 19, 25, 26, 27, 29, 33, 34, 35, 36, 37, 55, 57, 66, 67, 74, 75, 78, 79, 81, 82, 85, 102, 104, 105

[Complete example](https://github.com/bcsnpc/vilsem-mcp/blob/main/templates/stress2-001-step-line.vilsem-visual.json). Regression: `scoped-measures.test.js`.

```json
{
  "measures": {
    "Step Start": "[Total Revenue]",
    "Step Middle": "[Total Revenue]",
    "Step End": "[Total Revenue]"
  }
}
```

<!-- END GENERATED STRESS2 TRANSFORM EXAMPLES -->

## Report inheritance and model formats

Omit canvasTheme for a transparent report-native visual. Explicit canvasTheme
light/dark overrides report styling unless the native Appearance pane forces
report-theme inheritance. preview_visual accepts reportDir, theme and locale
(en-US default); choose the actual viewer locale for regional parity. Model
culture and viewer regional settings may differ. Shared numeric/date formatting
preserves raw values while formatting labels, axes and host tooltips.

Visual-scoped formatting is part of the declaration, not DAX model mutation:

```json
{"measures":{"Margin":{"expression":"DIVIDE([Profit],[Revenue])","format":"0.00%"}}}
```

This shape is emitted as query-only NativeMeasure.Format for Power BI. The
format converter supports sections, literal prefixes/suffixes, percent, grouped
numbers, decimal precision, comma scaling and UTC date patterns; it does not
implement every Excel conditional/scientific/dynamic-format feature.

The current report-native defaults and model formatting require renderer4.34+.
Committing into an older registered resource refuses incompatible features;
import the updated bundled renderer explicitly. The GUID and semantica.primitiveSpec
property remain unchanged. Preview interaction assessments are capability
descriptions, not native-host verification results.


## Text inside palette-coloured marks

`$theme.paletteText.<index>` selects black or white text for the corresponding
opaque palette colour, using sRGB relative luminance and the larger WCAG
contrast ratio. Example: `"label":{"position":"inside","color":"$theme.paletteText.1"}`
for a bar using the second series colour. Palette indexing includes helper
series, just as ECharts series colours do. This is a trusted core calculation;
templates still contain only JSON. It does not automatically inspect conditional
per-datum colours or translucent paints; those need a known backdrop and an
explicit label treatment. Unknown paints fall back to the report foreground.
See [W3C contrast calculation](https://www.w3.org/WAI/WCAG22/Techniques/general/G18).


### Units after data shaping

Model formats apply independently to each measure coordinate in a `points`
transform, including `parallelAxis` dimensions. Repeated facet panels inherit
formats from `facet.value`; aggregate tooltips show aggregate values with all
contributor identities. Category names, percentage-share labels and explicit
prefix/suffix choices retain their original meaning.

For example, `{"as":"running","window":{"field":"revenue","op":"sum"}}`
with `"data":"$calc.running.values"` retains the revenue format. Sum, lag,
EWMA, take, exact field aliases and min/max/sum/mean/median/quantile/stddev
preserve their source unit. Counts, percent-of-total, density and arbitrary
calculations do **not** inherit it: declare the desired derived formatting
explicitly, or use a visual-scoped DAX measure with a `format`. Raw data stays
numeric; formatters never change query values or selection lineage.


## Shared formatting and versioned editing (core0.6 / renderer4.35)

New writes set `specVersion:"0.6"`; this is independent of `version:1` (the wire envelope) and `template.meta.formatVersion` (template-language capabilities). Readers migrate unversioned/0.1..0.5 specs forward without mutating the source. The real round2 migration changes a string scoped measure into `{expression:"..."}`. Unknown future versions fail explicitly; do not relabel a future spec to bypass validation.

`spec.formatting` is optional and accepts these groups: appearance, title, typography, seriesColors, labels, legend, categoryAxis, primaryAxis, secondaryAxis, lines, border. Only supplied properties override the original spec. Separate Power BI pane objects merge over their corresponding authored properties; an edit never clears them implicitly.

```json
{"specVersion":"0.6","version":1,"type":"line","formatting":{"title":{"text":"Monthly revenue","fontSize":20,"bold":true},"seriesColors":{"palette":"#0072b2,#d55e00"},"labels":{"show":true,"fontSize":12,"format":"$#,0"},"legend":{"show":true,"position":"bottom"},"primaryAxis":{"color":"#252423","format":"$#,0","gridlines":true},"secondaryAxis":{"color":"#0072b2","format":"0.0%"},"border":{"show":true,"color":"#cccccc","width":1,"radius":4}}}
```

Typography has fontFamily/fontSize/color. Title adds show/text/bold/alignment(left|center|right). Labels add show/position/format. Legend adds show/position(top|bottom|left|right). Each axis has show/title/fontFamily/fontSize/color/titleColor/titleSize/gridlines/gridColor; numeric axes also have autoMin/autoMax, min/max/format. Lines have width/style(solid|dashed|dotted)/color. Appearance has useReportTheme/backgroundColor/transparency; border has show/color/width/radius. Colour properties accept a colour string or a dataView-style solid colour. Palette currently accepts comma-separated hex colours. Positive text sizes/line widths are bounded1..200; border radius0..100. Absent controls do not inject defaults into an existing visual. Axis settings apply only when that axis exists; secondary refers to the next numeric axis after the primary Y value axis (or X when no Y value axis exists). Explicit formatting does not create new field roles or measures.

Labels preserve trusted formatter-template text such as `{name}: {value}` when changing number format; name-only labels remain names. A pane format does not redefine the underlying calculation. DOM adapters remain outside this headless resolver and expose a smaller native formatting surface.

`validate_spec` reports structured `errors` with JSON pointers, expected/allowed shapes and suggestions, plus corrected snippets where unambiguous. Validation is not repair: no failed request changes a report. Scoped measure validation also needs a connected DAX engine. Read schema/context to fix a missing field; never substitute a different business measure silently.

`preview_visual` defaults `critique:true`; findings contain code, severity, spec path, message, suggestedFix and evidence. SVG text bounds can report deliberate rich-text overlap; contrast uses the page background, so filled-mark labels need inspection. Dual axes request a business/units review rather than claiming to prove unrelated data. Absence of findings does not certify readability, full query coverage or host behavior.

`preview_variants` requires connectionId, specs(1..4), equally sized labels and common bindings. It uses one query, a labelled2x2 image and per-candidate critique. Scoped measure blocks must match. `diff_visual` returns spec diff and before/after PNGs without writing. `update_visual` patches the stored spec (RFC6902), defaults dryRun:true and returns both PNGs, diff and the read etag; pass that etag with dryRun:false after review. Whole-document replacement, renderer identity/prototype/version edits and implicit rebinding are refused. Manual pane objects survive unless resetFormatting:true is explicit.

##0.7 development: expression graphics and joint-area layout

These additions require renderer4.40 or later and are not part of the0.6
release. New0.7 writes use specVersion0.7; historical readers migrate forward.
Read vilsem://docs/expression-language for the full closed grammar and budgets.
Set template.meta.formatVersion4. A custom series accepts only this JSON AST,
not source text or an authored function:

```json
{"type":"custom","data":"$slot.amount.values","renderItem":{"language":"vilsem-expression","version":1,"root":{"type":"circle","shape":{"cx":{"op":"add","args":[20,{"op":"mul","args":[{"op":"dataIndex","args":[]},30]}]},"cy":40,"r":5},"style":{"fill":"$theme.accent"}}}}
```

This syntax-only example uses dataIndex for fixed positions. Use api coordinate
operations and explicit encode/dimensions for scaled real measurements. Data
identity comes from the datum's source position or bounded rowIndexes; drawing
a shape does not invent a new report selection identity. Literal strings
starting with$ use {"op":"literal","args":["$#,0"]}, including currency formats.
validate_spec returns exact AST pointers and expected operations/types; it
rejects loops, code, property dereferences, prototype keys and budget overflow.

The mosaic transform preserves actual joint additive weights as unit-square
areas. It supports Marimekko/mosaic geometry without an imperative callback:

```json
{"as":"cells","mosaic":{"x":"country","y":"category","value":"revenue","limit":200}}
```

Use$calc.cells.data as series.data. Each object has name,rowIndexes and
value:[left,bottom,width,height,weight,xIndex,yIndex]. Widths are X marginal
shares, heights are conditional Y shares and width*height=weight/total.
xCategories/yCategories expose the ordered names. Nulls and zero weights make
no cells; negative/nonfinite weights and overflowing totals fail explicitly.
The limit is1..2000 cells, default2000. Use additive measures; ratios/distinct
counts across joint groups cannot be assumed additive. No missing intersection
or independence-based cell is fabricated. Empty input produces an empty result.


# Group C format additions (development, not a released contract)

All examples use `template.meta.formatVersion:4`, specVersion `0.7`, and native
renderer 4.40 or newer. Call validate_spec before preview. Exact field names
below are slot names, not DAX expressions. Transforms never rewrite the model.

## Expression geometry

An expression series uses `type:"custom"` and a renderItem JSON AST:
`{language:"vilsem-expression",version:1,root:{type:"rect",shape:{x:0,y:0,width:20,height:20},style:{fill:"$theme.textPrimary"}}}`.
See the expression-language resource for the full operation grammar and budgets.
No executable callback is accepted. Compilers operate on timeline baseOption
and options as well as root series, sharing one whole-visual resource budget.
Paths default to strokeNoScale:true. Use common x/y/scaleX/scaleY transforms to
place normalized paths; shape width/height fitting changes their meaning.

- `{as:"cells",mosaic:{x:"country",y:"category",value:"revenue",limit:200}}`
  gives `data` values `[left,bottom,width,height,weight,xIndex,yIndex,xName,yName]`.
  Joint weights determine area; this does not invent independence estimates.
- `{as:"curve",density:{by:"category",field:"price",layout:"violin",samples:32,expressionGeometry:true}}`
  adds geometryData `[left,top,width,height,index,path]` and geometryXMin/Max,
  geometryYMin/Max. Layout may instead be ridgeline. The path is an unused
  ordinal dimension; coordinate/scaling dimensions remain numeric.
- `{as:"packed",jitter:{by:"category",field:"price",method:"collision",expressionGeometry:true}}`
  adds expressionData `[price,packedY,radius,priceRange,packingWidth,packingHeight]`.
  Scale the radius for the actual plot dimensions; keep source rowIndexes.
- `{as:"labels",words:{text:"product",weight:"revenue",expressionGeometry:true}}`
  adds expressionData `[x,y,weight,fontSize,word,width,height]` without copying
  hidden legacy text styles. Label fonts must scale with the packed extent.
- `{as:"tree",hierarchy:{levels:["category","subcategory","product"],value:"revenue",layout:"partition",expressionGeometry:true}}`
  adds expressionData `[offset,depth,span,weight,name]` for a flame display.
- `{as:"bins",hexbin:{x:"price",y:"cost",bins:14,expressionGeometry:true}}`
  adds expressionData `[x,y,count,radiusX,radiusY,path]` and expressionX/YMin/Max.
  Cells are hexagonal in normalized data coordinates; affine pixel scaling can
  change their aspect. Counts and contributing row identities are preserved.
- `{as:"density",density2d:{x:"price",y:"cost",contourFractions:[0.2,0.4,0.6,0.8]}}`
  adds contourData `[x1,y1,x2,y2,threshold,levelIndex]`, contour bounds and levels.
  Marching squares uses an asymptotic saddle decider. Levels are fractions of
  peak KDE, **not probability/confidence regions**. Selection denotes local
  kernel contributors, not every entity geometrically inside a contour.
- `{as:"sets",setOverlaps:{value:"count",sets:[{name:"Black",field:"colour",equals:"Black"},{name:"Unisex",field:"style",equals:"U"}]}}`
  accepts two or three predicates and returns exact observed membership regions,
  inclusive set counts and schematic circle positions. Circle areas are not
  proportional to cardinalities; arbitrary exact Euler fitting is not provided.
- `{as:"cells",voronoi:{levels:["country","category"],value:"revenue",limit:80}}`
  returns weighted convex hierarchical cells with values
  `[cx,cy,weight,depth,colourIndex,isLeaf,path,label,labelWidth,labelHeight]`.
  Paths use unit-square coordinates with SVG Y inverted. Use numeric cx/cy for
  labels and common plot transforms for paths. Parent/leaf rowIndexes remain
  exact. At most 24 siblings, 128 nodes, two or three levels, sibling/root
  fractions at least 1e-7, 2 million geometric work units. Results exceeding
  0.1% relative area error are refused. Zero weights are omitted; negatives fail.

`$theme.readablePalette` is an opt-in palette adjusted toward at least 3:1
non-text contrast against a known opaque page background. `$theme.palette`
continues to preserve the report palette exactly. Unknown/translucent
backgrounds cannot guarantee contrast. `$theme.pageBackground` exposes the
known report background for explicit design decisions.

## Declarative motion and race frames

Animation lives alongside slots/transforms, outside the ECharts option:

```json
{"animation":{"enabled":true,"enter":{"duration":400,"easing":"cubicOut","delayByIndex":{"milliseconds":10,"max":500}},"update":{"duration":600,"easing":"cubicInOut"},"animationThreshold":5000}}
```

Durations are 0..30000 ms, stagger increments 0..1000 ms and stagger caps
0..30000 ms. Easing is a closed whitelist; see the expression/motion docs.
Animation and Reduce motion pane switches apply to nested timeline frames and
series, and the native renderer also observes prefers-reduced-motion.

`{as:"ranked",race:{time:"month",category:"country",value:"revenue",topN:10,history:12}}`
returns timeLabels, categories, maxValue and frames. Each frame contains name,
index, data, categories, timeLabels and line-history series. Marks have stable
id/name and source rowIndexes. Repeated time/category grains fail: ratios and
distinct counts must be computed by DAX, never silently summed. Missing history
observations remain null. Optional x/y slots must be supplied together; size
is optional and nonnegative. Frames <=120, topN <=100, history <=120, derived
points <=50000. Unknown transform settings fail validation.

Bind `baseOption.timeline.data:"$calc.ranked.timeLabels"` and
`options:{repeat:"$calc.ranked.frames",template:{yAxis:{data:"$item.categories"},series:[{id:"race",type:"bar",data:"$item.data"}]}}`.
For line history, repeat `$item.series`, using `$item.id`, `$item.name` and
`$item.data`. Bubble size can use a visualMap on dimension 2, not an arbitrary
symbolSize callback. Timeline and UniversalTransition modules are registered
in the web and native renderers. Live update retention, hidden-state behavior
and full motion acceptance remain under test; registration is not acceptance.

`preview_visual({...,frames:6})` returns a final timeline-state PNG, a bounded
APNG when feasible, and a sampled-state contact sheet. The APNG is <=3 seconds,
<=2 MiB and <=12 states / 12 million decoded pixels. `motion: "states"` samples
discrete settled states. `motion: "browser"` captures actual browser interpolation
with a controlled animation clock; `motion: "auto"` attempts browser capture
and explicitly reports any fallback. Capture is not a frame-rate benchmark.
Critique warns about sequences over 3 seconds and timelines exceeding 60 states.

Tests: race-template-integration, race-transform, expression-geometry,
voronoi-layout, grid-geometry, expression-layout-data, set-overlaps,
animation-contract, animated-preview and MCP motion-preview. See regression
status for actual runs and native verification boundaries.


Browser capture: preview_visual also accepts motion:auto|states|browser (default auto). When a supported installed Chromium executable is available, auto returns a bounded actual canvas APNG for authored motion. VILSEM_PREVIEW_BROWSER_PATH is an optional executable override. Missing-browser auto fallback is explicit; browser mode errors. Capture uses a fresh profile, blocked HTTP/WebSocket/service workers, stripped credentials and controlled requestAnimationFrame time. It is not an FPS measurement. Source durations exceeding3seconds are marked truncated. Timeline contact sheets remain sampled state overviews. See the packaged motion-capture.md design/security notes.

## Responsive expression panels (core0.7.1 / renderer4.41)

Two zero-argument operations expose bounded current logical-pixel dimensions:
`{"op":"viewportWidth","args":[]}` and
`{"op":"viewportHeight","args":[]}`. They call only the trusted ECharts
getWidth/getHeight APIs. Values must be finite and within0..1000000. No DOM,
host object, arbitrary API call or property lookup is exposed. Resize evaluates
them again; do not cache fixed900x550 dimensions in a reusable template.

`stress3-reference-figma` demonstrates a rounded inset white panel on a pale
backdrop. Its inset is min(25,width/4,height/4), and the panel dimensions and
radius shrink safely in tiny viewports. It uses a silent, tooltip-free,
coordinateSystem:none custom series below marks; no fake business axes or
changes to real data are needed. The renderer compatibility check refuses
insertion into versions older than4.41. Other0.7 specs retain their4.40 floor.

The current example additionally sets `role:"annotation",silent:true` on the
panel leaf. This requires core0.7.2 / renderer4.42: authored decoration opacity
stays stable when a host selection/highlight dims data marks. Other roles and
interactive annotations keep their previous dimming. Explicit authored opacity
still applies. Set these flags on each decorative leaf; a group's role does
not implicitly change its children. Parameterized/conditional silent flags also
raise the reader floor. Viewport dimensions by themselves retain their4.41 floor.

```json
{"type":"rect","role":"annotation","silent":true,"shape":{"x":0,"y":0,"width":100,"height":50},"style":{"fill":"#ffffff","opacity":0.9}}
```

Feedback excludes proven static viewport backdrops from measured-series counts,
categorical-palette counts and all-zero/all-null measure warnings. This is a
conservative check: one invocation row, silent custom series with no coordinate
system, an explicitly silent annotation shape leaf, and no data/coordinate/
visual/style API reads. Data-dependent annotation series still count. Text
clipping/contrast inspection remains enabled. An explicit opaque option
background takes precedence over the report background for global text contrast;
contrast against arbitrary filled marks still needs visual review.
