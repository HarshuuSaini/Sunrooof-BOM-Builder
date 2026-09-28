# 06 · Export Engine & Business Logic (`src/lib/export.ts`)

This is the largest, most important logic file (~1173 lines). It builds three Excel workbooks
**in the browser** using `xlsx-js-style`, then triggers a download. It imports `mrpbom.json` +
`partscuts.json` directly and pulls each line's BOM tree via `bomFor()` + `filterTree()`.

> Read alongside `docs/08_BUSINESS_RULES.md` (the *why*) and `docs/14_API_AND_FUNCTIONS.md`
> (signatures). The three public exporters are the only entry points.

## Public exporters
```ts
exportProjectBom(lines, includeRemote=true, partyName, mrpNo, meta?, remoteColor="BLACK"): void
exportRafterPackingList(lines, partyName, mrpNo, meta?): void
exportConsolePackingList(lines, partyName, mrpNo, meta?, includeRemote=true, remoteColor="BLACK"): void
```
Each assembles an `XLSX` workbook, styles it, and calls `XLSX.writeFile(wb, name)` to download.

## Shared helpers & constants (top of file)
- `partCodeOf(name)` — leading part code, `"COA (210X1250)" → "COA"`.
- `baseNameOf(name)` — name without `(dimensions)` suffix, upper-cased.
- `CUT_ALIAS = { "CLASSICAL JALI": "JALI" }` — BOM name → cut-part code where they differ.
- `resolveCutPart(itemName, model)` — resolves a frame item to a cut-part key, preferring a
  colour-scoped `"<design>|<colour>::<code>"` over the colour-agnostic one; tries leading code, full
  name, and alias; returns `null` if none (caller then tries a window composite).
- `ORDER_FROM_SEQUENCE = [PRODUCTION, METAL SHOP, ASSEMBLY, PAINT SHOP, PACKAGING]` — dept order.
- `DEPT_MAP` / `normaliseDept()` — collapse raw master dept wording into those 5 (e.g. `METAL`→
  `METAL SHOP`, `INSTALLATION`→`ASSEMBLY`, `PACKING`→`PACKAGING`).
- `MRP_PART_GROUPS = /Frame Panels|Bottom Moulding|Hanging Profiles|Parts/i` — only these BOM groups
  have consumption columns (Parts added so jali is counted).
- `MRP_HEADER` — the 13-column MRP row header (VOUCHER NO., DATE, PARTY NAME, FG ITEM NAME,
  FG QUANTITY, RM ITEM NAME, GODOWN, ORDER FROM, QUANTITY, UOM, MATERIALTYPE, MRP TYPE,
  ORIGINAL MRP NO.).
- `HEADER_FILL="FFFFFF"`, `BANNER_FILL="FFCC99"` (orange dept banners).
- `GRID_BORDER` — thin **black** `000000` border (was grey `999999`; darkened per user).
- `fillSheetRow(ws, r, rgb)` — paint a 13-col row a solid colour.
- `styleGrid(ws, boldRows)` — **the styling backbone**: for every populated cell applies centre
  alignment + black border, bolds `boldRows`, and *also* borders every cell of a merged range whose
  anchor has a value (so merged label cells like Customer Name / MRP No are fully enclosed). Existing
  fills are preserved.
- `buildDeptSheet(acc, fgQtyByCode, mrpNo, partyName, dateStr)` — turns accumulated `DeptRow`s into an
  MRP-format sheet grouped by department with orange banner separators (no banner before the first
  group). Shared by the **MRP** and **HARDWARE** sheets.
- `getExcelSerialDate(date)` — helper retained; note **dates are emitted as strings** `DD-MM-YYYY`
  (`new Date().toLocaleDateString("en-GB").replace(/\//g,"-")`), *not* serials, to fix the `46624`
  bug.

## `exportProjectBom` — the workbook
Produces these sheets:
1. **MRP** — raw-material **consumption** only. For each project line, walks its BOM tree groups
   matching `MRP_PART_GROUPS`, and for each part accumulates, per material row in
   `mrpbom.byDesignColour["<design>|<colour>"]`, `perPart[part] × partQty × lineQty`. Materials are
   grouped by normalized department into the banner layout. Jali is included because `Parts` is in the
   group regex and `CLASSICAL JALI` aliases to the `JALI` column. Aluminium (METAL) is included
   because it now lives in the colour BOM.
