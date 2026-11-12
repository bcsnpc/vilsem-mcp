#!/usr/bin/env python3
"""
promote-measures.py — move Vilsem visual-scoped measures into the semantic model.

Why: visual-scoped measures (spec.measures) are committed as NativeMeasure
projections, which Power BI stores as report-level extensions. They hide the
fields in the Build pane and fail under Publish to web
(PowerBIAnonymousExtensionSchemaException). Model measures don't.

What it does, for one PBIP project (local TMDL only; never touches Service):
  1. Finds every Vilsem Renderer visual with spec.measures / NativeMeasure.
  2. Adds each measure to a measures table in the model's TMDL, tagged
     `annotation VilsemOwned = true`, with a lineageTag, formatString and
     displayFolder "Vilsem\\<page display name>".
  3. Rewrites the visual's projections to model Measure references and removes
     spec.measures from the stored spec.

Safety:
  - --dry-run (default) prints the plan and writes nothing. Pass --apply to write.
  - Backs up every file it changes to <project>/.vilsem-backup/<timestamp>/.
  - Refuses a measure name that already exists in the model unless it is a
    VilsemOwned measure with the identical expression (then it is reused).
  - Refuses DAX containing ``` (would break the TMDL expression block).
  - Only edits: the chosen measures-table .tmdl and Vilsem visual.json files.

After --apply: close Power BI Desktop WITHOUT saving, reopen the .pbip, then
run vilsem validate_visuals.

Usage:
  python promote-measures.py "C:/Reports/My.Report"                 # dry run
  python promote-measures.py "C:/Reports/My.Report" --apply
  python promote-measures.py "C:/Reports/My.Report" --table "Vilsem Measures" --apply
"""
import argparse, datetime, glob, json, os, re, shutil, sys, textwrap, uuid

RENDERER_GUID = "semanticaRenderer4A7F2D9B8C3E1F5A6D4B2C8E9F1A3B7D"
MEASURE_ROLES = ["content", "secondary", "tertiary", "quaternary", "quinary", "senary"]


def read_json(path):
    with open(path, encoding="utf-8-sig") as f:
        return json.load(f)


def model_dir_for(report_dir):
    pbir = read_json(os.path.join(report_dir, "definition.pbir"))
    ref = pbir.get("datasetReference", {}).get("byPath", {}).get("path")
    if not ref:
        sys.exit("This report is not bound to a local model (byPath). Online models are not supported.")
    model = os.path.normpath(os.path.join(report_dir, ref))
    if not os.path.isdir(os.path.join(model, "definition", "tables")):
        sys.exit(f"Model TMDL folder not found: {model}/definition/tables")
    return model


def tmdl_quote_name(name):
    return name if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name) else "'" + name.replace("'", "''") + "'"


def tmdl_quote_str(s):
    return '"' + s.replace('"', '""') + '"'


def existing_measures(tables_dir):
    """name(lower) -> (file, expression_text, vilsem_owned). Best-effort TMDL scan."""
    found = {}
    for f in glob.glob(os.path.join(tables_dir, "*.tmdl")):
        text = open(f, encoding="utf-8-sig").read()
        for m in re.finditer(r"^\tmeasure\s+('(?:[^']|'')+'|[^\s=]+)\s*=\s*(.*?)(?=^\t\S|\Z)", text, re.S | re.M):
            raw = m.group(1)
            name = raw[1:-1].replace("''", "'") if raw.startswith("'") else raw
            block = m.group(2)
            found[name.lower()] = (f, block, "annotation VilsemOwned = true" in block)
    return found


def expression_text(block):
    """Read the expression itself, excluding TMDL properties and annotations."""
    lines = block.splitlines()
    if lines and lines[0].strip() == "```":
        body = []
        for line in lines[1:]:
            if line.strip() == "```":
                return textwrap.dedent("\n".join(body)).strip()
            body.append(line)
        return None  # An incomplete expression is never safe to reuse.
    body = lines[:1]
    for line in lines[1:]:
        if line.strip() and not line.startswith("\t\t\t"):
            break
        body.append(line[3:] if line.startswith("\t\t\t") else line)
    return "\n".join(body).strip()


def measure_block(name, expr, fmt, folder, visual, page):
    if "```" in expr:
        raise ValueError(f"Measure {name!r} contains ``` and cannot be written safely to TMDL")
    lines = [f"\t/// Vilsem measure used by visual '{visual}' on page '{page}'."]
    if "\n" in expr:
        body = "\n".join("\t\t\t" + l for l in expr.strip("\n").split("\n"))
        lines.append(f"\tmeasure {tmdl_quote_name(name)} = ```\n{body}\n\t\t\t```")
    else:
        lines.append(f"\tmeasure {tmdl_quote_name(name)} = {expr.strip()}")
    if fmt:
        lines.append(f"\t\tformatString: {tmdl_quote_str(fmt)}")
    lines.append(f"\t\tdisplayFolder: {tmdl_quote_str(folder)}")
    lines.append(f"\t\tlineageTag: {uuid.uuid4()}")
    lines.append("")
    lines.append("\t\tannotation VilsemOwned = true")
    lines.append("")
    return "\n".join(lines)


