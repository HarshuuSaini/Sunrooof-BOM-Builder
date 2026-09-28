# 14 · Function & Module Reference (the "API")

> **There is no HTTP/REST/GraphQL API** — no routes, endpoints, request/response bodies, headers, or
> auth to document. The app's public surface is its **TypeScript module/function API**. This file
> documents every exported function/type and the important private helpers, with purpose, inputs,
> outputs, validation, edge cases, and dependencies. For deeper narrative see `docs/06`.

## Module: `src/lib/types.ts` (types)
- `Model` — a configurable product variant (see `docs/04` for fields). Unique key: `code`.
- `BomItem` `{name, qty, uom, size}` · `BomGroup` `{name, qty, uom, size, items[]}` ·
  `BomSection` `{section, groups[]}` · `BomTree = BomSection[]`.
- `Catalog` `{generatedFrom[], designs[], models[], boms{}}`.
- `ProjectLine` `{id, qty, model}` — one line in the project.
- `OrderMeta` — cut-list header metadata; `EMPTY_ORDER_META` is the blank default.
- `FlatRow` `{level, name, size, perUnitQty, actualQty, uom}` — flattened BOM row for display/export.

## Module: `src/lib/catalog.ts`
| Export | Signature | Purpose | Notes |
|---|---|---|---|
| `catalog` | `Catalog` | the parsed `catalog.json` | — |
| `DESIGNS` | `{code,name}[]` | design list for the dropdown | from catalog |
| `sizeClassesFor` | `(designCode) → string[]` | distinct size classes A/B/C for a design | dedup |
| `sizesFor` | `(designCode, sizeClass) → Model[]` | size variants (deduped by `sizeCode`), sorted by console count | |
| `colorsFor` | `(designCode, sizeCode) → Model[]` | colours for a design+size | |
| `findModel` | `(code) → Model?` | model by unique code | |
| `bomFor` | `(model) → BomTree?` | BOM tree for a model: prefers `designs.bomByDesignSize[design][sizeCode]`, falls back to `catalog.boms[bomKey]` | returns `null` if neither (e.g. Classical 8-series) |
| `REMOTE_COLORS` | `readonly ["BLACK","WHITE","GOLD"]` | remote colour options | |
| `RemoteColor` | type | one of the above | |
| `filterTree` | `(tree, includeRemote, remoteColor="BLACK", colorName?) → BomTree` | **applies business rules R1–R3**: swaps Touch-up items by `colorName`; when `includeRemote`, appends `D1 REMOTE <colour>` + `DURACELL ×2` to the electric box | returns a shallow copy; never mutates the cached tree |
| `flattenBom` | `(model, lineQty, includeRemote=true) → FlatRow[]` | flatten a model's tree into scaled rows | levels 0–3 |
| `aggregateItems` | `(lines, includeRemote=true) → {name,uom,qty}[]` | aggregate leaf items across lines | sorted by name |

**Validation/edge cases:** `bomFor` returns `null` for no-BOM models (UI shows a warning);
`filterTree` matches groups by regex (`/touch-?up box/i`, `/electric box/i`) so group-name wording
matters.

## Module: `src/lib/export.ts` (the export "API")
### Public
| Export | Signature | Produces |
|---|---|---|
| `exportProjectBom` | `(lines, includeRemote=true, partyName="Ms.Lata Ahuja", mrpNo="1181", meta?, remoteColor="BLACK") → void` | downloads the BOM workbook: **MRP** + **HARDWARE** + **LIGHT PAPER** + **cut-list** sheets |
| `exportRafterPackingList` | `(lines, partyName, mrpNo, meta?) → void` | downloads the rafter/frame + hardware packing list |
| `exportConsolePackingList` | `(lines, partyName, mrpNo, meta?, includeRemote=true, remoteColor="BLACK") → void` | downloads the console/electronics (+ jali when non-raw) packing list |

**Inputs:** `lines: ProjectLine[]` (must be non-empty; UI disables the buttons otherwise), party/MRP
strings for the sheet headers, optional `OrderMeta` for the cut-list header, remote flag/colour.
**Output:** side-effect only — triggers a browser download via `XLSX.writeFile`.

### Key private helpers (document-worthy)
| Helper | Signature | Purpose |
|---|---|---|
| `resolveCutPart` | `(itemName, model) → string\|null` | BOM item → cut-part key, colour-scoped preferred; tries code/name/alias; `null` if none |
| `partCodeOf` / `baseNameOf` | `(name) → string` | extract leading part code / strip `(dims)` suffix |
| `normaliseDept` | `(d) → string` | collapse master dept wording into the 5 export departments |
| `buildDeptSheet` | `(acc, fgQtyByCode, mrpNo, partyName, dateStr) → ws` | MRP-format sheet with dept banners; shared by MRP + HARDWARE |
| `fillSheetRow` | `(ws, r, rgb) → void` | paint a 13-col row a solid fill |
| `styleGrid` | `(ws, boldRows=[]) → void` | centre + black-border every populated cell, bold header rows, border merged label cells |
| `getPackingRowsForLine` | `(line, ...) → PackingRow[]` | frame panels (1 pack each) + bottom moulding (1 pack) + hanging profiles (1 pack) + jali if raw |
| `isRawFinish` | `(model, itemName) → boolean` | resolve cut part, test `/raw/i` on finish (jali routing) |
| `getHardwareRowsForLine` | `(line, lineIdx, mrpNo) → {rows, boxes}` | hardware split into main pack + `(LOOSE)` pack for `SEPARATE_HW` items |
| `buildWorksheet` | `(...) → ws` | generic AOA→sheet builder for packing lists |

**Constants that encode rules:** `ORDER_FROM_SEQUENCE`, `DEPT_MAP`, `MRP_PART_GROUPS`, `MRP_HEADER`,
`HEADER_FILL`, `BANNER_FILL`, `GRID_BORDER`, `CUT_ALIAS`, `SEPARATE_HW` (the loose-pack matcher).

## Module: `src/components/SunrooofBomBuilder.tsx`
The single React client component. State: `designCode, sizeClass, sizeCode, colorCode, qty,
includeRemote, remoteColor, lines, counter, partyName, mrpNo, orderMeta, showOrderDetails`. Handlers:
`onDesign/onSizeClass/onSize` (cascading resets), `addLine/removeLine`, `upMeta`. Derived: `model`,
`tree = bomFor(model)`, `shownTree = filterTree(...)`, `totalValue`. Sub-component `FragmentGroup`
renders a BOM group + its items. Wires the three export buttons to `export.ts`.

## App shell (`src/app/`)
- `layout.tsx` — root layout, sets `<title>Sunrooof BOM Builder</title>`, imports `globals.css`.
- `page.tsx` — `redirect("/builder")`.
- `builder/page.tsx` — renders `<SunrooofBomBuilder/>`.

## Build scripts (`build-*.js`) — see `docs/05`
Node CLIs, not imported by the app. Each reads Excel (via `xlsx`) and writes one `src/data/*.json`.
Inputs: hardcoded workbook path(s). Outputs: the JSON artifact + console summary.

