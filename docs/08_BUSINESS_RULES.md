# 08 · Business Rules (complete)

Every product/business rule the app encodes, with where it lives and its edge cases. These are
*product decisions confirmed with the user* — preserve them across refactors.

| # | Rule | Where enforced | Edge cases / notes |
|---|------|----------------|--------------------|
| R1 | **Electric box always present.** | `filterTree` (`catalog.ts`) | Present regardless of the remote toggle. |
| R2 | **Include Remote → add `D1 REMOTE <colour>` + 2× `DURACELL`** to the electric box. Colour ∈ {BLACK, WHITE, GOLD}. | `filterTree`; UI `remoteColor` state | Remote-colour `<select>` shows **only** when Include Remote is checked. Default remote colour BLACK; default toggle ON. |
| R3 | **Touch-up box is colour-specific** (paint/stainer per colour). | `filterTree` swaps `touchByColour[colorName]` | Colours: White / Teak / Regal Bronze / Titanium Grey. |
| R4 | **MRP sheet = raw-material CONSUMPTION only** (Σ `perPart × partQty × lineQty`), incl. aluminium. | `exportProjectBom` MRP build; `mrpbom.json` | Only groups matching `MRP_PART_GROUPS` (Frame Panels, Bottom Moulding, Hanging Profiles, Parts) contribute. HP-BOM sheets unused. |
| R5 | **HARDWARE sheet = discrete hardware-pack items**, excluding Light-Paper/console items. | `exportProjectBom` HARDWARE build | Department from master col-2 `order`, normalized via `DEPT_MAP`. |
| R6 | **Set expansion:** `SET OF N PCS` / `(N PCS … SET)` in a hardware name → qty ×N, strip the bracket text, UOM→`PCS`, merge identical per design. | HARDWARE accumulation (`hwAcc`) | Also covers the threaded-rod `(2 PCS THREADED ROS SET)`. Master now also sets some screw UOM to `SET` (rule R6 still expands by the name). |
| R7 | **LIGHT PAPER sheet = console/electronics** items. | `exportProjectBom` LIGHT PAPER build | Colour-swapped + remote-augmented via `filterTree`. |
| R8 | **Minimalist Light Box `GLASS` → `5MM CLEAR FLUTED GLASS 369X1169`.** | `build-designs.js` (`renameItem`) | Baked into `designs.json` at compile time. |
| R9 | **SUNROOOF LOGO qty = 2 per single unit.** | `build-designs.js` (both parsers) | History: briefly clamped to 1, then reversed to 2. |
| R10 | **Dates are real `DD-MM-YYYY`, never Excel serials.** | `export.ts` `dateStr` | Fixes the `46624` bug. |
| R11 | **All export sheets:** bold headings, black borders on every populated cell, centre-aligned, merged label value cells bordered. | `styleGrid`, `GRID_BORDER` | Border colour black `000000` (was grey). |
| R12 | **Departments normalized to 5:** PRODUCTION / METAL SHOP / ASSEMBLY / PAINT SHOP / PACKAGING, banner rows orange `FFCC99`, header white. | `DEPT_MAP`, `buildDeptSheet`, `BANNER_FILL` | Matches reference doc MRP-1173. No banner before the first group. |
| R13 | **Cut-list = per-part blocks** matching the reference sheet exactly (`CODE H W D Qty.` header → column header → components → blank). | `emitPartBlock` in `exportProjectBom` | Iterates FRAME **and** HANGING PROFILE sections. |
| R14 | **Cut-list finish reflects the selected colour**; **inside finish = outside finish**. | detail-sheet `outFin`/`cutFinish` | Classical is colour-scoped (`CL|WH::`/`CL|TK::`); other designs use `colorName`. Fixes the "Teak shows White" bug. |
| R15 | **Cut-list labels:** `Customer Name` (party name only, no code) and `MRP No` (no factory bracket); value cells merged. | detail header + `detailMerges` | So the user doesn't re-edit in Excel. |
| R16 | **Jali placement:** raw finish → ships **with the frame**; otherwise → **with the console pack**. Jali also appears in the MRP (`CLASSICAL JALI`→`JALI`). | `isRawFinish`; `getPackingRowsForLine`; `exportConsolePackingList`; `CUT_ALIAS` | Currently no colour is "raw", so jali → console pack in practice; the raw→frame branch is ready. |
| R17 | **Bottom Moulding → one pack**; **Hanging Profile → one pack**; **Frame panels → one pack each** (long panels may split). | `getPackingRowsForLine` | Hanging profiles read from the dedicated `HANGING PROFILE` section (bug fix). |
| R18 | **Hardware → 2 packs:** a separate "(LOOSE)" pack for `MS THREAD ROD 10 MM …`, `PVC FLOOR PROTECTION SHEET 6X4`, `PLASTIC ROLL FOR PACKING 36 INCH WIDTH`; everything else in one main pack. | `getHardwareRowsForLine`, `SEPARATE_HW` | Box count = number of packs (truthy `box`), not rows. |
| R19 | **Classical is colour-split** in cut-list; Minimalist/Green have no cut blocks; window designs are cut into composites. | `partscuts.json`, `compositesByDesign` | Windows: FW→BORDER+INNER PARTS+SHUTTER, etc. |
| R20 | **No BOM → show warning, keep specs/price.** | UI (Card ②) + `bomFor` fallback | Classical 8-series (8A/8B/8C): matrix defines only 2/4/6. |

## Calculations
- **MRP consumption qty** for a material `m` = `Σ_parts perPart[part] × partQty(part) × lineQty`,
  rounded to 6 dp (`Math.round(q*1e6)/1e6`).
- **Line price** = `model.price × line.qty`; **project total** = `Σ line prices`.
- **FG quantity** per code carried through `fgQtyByCode` into the MRP/HARDWARE sheets.
- **Set piece count** = `qty × N` from the `SET OF N` in the item name.

## Cross-cutting edge cases to watch
- **Master inconsistency** (colours updated unevenly, cut file not re-issued) → the app compiles
  faithfully; C-size Classical currently shows split parts in BOM/MRP but `COC` in the cut-list
  (intentional; `AI_MEMORY.md` §7).
- **Zero-price windows** (SFW/SLW/ARW/DAW) — line price/total will read ₹0 until prices are supplied.
- **Long panels** in packing may split into multiple physical pieces within one pack.

