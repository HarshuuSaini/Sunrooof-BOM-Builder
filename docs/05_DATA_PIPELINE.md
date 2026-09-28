# 05 · Data Pipeline (Excel → JSON compilers)

The running app never reads Excel. Four Node scripts compile the Excel masters into
`src/data/*.json`. Run them locally when a master changes, then `npm run build` and deploy.

> All four scripts have the source path hardcoded near the top (`const FILE = "..."` /
> `const MAIN/DETAIL = "..."`). **Update the path, run `node <script>.js`, diff the JSON output.**
> They use the plain `xlsx` package for reading (SheetJS community build).

## Source workbooks
| Workbook | Consumed by | Produces |
|---|---|---|
| `~/Downloads/Inventory SUNROOOF (5).xlsx` | `build-designs.js`, `build-mrpbom.js` | `designs.json`, `mrpbom.json` |
| `~/Downloads/parts bom (2).xlsx` | `build-partscuts.js` | `partscuts.json` |
| `~/Downloads/SUNROOOF BOM MAIN.xlsx` + `SUNROOOF BOM DETAIL.xlsx` | `build-data.js` | `catalog.json` |

The master workbook has 37 sheets. Relevant sheet families:
- `Master- <Design>` matrices (parts per size) → BOM trees.
- `<Design> BOM (<COLOUR>)` matrices (materials per part) → MRP consumption.
- `<Design> HP BOM` (aluminium/hardware) → **now unused** (aluminium moved into the colour BOM).
- Window sheets `Master- <WindowName>` → single-config window designs.

---

## `build-designs.js` → `designs.json`
- Reads each `Master- <Design>` matrix. **Columns** are size variants (2A…6C); **rows** are parts
  with per-size quantities. Emits a `BomTree` per `(designCode, sizeCode)` into `bomByDesignSize`.
- Sections built: FRAME (Frame Panels / Bottom Moulding / Parts), HANGING PROFILE, HARDWARE & PACKING,
  CONSOLE & ELECTRONICS (Light Box / ELECTRIC BOX / Touch-up Box).
- Captures column-2 `order` (department) on hardware/console items.
- **Transforms applied here (business rules baked into the data):**
  - `renameItem`: `GLASS` → `5MM CLEAR FLUTED GLASS 369X1169`.
  - `SUNROOOF LOGO` qty forced to **2** (both parsers).
  - `fixUom`: screw items `SET OF …` → UOM `SET`.
  - `parseTouchUp` → `touchByColour` (White / Teak / Regal Bronze / Titanium Grey).
  - Window designs (FW/LW2/LW4/SFW/SLW/ARW/DAW) via `parseWindowSheet` (single size, White,
    2630×1020×150).
- **Sheet-name quirks matter:** e.g. `"Master - Minimalist "` has a trailing space — do not "fix" it
  in code unless you also fix the workbook.

## `build-mrpbom.js` → `mrpbom.json`
- Reads `<Design> BOM (<COLOUR>)` matrices: row 1 = part-code header (cols 7+), rows 8+ = materials
  (`0 name | 1 type | 2 department | 6 UOM | 7+ qty-per-part`). Emits `byDesignColour["CL|WH"] = [{
  name, dept, uom, perPart{partCode:qty} }]`.
- Colour BOM now **includes aluminium** (METAL dept), which is why HP-BOM sheets are unused.
- Also still emits `hpByDesign` for CL/MI (legacy; the export no longer uses it). Missing HP sheets
  (Green, French Window) are skipped with a console notice — expected.

## `build-partscuts.js` → `partscuts.json`
- Reads `parts bom (2).xlsx` sheets. Two layouts:
  - **CLASSICAL WHITE / CLASSICAL TEAK** — a part is an `H|W|D|Qty.` header row with the code in col
    3; component rows are marked `MRP = "MRP-1"`. Emitted **colour-scoped**: `CL|WH::<code>`,
    `CL|TK::<code>` (they differ only in finish: `White` vs `NEW TEAK`).
  - **Window sheets** (`fernch window`, `Arch window`, etc.) — the frame is one dispatched unit that
    production cuts into sub-parts; captured **design-scoped** under `compositesByDesign` because part
    names collide across sheets.
- MINIMALIST / GREEN have no cut blocks.
- Splits aggregate PROFILE / BOTTOM MOULDING rows into per-code parts.

## `build-data.js` → `catalog.json`
- Legacy: reads `SUNROOOF BOM MAIN.xlsx` (models/prices/colours) + `SUNROOOF BOM DETAIL.xlsx`
  (detail BOMs → `boms` fallback map). Produces the model list, prices, colour variants, and the
  fallback BOMs used when a model has no matrix BOM.
- The newer `Inventory SUNROOOF` master also contains pricing blocks; historically catalog pricing was
  cross-checked against those. The 4 window prices remain `0` because they aren't in the pricing
  blocks yet.

---

## Standard "new master arrived" procedure
```bash
cd source
# 1. back up current data
ts=$(date +%Y%m%d-%H%M%S); mkdir -p _backup/$ts; cp src/data/*.json _backup/$ts/

# 2. point the scripts at the new file(s) — edit the `const FILE = ...` line(s)
#    (Inventory master → build-designs.js & build-mrpbom.js; cut file → build-partscuts.js)

# 3. regenerate
node build-designs.js
node build-mrpbom.js
node build-partscuts.js   # only if the cut file changed
# node build-data.js      # only if MAIN/DETAIL changed

# 4. verify the diff is what you expect (design trees, MRP columns), then build
npx tsc --noEmit
rm -rf .next && npm run build

# 5. deploy (see docs/10) and record new + previous deployment ids
```

### Verification snippets (Node) used in practice
```js
// Confirm a Classical size's frame parts:
const d=require("./src/data/designs.json");
d.bomByDesignSize.CL["6C"].find(s=>/FRAME/i.test(s.section)).groups.forEach(g=>console.log(g.name,g.items.map(i=>i.name)));

// Confirm MRP part columns per colour:
const m=require("./src/data/mrpbom.json");
const cols=a=>[...new Set(a.flatMap(r=>Object.keys(r.perPart||{})))];
console.log("WH", cols(m.byDesignColour["CL|WH"]).filter(c=>/CO/.test(c)));
console.log("TK", cols(m.byDesignColour["CL|TK"]).filter(c=>/CO/.test(c)));
```

## Gotchas
- **Diffs look huge but are mostly reordering.** Compare as *sorted sets* of rows to isolate genuine
  additions/removals (that's how the `(3)→(5)` change was analyzed).
- **The master can be internally inconsistent** (a change applied to one colour sheet but not others,
  or the cut file not re-issued). The scripts compile faithfully; reconciliation is a product
  decision, not an automatic one.

