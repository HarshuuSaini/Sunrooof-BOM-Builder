# AI_MEMORY.md — Continue this project with zero questions

You are picking up the **Sunrooof BOM Builder**. This file is the single source of truth for
*how to think about* the project. Pair it with `docs/` for detail and `source/` for exact code.

---

## 1. Project philosophy

- **The Excel masters are the source of truth, not the code.** Product engineers maintain product
  knowledge (parts, consumption, cut breakdowns, prices) in `.xlsx` "master" workbooks. The app's
  job is to *faithfully compile and present* that knowledge and to *emit factory-ready Excel*, not
  to invent product logic. When in doubt, match the workbook.
- **Deterministic, offline data compilation.** Excel → `build-*.js` → `src/data/*.json`. The running
  app never reads Excel; it reads the compiled JSON. This keeps the client fast and dependency-free
  at runtime and makes every data change reviewable as a JSON diff.
- **Client-only, zero-backend.** No server, no DB, no auth, no network calls at runtime. Everything
  (config UI + Excel generation) runs in the browser. This is deliberate: the tool is an internal
  utility for a small team; simplicity and zero ops cost win.
- **Faithful factory output.** Exported sheets must match the formatting of the reference factory
  documents (MRP-1173 style) closely enough that the user does **not** need to edit the Excel after
  download: bold headings, bordered data cells, centred cells, merged label cells, department banner
  rows in orange `FFCC99`, real dates (not serials), etc.

## 2. Coding standards & conventions

- **TypeScript strict**, Next.js App Router, React function components + hooks. No class components.
- **Path alias:** `@/…` → `source/src/…` (see `tsconfig.json`).
- **State:** local `useState` in the one big client component (`SunrooofBomBuilder.tsx`). No Redux,
  no context, no server state. Keep it that way unless the app grows a second page.
- **Naming:** design codes `CL/MI/GR` + window codes `FW/LW2/LW4/SFW/SLW/ARW/DAW`; colour codes
  `WH/TK/BZ/TG`; size codes like `2A/4B/6C` (`<consoles><sizeClass>`); model code `CL2A-WH`.
- **Excel styling** uses `xlsx-js-style` (a styled fork of SheetJS). Plain `xlsx` is used only inside
  the `build-*.js` scripts for *reading* workbooks. Both are dependencies — do not confuse them.
- **Comments:** existing files carry dense header comments explaining the *why* and the exact xlsx
  quirks (e.g. "sheet name has a trailing space"). Preserve and extend that style.
- **The authoritative check is `npm run build`.** `tsc --noEmit` is a fast pre-check. Ignore stale
  Turbopack dev-console errors after edits (`rm -rf .next` clears them).

## 3. Architecture in 6 lines

```
Excel masters (~/Downloads/*.xlsx)
   └─ build-designs.js / build-mrpbom.js / build-partscuts.js / build-data.js   (offline, Node)
        └─ src/data/{designs,mrpbom,partscuts,catalog}.json                      (committed)
             └─ src/lib/catalog.ts   (model lookup, BOM tree assembly, remote/colour options)
                  └─ src/components/SunrooofBomBuilder.tsx   (the only screen)
                       └─ src/lib/export.ts   (browser-side Excel generation: 3 exporters)
```

## 4. Business rules that must survive refactors

These are *product* rules discovered/confirmed with the user. Don't "clean them away."

1. **Electric box is always present.** Including the **remote** adds `D1 REMOTE <COLOR>` (colour ∈
   {BLACK, WHITE, GOLD}, chosen in a selector shown only when *Include Remote* is checked) + 2×
   `DURACELL` batteries to the electric box.
2. **Touch-up box is colour-specific.** Paint/stainer differs per colour; swapped by `colorName` via
   `touchByColour` (White / Teak / Regal Bronze / Titanium Grey).
3. **MRP sheet = colour-BOM CONSUMPTION only** (Σ material-per-part × part qty), incl. aluminium
   (aluminium was moved into the colour BOM, so HP-BOM sheets are now unused). Part groups counted:
   Frame Panels, Bottom Moulding, Hanging Profiles, Parts (jali).
4. **HARDWARE sheet = discrete Master hardware-pack items**, excluding Light-Paper/console items.
   `SET OF N PCS` (and `(N PCS … SET)`) in an item name is **expanded** to actual pieces
   (`qty × N`, UOM→`PCS`) and merged per design.
5. **Cut-list (per-part blocks)** must mirror the reference parts-bom sheet exactly: per-part
   `CODE H W D Qty.` header → column header → components → blank row. Borders black. Inside finish =
   outside finish. Classical is **colour-scoped** (`CL|WH::…` vs `CL|TK::…`, differing only in
   finish); other designs take the selected model colour. Labels: `Customer Name` (value = party name
   only, no code) and `MRP No` (no factory bracket).
6. **Jali placement rule:** if the jali finish is **raw** → it ships **with the frame**; otherwise it
   ships **with the console pack**. Jali also appears in the MRP (`CLASSICAL JALI` → `JALI` column).
