# 04 · Data Model ("Database")

> **There is no SQL or NoSQL database.** The project's "database" is four JSON files under
> `source/src/data/`, compiled offline from Excel masters (see `docs/05`) and imported at build time.
> This document is the schema, relationships, constraints, and sample data for those files, plus an
> ER-style diagram of how they relate. TypeScript interfaces for the runtime-facing shapes live in
> `source/src/lib/types.ts`.

## Entity-relationship overview

```
                         ┌───────────────────────────┐
                         │  catalog.json             │
                         │  ─ designs[] (code,name)  │
                         │  ─ models[]  (127)        │
                         │  ─ boms{}    (legacy)     │
                         └────────────┬──────────────┘
        model.designCode+sizeCode ────┤ join key
                                       ▼
   ┌──────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────┐
   │ designs.json             │   │ mrpbom.json              │   │ partscuts.json           │
   │ bomByDesignSize          │   │ byDesignColour           │   │ cutsByPart               │
   │   [designCode][sizeCode] │   │   ["CL|WH"] = rows[]     │   │   ["CL|WH::COA"] = cut   │
   │     = BomTree            │   │   row.perPart[partCode]  │   │ compositesByDesign       │
   │ touchByColour[colorName] │   │ hpByDesign (unused now)  │   │   [designCode] = [keys]  │
   │ variantsByDesign         │   └──────────────────────────┘   └──────────────────────────┘
   └──────────────────────────┘        join: partCode              join: "<design|colour>::<partCode>"
      join: partCode (item.name)     (columns of consumption)      (per-part cut breakdown)
```

**Join keys (the "foreign keys")**
- A **Model** (`catalog.json`) links to its **BOM tree** by `designCode` + `sizeCode`
  (`designs.bomByDesignSize[designCode][sizeCode]`).
- A **part code** inside a BOM tree item name (e.g. `CO27`, `CBMC`, `JALI`) links to:
  - its **raw-material consumption** as a column of `mrpbom.byDesignColour["<CL>|<WH>"][*].perPart`;
  - its **cut breakdown** at `partscuts.cutsByPart["<designCode>|<colourCode>::<partCode>"]`
    (Classical is colour-scoped; window designs are design-scoped via `compositesByDesign`).
- **Colour** links a model to its **touch-up items** via `designs.touchByColour[colorName]`.

---

## 1) `catalog.json`
Shape (`Catalog` in types.ts):
```jsonc
{
  "generatedFrom": ["SUNROOOF BOM MAIN.xlsx", "SUNROOOF BOM DETAIL.xlsx"],
  "designs": [ { "code": "CL", "name": "CLASSICAL" }, ... ],   // 10 designs
  "models":  [ Model, ... ],                                    // 127 models
  "boms":    { "CL2A-WH": BomTree, ... }                        // legacy fallback BOMs
}
```
**Model** (constraints in parentheses):
| Field | Type | Notes / constraint |
|---|---|---|
| `sn` | number | serial |
| `designName` | string | e.g. `CLASSICAL` |
| `designCode` | string | `CL/MI/GR/FW/LW2/LW4/SFW/SLW/ARW/DAW` |
| `sizeCode` | string | `<consoles><sizeClass>` e.g. `2A`,`4B`,`6C` |
| `colorCode` | string | `WH/TK/BZ/TG` |
| `code` | string | **unique** model id, `"<sizeCode>-<colorCode>"` prefixed by design, e.g. `CL2A-WH` |
| `sizeClass` | string | `A/B/C` |
| `colorName` | string | `WHITE/TEAK/REGAL BRONZE/TITANIUM GREY` |
| `cpLxW` | string | console panel layout e.g. `2x1` |
| `console` | number | number of light consoles (≥1) |
| `length,width,height` | number | mm |
| `price,mrp` | number | INR; some windows have `0` (placeholder) |
| `bomKey` | string\|null | key into `boms` (null → no detail sheet) |

**Sample model**
```json
{"sn":1,"designName":"CLASSICAL","designCode":"CL","sizeCode":"2A","colorCode":"WH",
 "code":"CL2A-WH","sizeClass":"A","colorName":"WHITE","cpLxW":"2x1","console":2,
 "length":1250,"width":850,"height":210,"price":89000,"mrp":106800,"bomKey":"CL2A-WH"}
```
**Counts:** CL 24, MI 48, GR 48, FW/LW2/LW4/SFW/SLW/ARW/DAW = 1 each → **127**.

---

## 2) `designs.json`  (← `build-designs.js`, from `Inventory SUNROOOF (5).xlsx`)
```jsonc
{
  "generatedFrom": "Inventory SUNROOOF (5).xlsx",
  "bomByDesignSize": { "CL": { "2A": BomTree, ..., "6C": BomTree }, "MI": {...}, ... },
  "variantsByDesign": { "CL": [ {code,sizeCode,layout,widthConsoles,depthConsoles,consoles,sizeLabel,...} ] },
  "touchByColour":   { "WHITE": [ {name,qty,uom,size,order}, ... ], "TEAK":[...], "REGAL BRONZE":[...], "TITANIUM GREY":[...] }
}
```
**BomTree** = `BomSection[]`; each section has `groups[]`; each group has `items[]`
(`{name, qty, uom, size}`). Sections seen in practice:
`FRAME (HDHMR)` (groups *Frame Panels*, *Bottom Moulding*, *Parts*), `HANGING PROFILE`
(group *Hanging Profiles*), `HARDWARE & PACKING`, `CONSOLE & ELECTRONICS`
(*Light Box* / *ELECTRIC BOX* / *Touch-up Box*).

