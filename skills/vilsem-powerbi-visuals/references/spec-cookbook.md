# vilsem spec cookbook

Patterns originally verified against a live model (renderer 4.42 / core 0.7.x). The rendering-sharpness section below documents core 0.8 / renderer 4.43. The snippets show the parts that matter. Wrap them in the normal envelope:

```json
{"version":1,"type":"custom","config":{"cardStyle":"plain"},
 "measures":{ ... },
 "template":{"meta":{"id":"...","name":"...","formatVersion":2},
             "slots":{ ... }, "params":[], "transforms":[ ... ],
             "template":{ ...ECharts-style option... }}}
```

Bindings fill slots in declaration order: dimensions first, then measures.

---

## Visual-scoped measure patterns

**Rolling window, so date axes don't show every calendar date**

```json
"measures":{
  "vxInWin":{"expression":"VAR w = MAX(DimDate[WeekStartDate]) VAR t = [currentdate] RETURN IF(w >= t - 91 && w + 6 < t, 1, 0)","format":"0"},
  "vxSched":{"expression":"IF([vxInWin] = 1, [Scheduled Appointments])","format":"#,0"}
}
```

Model measures wrapped in `COALESCE(...,0)` return 0 for every date. Wrapping them in a window that returns BLANK outside the range keeps the query, and the axis, limited to the dates you want.

**Top-N rows**

```json
"lRank":{"expression":"RANKX(ALLSELECTED(DimHospital[RegionName]), [Scheduled Appointments], , DESC, DENSE)","format":"0"},
"lSched":{"expression":"IF([lRank] <= 15 && [Scheduled Appointments] > 0, [Scheduled Appointments])","format":"#,0"},
"lCanc":{"expression":"IF(NOT ISBLANK([lSched]), [Cancellation Rate])","format":"0.0%"}
```

Gate every bound measure on the same condition, so rows outside the top N disappear entirely.

**A constant on every row (overall total next to a per-category breakdown)**

```json
"bSWAll":{"expression":"CALCULATE([bSWRate], ALLSELECTED(fact[appttype]))","format":"0.0%"}
```

Read it with `$slot.swAll.last`.

**An index against the company average (higher = better)**

```json
"rICanc":{"expression":"IF([rRank] <= 6, MIN(200, 100 * DIVIDE(CALCULATE([Cancellation Rate], ALLSELECTED(DimHospital)), [Cancellation Rate])))","format":"0"}
```

For "lower is better" metrics, invert the ratio. Cap the index so one outlier doesn't flatten the radar.

**No dimension at all (scalar KPIs):** bind `"dimensions": []` with up to 6 measures, and read each with `$slot.x.last`.

---

## Formatted big numbers (workaround for unformatted `*Label` tokens)

`$slot.x.lastLabel` ignores the measure format, so `0.042` shows as "0.04". Instead, draw the number as an invisible gauge:

```json
{"type":"gauge","silent":true,"center":["25%",125],"radius":1,
 "axisLine":{"show":false},"axisTick":{"show":false},"splitLine":{"show":false},
 "axisLabel":{"show":false},"pointer":{"show":false},"anchor":{"show":false},
 "title":{"show":false},"progress":{"show":false},
 "detail":{"offsetCenter":[0,0],"fontSize":46,"fontWeight":800,"color":"#0B6BC7",
           "formatterTemplate":"{value:percent}"},
 "data":[{"value":"$slot.swAll.last"}]}
```

`lastLabel` and `sumLabel` are fine for counts (they use thousands separators). Put a plain `title` above the number as its caption.

---

## KPI hero: several panels in one visual

- Use `title` as an **array**: one entry for the page title, then one per KPI caption.
- Use `grid`, `xAxis` and `yAxis` as arrays with matching `gridIndex`. Point each series at its grid with `xAxisIndex` / `yAxisIndex`.
- For sparklines, hide the axes (`"show":false`) and set `"scale":true` on the y-axis.

```json
"grid":[{"left":30,"top":230,"width":"33%","bottom":40},
        {"left":"56%","top":75,"width":"15%","height":120}],
"xAxis":[{"gridIndex":0,"type":"category","data":"$slot.week.categories","axisLabel":{"formatterTemplate":"{value:date}"}},
         {"gridIndex":1,"type":"category","data":"$slot.week.categories","show":false,"boundaryGap":false}],
"yAxis":[{"gridIndex":0,"type":"value"},{"gridIndex":1,"type":"value","show":false,"scale":true}],
"series":[{"type":"line","xAxisIndex":0,"yAxisIndex":0,"data":"$slot.sched.values","smooth":true,"areaStyle":{"opacity":0.15}},
          {"type":"line","xAxisIndex":1,"yAxisIndex":1,"data":"$slot.chk.values","symbol":"none"}]
```

A ring gauge works for a single percentage: set `progress.show:true`, a tight `min`/`max` (e.g. 0.9–1), and `detail.formatterTemplate:"{value:percent}"`.