def insert_into_table(text, blocks):
    """Insert measure blocks before the table's first column/partition/hierarchy, else at end."""
    m = re.search(r"^\t(column|partition|hierarchy|annotation|calculationGroup)\b", text, re.M)
    payload = "\n".join(blocks) + "\n"
    return text[:m.start()] + payload + text[m.start():] if m else text.rstrip("\n") + "\n\n" + payload


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("report_dir", help="Path to the <Name>.Report folder")
    ap.add_argument("--table", default="KPI Measures", help="Existing measures table to write into (default: KPI Measures)")
    ap.add_argument("--apply", action="store_true", help="Write changes (default is a dry run)")
    args = ap.parse_args()

    report = os.path.abspath(args.report_dir)
    model = model_dir_for(report)
    tables_dir = os.path.join(model, "definition", "tables")
    table_file = os.path.join(tables_dir, f"{args.table}.tmdl")
    if not os.path.isfile(table_file):
        sys.exit(f"Measures table not found: {table_file}\nCreate it in Desktop first (e.g. Enter data -> one placeholder column), save, then rerun.")

    pages = {}
    for pj in glob.glob(os.path.join(report, "definition", "pages", "*", "page.json")):
        p = read_json(pj); pages[p["name"]] = p.get("displayName", p["name"])

    known = existing_measures(tables_dir)
    planned, new_blocks, visual_edits, errors = {}, [], [], []

    for vf in sorted(glob.glob(os.path.join(report, "definition", "pages", "*", "visuals", "*", "visual.json"))):
        v = read_json(vf)
        if v.get("visual", {}).get("visualType") != RENDERER_GUID:
            continue
        page_id, vis = vf.split(os.sep)[-4], vf.split(os.sep)[-2]
        lit = v["visual"]["objects"]["semantica"][0]["properties"]["primitiveSpec"]["expr"]["Literal"]
        spec = json.loads(lit["Value"][1:-1].replace("''", "'"))
        scoped = spec.get("measures") or {}
        projections = [pr for role in MEASURE_ROLES for pr in v["visual"].get("query", {}).get("queryState", {}).get(role, {}).get("projections", [])]
        native = [pr for pr in projections if "NativeMeasure" in pr.get("field", {})]
        if not scoped and not native:
            continue
        for name, d in scoped.items():
            expr = d["expression"] if isinstance(d, dict) else str(d)
            fmt = d.get("format") if isinstance(d, dict) else None
            key = name.lower()
            if key in planned:
                if planned[key] != expr.strip():
                    errors.append(f"{vis}: measure {name!r} defined differently in another visual")
                continue
            if key in known:
                f, block, owned = known[key]
                if owned and expr.strip() == expression_text(block):
                    planned[key] = expr.strip(); continue
                errors.append(f"{vis}: measure {name!r} already exists in {os.path.basename(f)} and is not an identical Vilsem measure")
                continue
            try:
                new_blocks.append(measure_block(name, expr, fmt, "Vilsem\\" + pages.get(page_id, page_id), vis, pages.get(page_id, page_id)))
                planned[key] = expr.strip()
            except ValueError as e:
                errors.append(f"{vis}: {e}")
        for pr in native:
            nm = pr["field"]["NativeMeasure"]
            name = nm.get("ProposedName") or pr.get("nativeQueryRef")
            if name.lower() not in planned and name.lower() not in known:
                errors.append(f"{vis}: NativeMeasure {name!r} has no definition in spec.measures; cannot promote safely")
                continue
            pr["field"] = {"Measure": {"Expression": {"SourceRef": {"Entity": args.table}}, "Property": name}}
            pr["queryRef"] = f"{args.table}.{name}"
            pr["nativeQueryRef"] = name
        spec.pop("measures", None)
        for b in (spec.get("bindings") or {}).get("measures", []) or []:
            if b.get("name", "").lower() in planned:
                b["table"] = args.table
        lit["Value"] = "'" + json.dumps(spec, ensure_ascii=False, separators=(",", ":")).replace("'", "''") + "'"
        visual_edits.append((vf, v, f"{pages.get(page_id, page_id)} / {vis}", len(native)))

    print(f"Report : {report}\nModel  : {model}\nTable  : {args.table}")
    print(f"Visuals to rewire : {len(visual_edits)}")
    for _, _, label, n in visual_edits:
        print(f"   - {label}  ({n} projection(s))")
    print(f"New model measures: {len(new_blocks)}   reused: {len(planned) - len(new_blocks)}")
    if errors:
        print("\nREFUSED — fix these first, nothing was written:")
        for e in errors: print("   x", e)
        sys.exit(2)
    if not visual_edits:
        print("Nothing to promote."); return
    if not args.apply:
        print("\nDry run only. Re-run with --apply to write (files are backed up first)."); return

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = os.path.join(os.path.dirname(report), ".vilsem-backup", stamp)
    for path in [table_file] + [vf for vf, *_ in visual_edits]:
        dest = os.path.join(backup, os.path.relpath(path, os.path.dirname(report)))
        os.makedirs(os.path.dirname(dest), exist_ok=True); shutil.copy2(path, dest)

    text = open(table_file, encoding="utf-8-sig").read()
    if new_blocks:
        with open(table_file, "w", encoding="utf-8", newline="\n") as f:
            f.write(insert_into_table(text, new_blocks))
    for vf, v, *_ in visual_edits:
        with open(vf, "w", encoding="utf-8") as f:
            f.write(json.dumps(v, ensure_ascii=False, indent=2) + "\n")
    print(f"\nWritten. Backup: {backup}")
    print("Next: close Power BI Desktop WITHOUT saving, reopen the .pbip, then run vilsem validate_visuals.")


if __name__ == "__main__":
    main()