**Sample (Classical 6C → FRAME → Frame Panels)**
```json
[{"name":"CO27 (210X2650)","qty":2,"uom":"PCS","size":"2650x48x210"},
 {"name":"CO13 (210X1300)","qty":2,"uom":"PCS","size":"1300x48x210"},
 {"name":"CO6 (210X2700)","qty":2,"uom":"PCS","size":"2700x48x210"},
 {"name":"CJ12 (200X1200)","qty":6,"uom":"PCS","size":"1200x196x200"},
 {"name":"CR27 (205X2700)","qty":2,"uom":"PCS","size":"2700x196x205"},
 {"name":"CC MOULDING","qty":9,"uom":"PCS","size":"1200x22x44"}]
```
**touchByColour sample (WHITE):**
```json
[{"name":"A4 SIZE CLEANING CLOTHES (Dhoti)","qty":1,"uom":"PCS","size":"","order":"Touch-up"},
 {"name":"COLIN CLEANER","qty":0.1,"uom":"LTR.","size":"","order":"Touch-up"}]
```

---

## 3) `mrpbom.json`  (← `build-mrpbom.js`, from `Inventory SUNROOOF (5).xlsx`)
```jsonc
{
  "generatedFrom": "Inventory SUNROOOF (5).xlsx",
  "byDesignColour": {
    "CL|WH": [ { "name":"ALUMINIUM PROFILES (SL-01, 4100MM)", "dept":"METAL", "uom":"MTR",
                 "perPart": { "CHPA":1.258, "CHPB":2.608, "CHP4":1.8, ... } }, ... ],
    "CL|TK": [ ... ],  "MI|BZ":[...], "MI|TG":[...], "GR|WH":[...], "GR|TK":[...],
    "FW|WH":[...], "LW2|WH":[...], "LW4|WH":[...], "SFW|WH":[...], "SLW|WH":[...], "ARW|WH":[...], "DAW|WH":[...]
  },
  "hpByDesign": { "CL": {...}, "MI": {...} }   // NOTE: unused now (aluminium moved into colour BOM)
}
```
- **Row** = one raw material: `{name, dept, uom, perPart}`. `dept` ∈ raw values later normalized to the
  5 export departments. `perPart[partCode]` = quantity of this material consumed to make **one** of
  that part.
- **MRP consumption** for a project line = Σ over parts of `perPart[part] × (part qty in the BOM)`.
- **Colour-specific** because paints/finishes differ per colour. Classical keys `CL|WH` and `CL|TK`.
  **Constraint / known gap:** `CL|WH` columns include `CO27`,`CO13` (post-split); `CL|TK` still has
  `COC` (see `AI_MEMORY.md` §7).

---

## 4) `partscuts.json`  (← `build-partscuts.js`, from `parts bom (2).xlsx`)
```jsonc
{
  "generatedFrom": "parts bom (2).xlsx",
  "cutsByPart": {
    "CL|WH::COA": { "H":210, "W":25, "D":1250, "comps":[ CutComp, ... ] },
    "CL|TK::COA": { ... },              // Classical is COLOUR-scoped (WH vs TK differ only in finish)
    ...
  },
  "compositesByDesign": {               // window designs are DESIGN-scoped (part names collide across sheets)
    "FW":  ["FW::BORDER","FW::INNER PARTS","FW::SHUTTER"],
    "LW2": ["LW2::LOUVERED WINDOW"], "LW4":["LW4::LOUVERED WINDOW"],
    "SFW": ["SFW::Sun French","SFW::PALMET S"], "SLW":["SLW::LOUVERED WINDOW","SLW::PALMET L"],
    "ARW": ["ARW::ARCH WINDOW"], "DAW":["DAW::D. ARCH WINDOW"]
  }
}
```
**CutComp** (one cut piece of a part): `{comp, proc, H, W, D, qty, thickness, raw, process, inside,
outside, grain, frontEB, ebDetail}`. `outside`/`inside` = finish (e.g. `White`, `NEW TEAK`, `Base`).
**Sample `CL|WH::COA`** (first comp):
```json
{"comp":"Side","proc":"","H":210,"W":0,"D":1250,"qty":1,"thickness":25,
 "raw":"HDHMR","process":"LQD","inside":"Base","outside":"White","grain":"0","frontEB":"NA","ebDetail":"NA"}
```
**Constraint / known gap:** cut-list still defines `COC` (3950) and `CBMC` (4000) for both colours;
the new `CO27/CO13` parts have **no** cut entry (intentional — see `AI_MEMORY.md` §7).

---

## Indexes / lookups (how the app queries this "DB")
There are no DB indexes; lookups are plain object-key access, all O(1) or small linear scans:
- `catalog.models.find(m => m.code === code)` — model by id.
- `designs.bomByDesignSize[designCode][sizeCode]` — BOM tree.
- `mrpbom.byDesignColour["${designCode}|${colourCode}"]` — consumption rows.
- `partscuts.cutsByPart["${designCode}|${colourCode}::${partCode}"]` — cut breakdown.
- `designs.touchByColour[colorName.toUpperCase()]` — touch-up items.

## Data volume
`catalog.json` 308 KB · `designs.json` 360 KB · `mrpbom.json` 124 KB · `partscuts.json` 64 KB.
All bundled into the client build.