---

## Sorted leaderboard (sorting categories by value)

The query returns categories in query order, not by value. To sort, use the `top` transform for the category order, and bind the other measures as `[value, category]` pairs on the same category axis:

```json
"transforms":[{"top":{"category":"region","value":"sched","count":15},"as":"order"}],
"yAxis":[{"gridIndex":1,"type":"category","inverse":true,"data":"$calc.order.categories"}],
"series":[
  {"type":"bar","xAxisIndex":1,"yAxisIndex":1,"data":"$calc.order.values"},
  {"type":"scatter","xAxisIndex":2,"yAxisIndex":2,"data":"$slot.canc.pairsSwapped"}]
```

To label those `[value, category]` points, use `"label":{"show":true,"formatterTemplate":"{value.0:percent}"}`: plain `{value}` prints the category. For compact money on the bars, use `{value:compact}` (renderer 4.45+), which gives `$9.9B` from a `$#,0.00` measure.

**Reference lines (average/limits):** `markLine` with `type:"average"` can render at 0 in renderer 4.43. The reliable pattern is a flat `line` series. Compute the value with a `stat` transform (`sum` and `count`, then `calculate` sum/count; don't rely on `mean`), and repeat it across `$calc.x.values` as its data, with `symbol:"none"`, a dashed `lineStyle` and `silent:true`.

- Use one grid per column, all with `inverse:true` y-axes that share `$calc.order.categories`.
- To colour dots green to red: add a hidden `visualMap` with `seriesIndex` set to that series, `dimension:0`, `min:"$slot.canc.min"`, `max:"$slot.canc.max"`.
- **Rank badges:** put a scatter in a grid with `width:1` and `xAxis` set to `{min:0, max:16}`, so all the badges line up in one column. Use `symbol:"roundRect"`, `encode:{"x":0,"y":1,"label":0}`, and `label.position:"inside"`.

---

## Calendar heatmap with a second panel

```json
"calendar":{"top":110,"left":60,"right":30,"cellSize":["auto",26],"range":"$slot.day.dateRange",
            "dayLabel":{"firstDay":1},"yearLabel":{"show":false}},
"visualMap":{"type":"continuous","seriesIndex":0,"min":0,"max":"$slot.sched.max","orient":"horizontal",
             "inRange":{"color":["#DCEEFF","#118DFF","#12239E"]}},
"series":[{"type":"heatmap","coordinateSystem":"calendar","data":"$slot.sched.pairs"}, ...]
```

- The time slot must be a date column, such as `DimDate[FullDate]`.
- Window the measure so `dateRange` covers only the period you want.
- Set `visualMap.seriesIndex`, or it recolours your other series too.

---

## Sankey (multi-level flows)

```json
"transforms":[{"flows":{"levels":["d0","d1","d2"],"value":"cnt","order":"value"},"as":"flow"}],
"series":[{"type":"sankey","data":"$calc.flow.nodes","links":"$calc.flow.links",
           "nodeAlign":"justify","layoutIterations":0,"draggable":false,
           "label":{"formatterTemplate":"{label}","width":320,"overflow":"truncate"},
           "lineStyle":{"color":"gradient","opacity":0.35},"emphasis":{"focus":"adjacency"}}]
```

- The value must be additive (a count or sum).
- Leave a wide right margin for the last column's labels.
- If there are many tiny nodes, group them into "Other" with a visual-scoped measure or a model column.

---

## Funnel with donut and callouts

- Funnel: `"sort":"none"`, with data items `{name, value:"$slot.x.last", itemStyle:{color}}`, and `label.formatterTemplate:"{name}\n{value:thousands}"`.
- Donut: a `pie` with `radius:["34%","50%"]`, `label.formatterTemplate:"{d}%"`, and the total as a centred `title` (`textAlign:"center"`).
- Leak callouts: `title` entries placed between the funnel and the donut.
- **Only use a funnel when the stages are really sequential.** Status counts such as booked, confirmed, prepared and checked out are current statuses, not stages. Show them as an outcome breakdown instead.

---

## Butterfly (mirrored) bars

Use two grids side by side:
- **Left grid:** `xAxis` with `{"type":"value","inverse":true,"show":false}`. Bars use `label.position:"left"`.
- **Right grid:** a normal value axis. Bars use `label.position:"right"`.
- **Shared categories:** show the category labels once, on the right grid's y-axis, using `axisLabel.margin` and `align:"center"` to sit them in the gap.

If the two sides have very different scales, say so in a subtitle ("each side on its own scale").

---

## Radar with a company baseline

```json
"transforms":[{"points":{"fields":["chk","canc","resch","ns","cov"],"numeric":["chk","canc","resch","ns","cov"],"name":"region"},"as":"pts"}],
"radar":{"indicator":[{"name":"Check-out rate","max":200}, ...],"shape":"polygon"},
"legend":{"data":{"concat":[["Company average"],"$slot.region.categories"]}},
"series":[
  {"type":"radar","silent":true,"symbol":"none","lineStyle":{"type":"dashed"},
   "data":[{"name":"Company average","value":[100,100,100,100,100]}]},
  {"type":"radar","data":"$calc.pts.data","areaStyle":{"opacity":0.08},"emphasis":{"focus":"self"}}]
```

- `points` turns each row into `{name, value:[...]}`, which gives one polygon per category.
- Use `legend.data` with `concat` to keep helper series, such as a bar chart in the same visual, out of the legend.

---

## Quality checklist before committing

- [ ] The numbers in the preview match a `run_dax` probe.
- [ ] No rate is above 100% unless that's meaningful, and no axis shows unexpected empty dates.
- [ ] Percentages show as `%`, not `0.xx`.
- [ ] Titles and subtitles explain any window, top-N limit, cap or substitution.
- [ ] The critique has no real truncation or overlap left. Contrast warnings on filled marks are often false positives.
- [ ] The layout matches the target size, and no visuals overlap on the page.


## Rendering sharpness (core 0.8 / renderer 4.43)

Canvas remains the default. It accounts for host page zoom and device pixel ratio, bounded to 1-4. For text and fine lines at arbitrary zoom, set the top-level spec option:

```json
{"config":{"renderer":"svg"}}
```

Merge this into the existing config; keep the rest of the spec. Desktop Appearance > Render mode overrides it; Automatic follows the spec. Very dense charts or animation may be slower with SVG. Canvas-only trail/blend effects fall back to canvas and produce a critique/native warning. SSR previews keep their existing rendering behavior. Existing reports must re-import the installed `@vilsem/core/assets/renderer.pbiviz`, accept Update, save, close and reopen; committing a spec does not replace a registered renderer. The independent `*Label` formatting workaround above still applies.


## Top-N without an Other row

**Top-N without an "Other" row.** The `top` transform appends an "Other" row. For a clean top-N, gate the measure in DAX instead: `IF(RANKX(ALLSELECTED(T[c]), ROUND([m],0), ROUND([m],0)) <= N, [m])`.


## Overlay bars

**Overlay bars (bullet / actual vs target).** Put the second bar series on a **second hidden `yAxis`** in the same grid (`yAxisIndex:1`, `show:false`), rather than using `barGap:"-100%"`.


## Previous-row values

**Previous-row values.** Use the `window` transform with `lag` to get the previous row (for drawing segments from previous to current). Don't compute "next row" in DAX.


## Literal labels in expression series

**Literal labels in custom (expression) series.** Text measures can't travel through `points`. Generate labels with `data:{repeat:"$calc.pts.data", template:{name:"$item.name", value:["$item.value.0", …, "$item.name"]}}` and an ordinal dimension. Text then reads the name from the item.


## Cumulative race values

**Cumulative race values.** `VAR y = MAX('Date'[Year]) RETURN IF([Sales] > 0, CALCULATE([Sales], REMOVEFILTERS('Date'), 'Date'[Year] <= y))`, with `race: {time, category, value, topN}` and the year slot as `kind:"time"`.


## Bubble race

**Bubble race.** `race: {time, category, value, topN, x, y, size}` animates a scatter. Fix the axis `min`/`max` explicitly so frames don't rescale, and consider `type:"log"` for wide ranges.


## Radial and polar stacked bars

**Radial / polar stacked bars by month.** Use a `facet` transform `{by: <series dim>, category: <month>, value}` and `series: {repeat: "$calc.f.panels", template: {type:"bar", coordinateSystem:"polar", stack:"total", …}}`. Bind **`MonthNumber`**, not month names, and give `angleAxis.data` a literal `["Jan",…,"Dec"]` so months stay in calendar order.


## Sankey source colours

**Sankey with one colour per source node.** The `flows` transform has no per-node colour option. List the nodes explicitly as `$calc.flow.nodes.<i>.{id,name,label,depth,value,rowIndexes}` and add `itemStyle.color` per index. Indexes past the end resolve to null and are ignored, so you can list a few spare entries. Test a filtered state (one slicer value) to confirm the empty slots don't break the layout.


## Cheap previews

**Cheap previews (token saving).**
   - Prefer `preview_variants` with a single spec over `preview_visual` while iterating: it returns the PNG and critique without the large option JSON.
   - To look at an already committed visual, call `update_visual` with `dryRun:true` and a no-op patch (e.g. replace a title with the same value); you get the PNG without re-sending the spec.


## Responsive custom geometry

**Responsive custom geometry.** Size everything from `viewportWidth`/`viewportHeight` (e.g. a grid cell = `viewportWidth * (0.125 + (i mod 4) * 0.25)`), so the visual survives resizing. Use `mod`/`floor` on a rank to lay items out in a grid.
