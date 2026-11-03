# Vilsem custom visual specification

Run `validate_spec` before `preview_visual`, then preview actual data before committing. `commit_visual` accepts only a spec that resolves through `@vilsem/core`. A spec is declarative JSON, never JavaScript or arbitrary ECharts code.

## Composition

```json
{"version":1,"type":"bar","canvasTheme":"dark","config":{"title":"Sales","dataLabels":true}}
```

The current headless composition types are bar, column, stacked_bar, grouped_bar, line, area, stacked_area, bump, donut, pie, scatter, bubble, treemap, radar, gauge, slope and lollipop. DOM-adapter visuals are not ECharts compositions and are not supported by the MCP resolver. Validation without data returns an empty-data option; it does not prove field-role suitability or rendering with a particular dataset.

## Template

```json
{
  "version":1,
  "type":"custom",
  "canvasTheme":"dark",
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

Slots consume up to **six** dimension/time fields, in declaration order, from `_cats`, and three semantic-model measures from `_vals`. `lastIndex` is the normalized row index of the last non-null numeric value. Data-item `rowIndexes` arrays identify contributing normalized rows so native selection and tooltips retain field identities after grouping or sorting. Derived sums require additive measures; ratios/distinct counts must be evaluated at the required grain by the model.

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
