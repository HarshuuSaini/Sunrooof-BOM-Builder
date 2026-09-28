# 13 · Bugs & Prioritized Backlog

## Known issues / data gaps (open)

| ID | Severity | Issue | Repro | Suggested fix |
|----|----------|-------|-------|---------------|
| B1 | Medium | **Classical 8-series has no BOM.** 8A/8B/8C appear in the dropdown but the master matrix defines only 2/4/6. | Configure Classical → Size 8A → BOM shows the warning banner, no items. | Either add 8-series columns to `Master- Classical` and regenerate, or hide 8A/8B/8C from the size list (filter in `catalog.ts`/`build-data.js`). Awaiting user decision. |
| B2 | Medium | **4 window prices are ₹0.** SFW/SLW/ARW/DAW have placeholder prices. | Add a Sun French / Arch / etc. line → line price and total read ₹0. | Add these to the master pricing blocks and regenerate `catalog.json`. Awaiting user. |
| B3 | Medium | **Master colour inconsistency (COC split).** In `Inventory SUNROOOF (5).xlsx` the `COC→CO27/CO13` split + `CBMC 4000→1350` landed in **WHITE only**; Teak/Wooden BOMs still use `COC`, and `parts bom (2).xlsx` still defines `COC`/`CBMC-4000`. | Classical C-size: BOM/MRP show CO27/CO13 (White) but the cut-list shows `COC`; Teak MRP still uses `COC`. CO27/CO13 have no cut breakdown. | **Intentionally left "White only, as-is" per user.** To align: apply the split to `Classical BOM(TEAK/WOODEN)` + re-issue the cut file, then regenerate. |
| B4 | Low | **No mobile-optimized layout.** Reflows by wrapping only. | Open on a narrow viewport. | Add breakpoints / stacked layout in `globals.css` if mobile use is needed. |
| B5 | Low | **Downloads suppressed under automation** (environmental, not an app bug). | Trigger an export from an automation browser → no file in `~/Downloads`. | Verify via Node simulation, or export from a normal browser. |

## Historical bugs (fixed — kept for context)
- **Hanging profile missing from cut-list** — only the FRAME section was iterated; the hanging
  profile is in a separate `HANGING PROFILE` section. Fixed to iterate both. (A brace mismatch during
  the edit briefly caused a parse error ~line 404, corrected.)
- **Hanging profile missing from packing list** — same root cause in `getPackingRowsForLine`; fixed to
  read the dedicated section.
- **Cut-list upper block showed White for Classical Teak** — `outFin` was hard-coded `"White"` for
  CL; fixed by deriving the finish from resolved cut data (`cutFinish`).
- **Date showing `46624`** — Excel serial leaked into a text cell; fixed to `DD-MM-YYYY` string.
- **SUNROOOF LOGO qty** — briefly clamped to 1, then reversed to 2 per unit.
- **Grid borders invisible** — border colour was grey `999999`; darkened to black `000000`.
- **Stale Turbopack cache** — phantom parse errors after edits; `rm -rf .next` clears them.

## Prioritized backlog

### P0 — Blockers / needs user input
- [ ] **B1** decide 8-series: supply master data **or** hide 8A/8B/8C.
- [ ] **B2** supply the 4 window prices (SFW/SLW/ARW/DAW).

### P1 — Correctness / consistency
- [ ] **B3** if desired, align Teak/Wooden Classical BOMs + cut file with the White `COC` split, then
      regenerate + redeploy.
- [ ] Add a **data-integrity linter** (every BOM part has a consumption column and, for Classical, a
      cut entry; flag cross-colour/cross-file mismatches) and run it before `next build`.

### P2 — Engineering hygiene
- [ ] Put the project under **git** + a remote; connect Vercel Git integration or an Action for CI/CD.
- [ ] Add **export snapshot tests** + a few **unit tests** (see `docs/12`).
- [ ] Parameterize the `build-*.js` source paths via env instead of hardcoded `~/Downloads` paths.

### P3 — UX / nice-to-have
- [ ] Persist projects to `localStorage`; remember recent MRP numbers/party names.
- [ ] Mobile-friendly layout.
- [ ] In-app preview of an export before download.

## Status snapshot
- **Completed:** MRP/HARDWARE/LIGHT-PAPER separation; colour-specific touch-up + cut finishes; remote
  option; window designs; hanging-profile in cut-list **and** packing; per-part cut-list format + black
  borders + merged labels; hardware set-expansion; packing single-packs + jali routing + hardware
  2-pack split + pack-based box counting; real dates; regeneration from `Inventory SUNROOOF (5).xlsx`;
  live on Vercel.
- **In progress:** none actively (awaiting user on P0).
- **Blocked:** B1, B2 (need user data); B3 (needs re-issued masters/cut file if alignment is wanted).

