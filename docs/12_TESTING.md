# 12 · Testing

## Current state
There is **no automated test suite** (no Jest/Vitest/Playwright, no `test` script). Verification to
date has been **manual + deterministic Node simulations** of the export/data code paths. This section
documents the working checklist and gives a plan for adding real tests.

## Why Node simulations
Under this machine's automation, **browser downloads are suppressed** (exported `.xlsx` files never
reach `~/Downloads`). So instead of opening a downloaded workbook, verification runs the same logic in
Node against the compiled JSON — e.g. confirming which parts/columns/packs are produced. Examples used
in practice are in `docs/05` (data checks) and below (export checks).

## Authoritative checks (run these on every change)
```bash
cd source
npx tsc --noEmit          # type check (fast pre-check)
rm -rf .next && npm run build   # AUTHORITATIVE compile/build check
```

## Manual testing checklist
Configurator:
- [ ] Each design loads valid Layout → Size → Colour cascades; changing a parent resets children.
- [ ] Quantity < 1 is clamped to 1.
- [ ] "Include Remote" toggles the Remote-Colour selector; default ON / BLACK.
- [ ] Classical **8A/8B/8C** shows the "no detail BOM" warning (specs/price still shown).

BOM preview:
- [ ] Sections/groups/items render with size (mm), qty, UoM.
- [ ] With remote on, the electric box shows `D1 REMOTE <colour>` + `DURACELL ×2`.
- [ ] Touch-up items change with colour.
- [ ] Print/PDF renders the print header and hides `.no-print` controls.

Exports (open the downloaded workbook in Excel, or simulate in Node):
- [ ] **MRP** sheet: consumption only, department banners (orange), real date `DD-MM-YYYY`, jali
      counted, aluminium (METAL) present.
- [ ] **HARDWARE** sheet: `SET OF N` items expanded to pieces, UOM `PCS`, merged duplicates,
      no Light-Paper items.
- [ ] **LIGHT PAPER** sheet: console/electronics, `GLASS` renamed, SUNROOOF LOGO qty 2.
- [ ] **Cut-list** sheets: per-part blocks (`CODE H W D Qty.`), black borders, inside=outside finish,
      finish matches colour (Teak shows Teak), `Customer Name`/`MRP No` labels with merged values,
      hanging profile present.
- [ ] **Rafter Packing List**: frame panels one pack each, bottom moulding one pack, hanging profile
      one pack, hardware = 2 packs (main + LOOSE), box count = pack count.
- [ ] **Console Packing List**: Light Box / Electric / Touch-up packs; jali present when non-raw.

## Example Node simulation (export-path spot checks)
```js
// From source/ — verify Classical White frame parts + Teak retains COC:
const d = require("./src/data/designs.json");
const frame = d.bomByDesignSize.CL["6C"].find(s => /FRAME/i.test(s.section));
console.log(frame.groups.flatMap(g => g.items.map(i => i.name)));

const m = require("./src/data/mrpbom.json");
const cols = a => [...new Set(a.flatMap(r => Object.keys(r.perPart || {})))];
console.log("WH", cols(m.byDesignColour["CL|WH"]).filter(c => /^CO/.test(c)));  // CO27, CO13
console.log("TK", cols(m.byDesignColour["CL|TK"]).filter(c => /^CO/.test(c)));  // COC
```

## Recommended test plan (future)
- **Unit (Vitest):** `resolveCutPart`, `normaliseDept`, set-expansion regex, `isRawFinish`,
  `filterTree` (remote/colour), MRP consumption math.
- **Snapshot:** run each exporter against a fixed set of `ProjectLine`s and snapshot the resulting
  worksheet AOA (sheet-by-sheet cell values + which cells are bordered/bold) — this locks the factory
  formatting rules (R11–R18) against regressions.
- **Data-integrity linter:** assert every part referenced in a BOM tree has a consumption column and
  (for Classical) a cut entry; flag cross-colour/cross-file inconsistencies (would have caught the
  `COC` White-only split). Wire into `npm run build` pre-step.
- **E2E (Playwright):** load `/builder`, add a line, click each export, assert a file downloads and
  opens.

## Test data
Use representative lines: `CL6C-WH` (largest Classical, exercises the split + jali + hanging),
`CL2A-TK` (Teak finish path), `MI…` (no cut blocks), a window design (`FW`/`ARW`) for composites, and
a Classical `8A` (no-BOM warning path).