7. **Packing:** Bottom Moulding items → **one pack**; Hanging Profile items → **one pack**; Frame
   panels → one pack each (long panels may split). Hardware splits into **2 packs**: a separate
   "loose" pack for `MS THREAD ROD 10 MM …`, `PVC FLOOR PROTECTION SHEET 6X4`,
   `PLASTIC ROLL FOR PACKING 36 INCH WIDTH`; everything else in one main hardware pack.
8. **SUNROOOF LOGO qty = 2 per single unit.** (History: was briefly clamped to 1, then reversed.)
9. **Minimalist Light Box** item literally named `GLASS` is renamed to
   `5MM CLEAR FLUTED GLASS 369X1169`.
10. **Dates** in exports are real dates (`DD-MM-YYYY`), never Excel serials like `46624`.
11. **All export sheets:** bold headings, borders on every populated cell, centre-aligned, merged
    label value cells where the reference merges them.

## 5. Design decisions & why (accepted)

- **Static JSON over a DB/API:** small internal tool, product data changes in batches via Excel, and
  keeping it static means zero backend ops and trivially cacheable deploys. *Rejected:* wiring a DB
  or a `/api` route — unnecessary complexity for the use case.
- **Compile Excel offline, not at runtime:** parsing masters in the browser would ship megabytes of
  xlsx and be slow/fragile; the `build-*.js` step produces a compact, reviewable JSON artifact.
- **One monolithic screen component:** the tool is a single workflow; splitting into many components
  or adding routing would add ceremony without benefit at current size.
- **`xlsx-js-style` for output:** plain SheetJS community build drops cell styles; the styled fork is
  required to meet the "don't-edit-after-download" formatting bar.

## 6. Assumptions

- The project operator runs the build scripts locally on macOS with the master
  workbooks in `~/Downloads`. Paths in `build-*.js` are absolute to that machine — **update them**
  if you run elsewhere.
- Product masters may be **internally inconsistent** across colours/files (see rule below). The app
  compiles what it is given; it does not auto-reconcile unless explicitly asked.
- Only the **Classical** design has colour-split cut-lists; Minimalist/Green have no cut blocks.

## 7. Known limitations (current)

- **Classical 8-series (8A/8B/8C)** appears in the catalog dropdown but has **no BOM** in the master
  matrix (matrix defines only 2/4/6). The UI shows a warning banner and falls back to spec/price
  only. Decision pending: hide 8-series or await master data.
- **4 window designs have ₹0 placeholder prices:** Sun French (`SFW`), Sun Louvered (`SLW`),
  Arch (`ARW`), Double Arch (`DAW`) — not present in the Master pricing blocks; awaiting user.
- **Master inconsistency (as of `Inventory SUNROOOF (5).xlsx`):** the `COC (210×3950)` → `CO27
  (210×2650)` + `CO13 (210×1300)` split and `CBMC` 4000→1350 change were applied to **WHITE only**.
  **Teak/Wooden colour BOMs still use `COC`**, and the cut-list file (`parts bom (2).xlsx`, not
  re-issued) still defines `COC`/`CBMC-4000`. **Per explicit user decision this was left "White only,
  as-is"** — do not auto-propagate unless asked. Result: Classical C-size cut-list shows old `COC`
  while BOM/MRP show the split; CO27/CO13 have no cut breakdown.
- **No tests.** Verification is manual + deterministic Node simulations (see `docs/12_TESTING.md`).
- **Browser downloads under automation are suppressed** on this machine, so verification of exported
  files is done via Node simulations of the export code path, not by opening the downloaded file.

## 8. Future plans / roadmap (see docs/13 for the prioritized backlog)

- Resolve the Classical 8-series BOM gap.
- Fill the 4 missing window prices.
- Optionally realign Teak/Wooden Classical BOMs + cut-list with the White profile split.
- Possible: a git repo + CI, automated export snapshot tests, and a small "master health" linter that
  flags cross-colour/cross-file inconsistencies before a deploy.

## 9. Environment / deploy facts you'll need

- **Vercel project:** `sunrooof-bomb-builder`, org `team_3kNUUimkx3oLM7Mfudka1f6S`
  (scope `magppiesilverstonepvtltd`). Deploy CLI in `README.md` / `docs/10`.
- **A non-expiring Vercel token** was used previously. **It is a secret — it is NOT included here.**
  Store it in your own environment (see `.env.example`) and pass via `--token`.
- **No runtime env vars are required** for the app itself (nothing is read from `process.env` at
  runtime). Env vars only matter for the deploy tooling.

## 10. How to make changes safely (checklist)

1. If the change is data: edit the right `build-*.js` `FILE` path → run it → diff the JSON.
2. `npx tsc --noEmit` then `rm -rf .next && npm run build` (authoritative).
3. If observable, verify via the dev server / a Node simulation of the export path.
4. Back up `src/data/*.json` to `_backup/<timestamp>/` before regenerating (existing convention).
5. Deploy; record the **new** deployment id and the **previous** id (rollback target).