2. **HARDWARE** — discrete Master hardware-pack items (BOM `HARDWARE & PACKING` section), **excluding**
   Light-Paper/console items. **Set-expansion:** an item name matching `/(\s*SET OF\s+(\d+)\s*PCS…)/`
   or `/(\s*(\d+)\s*PCS…SET…)/` has its qty multiplied by N, the `( SET OF … )` text stripped from the
   name, UOM set to `PCS`; identical items merge per design (`fgCode|orderFrom|name|uom`).
3. **LIGHT PAPER** — console/electronics items (Light Box / Electric / Touch-up), colour-swapped and
   remote-augmented via `filterTree`.
4. **Cut-list detail sheet(s)** — per-part blocks matching the reference parts-bom sheet:
   - Header block with `Customer Name` (value = party name only) and `MRP No` (no factory bracket),
     merged value cells (`detailMerges`).
   - The upper template block's finish (`outFin`) is derived from the resolved cut data (`cutFinish` =
     the first resolved cut part's outside finish for Classical; else the model `colorName`) — fixing
     the "Teak showing White" bug. **Inside finish = outside finish.**
   - For each frame/hanging item: `emitPartBlock(code, comps)` pushes
     `["","","",code,"","H","W","D","Qty."]` → a description column header → component rows → a blank
     row. Component finish: for Classical use the cut data's `outside`; otherwise use `outFin`.
   - Iterates **both** the `FRAME` and `HANGING PROFILE` sections
     (`cutSections = tree.filter(sec => /FRAME/i.test(sec.section) || /HANGING/i.test(sec.section))`).
   - Column widths copied from the source sheet.

Every sheet is run through `styleGrid` (bold headers, black borders, centred, merged-cell borders).

## Packing lists
### Row model
`PackingRow.box: number | string` — `1` starts a new box/pack, `""` continues the current one.
Box/pack counts are computed by counting rows whose `box` is truthy.

### `getPackingRowsForLine(line, ...)` — rafter/frame packing
- **Frame Panels:** one pack per panel (long panels may split).
- **Bottom Moulding:** all items in **one** pack (`box: i===0?1:""`).
- **Hanging Profiles:** taken from the dedicated `HANGING PROFILE` section
  (`hangSection = tree.find(sec => /HANGING/i.test(sec.section))`), all in **one** pack.
- **Parts (jali):** packed here **only if** `isRawFinish(model, item.name)` — else it goes to the
  console pack (see rule 6).
- `isRawFinish(model, itemName)` resolves the cut part and tests `/raw/i` on its finish.

### `getHardwareRowsForLine(line, lineIdx, mrpNo)` — returns `{ rows, boxes }`
- Splits the hardware item list by `SEPARATE_HW = /MS THREAD ROD|PVC FLOOR PROTECTION SHEET 6X4|
  PLASTIC ROLL FOR PACKING 36 INCH WIDTH/i` into `sepList` and `mainList`.
- `emitPack(title, items)` emits a pack-title row (`box:1`) + item rows. Emits the main pack, then a
  second `"<title> (LOOSE)"` pack for the separate items → **2 hardware packs**.

### `exportRafterPackingList`
- Emits frame/rafter packs per line via `getPackingRowsForLine`, counts `panelBoxCount` (truthy
  `box`), then appends hardware packs, adding their `boxes` to `totalBoxes`. Merges pack-title cells
  (cols 1–3) when a row's style is `section_title`.

### `exportConsolePackingList`
- Emits CONSOLE & ELECTRONICS grouped by BOM group (Light Box / Electric / Touch-up), each a numbered
  PACK. Then **injects the jali** (grouped under key `JALI`) for lines where the jali is **not** raw
  (`!isRawFinish(...)`) — reading the `Parts` group of the FRAME section.

## Buffer / download
`buildWorksheet(...)` is a generic AOA→sheet helper used by the packing lists; final workbooks are
written with `XLSX.writeFile`, prompting a browser download. (Under automation, downloads are
suppressed — verify via Node simulation, see `docs/12`.)

