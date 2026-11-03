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
