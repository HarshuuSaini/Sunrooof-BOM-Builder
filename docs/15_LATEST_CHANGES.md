# Latest Implementation Changes

This file records work completed after the original handover documentation snapshot.

## Model-code explanation

The preview now decodes the selected model code directly below the code. For example, `CL2C-WH` is presented as:

- `CL` — Classical design
- `2C` — `2 × 3` layout and six consoles
- `WH` — White colour
- `SIZE` — overall `L × W × H` dimensions in millimetres

The implementation is the `ModelCodeDetails` component in `src/components/SunrooofBomBuilder.tsx`. Its responsive styles are in `src/app/globals.css`.

## Packing-list completion

- Hanging-profile items are read from the dedicated `HANGING PROFILE` section for every supported design.
- All hanging-profile items for a line are packed in one pack.
- All bottom-moulding items for a line are packed in one pack.
- Jali routing is finish-dependent: raw jali ships with the frame; finished jali ships in the console packing list.
- Hardware is split into a main hardware pack and a separate loose pack containing thread rod, floor-protection sheet, and 36-inch packing plastic roll.
- Packing-list box totals count packs rather than item rows.

## Export status

- MRP contains only colour-BOM consumption items.
- Hardware is exported separately, expands `SET OF N PCS` descriptions to actual pieces, strips the set suffix, and merges duplicate item names per design.
- Light-paper/console items remain separate from hardware.
- Export headings are bold, populated cells have dark borders, content is centre-aligned, and dates use `DD-MM-YYYY` rather than Excel serial values.
- Cutting-list metadata and per-part blocks follow the supplied workbook format.

## Verification status

The current source passes:

```bash
npx tsc --noEmit
npm run build
```

The Next.js build warning about multiple lockfiles is environmental: another lockfile exists above the project directory. It does not prevent compilation or deployment.
