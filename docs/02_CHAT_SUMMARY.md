# 02 · Complete Chat / Project History Summary

A faithful, chronological summary of the requirements, decisions, business rules, rejected ideas,
bugs, and improvements accumulated across the project's development conversations. Nothing important
omitted. Grouped by theme, roughly in the order it arose.

> Note: this project predates this package across several working sessions. The summary reconstructs
> the decisions embedded in the code and the maintainer's notes. Where a decision was reversed, both
> the original and the reversal are recorded.

---

## A. Foundation & data model
- Built as a **Next.js 16 + React 19 + TypeScript** client-only app; single screen at `/builder`
  (root `/` redirects to it).
- Decided the **Excel masters are the source of truth**; the app compiles them offline into
  `src/data/*.json` via `build-*.js` and never reads Excel at runtime.
- Data split into four artifacts: `catalog.json` (models/prices/colours), `designs.json` (BOM trees),
  `mrpbom.json` (raw-material consumption matrices), `partscuts.json` (cut-lists).
- **Rejected:** adding a database or `/api` backend — unnecessary for an internal, batch-updated tool
  (kept static for zero ops and easy rollback).

## B. Designs & catalog growth
- Core designs: **Classical (CL), Minimalist (MI), Green (GR)** parsed from `Master- *` matrix sheets.
- Added **window designs** as single-config products (one size, White, 2630×1020×150) via
  `parseWindowSheet()`: French Window (`FW`, ₹2.2L), Louvered 2/4-console (`LW2` ₹1.04L / `LW4`
  ₹2.08L), and four with **₹0 placeholder prices** — Sun French (`SFW`), Sun Louvered (`SLW`), Arch
  (`ARW`), Double Arch (`DAW`) — flagged to the user as awaiting real prices.
- **Flagged (open):** Classical **8-series** (8A/8B/8C) is offered in the dropdown but the master
  matrix only defines 2/4/6, so those models have **no BOM**; the UI shows a warning banner. Offered
  to hide them or await data — awaiting user.

## C. The "Export BOM" workbook redesign (master `Inventory SUNROOOF (3).xlsx`)
Requirement (verbatim intent): *"MRP would contain only items in BOM Sheets of every design based on
the consumptions, and there would be a new sheet which contains the other hardware items in the
Master Sheet of each design; hardware items would not contain the items in the Light-paper sheet."*
Implemented as:
- **MRP sheet** = colour-BOM **consumption only** (Σ material-per-part × part qty). Aluminium was
  moved into the colour BOM, so the separate **HP-BOM** sheets became unused.
- New **HARDWARE sheet** = discrete Master hardware-pack items, **excluding** Light-Paper/console
  items, with department taken from the master's column-2 "order" field.
- **LIGHT PAPER sheet** = console/electronics items.
- Departments normalized to 5 banners — **PRODUCTION / METAL SHOP / ASSEMBLY / PAINT SHOP /
  PACKAGING** — matching reference doc **MRP-1173**; banner rows filled orange `FFCC99`.

## D. Remote / Electric box
- **Rule:** the **electric box is always present**. **Including the remote** adds a **`D1` magnetic
  remote** (colour Black/White/Gold, chosen via a selector **shown only when Include Remote is
  checked**) plus **2× batteries** (`DURACELL`).
- Implemented in `filterTree()` (catalog.ts) + a `remoteColor` state and conditional selector in the
  UI; `REMOTE_COLORS = [BLACK, WHITE, GOLD]`.

## E. Colour-specific behavior
- **Touch-up box** paint/stainer differs per colour → swapped by `colorName` via `touchByColour`
  (White / Teak / Regal Bronze / Titanium Grey).
- **Cut-list finish** must reflect the selected model colour for non-Classical designs (Classical was
  already colour-split into `CL|WH::` / `CL|TK::`, which differ only in finish).

## F. A batch of formatting/logic requests (user listed, confirmed before implementing)
1. **Minimalist Light Box** item named `GLASS` → rename to `5MM CLEAR FLUTED GLASS 369X1169`.
2. **Add a Date option**; and the date must show the **actual date**, not the Excel serial `46624`
   (fixed to `DD-MM-YYYY`).
3. **SUNROOOF LOGO qty = 2** for a single unit. *(History: earlier it was clamped to 1 after the user
   said "there's only one but it's showing 2"; the user then reversed this back to 2/unit. Current
   rule: 2.)*
4. **Bold all headings** and **border all data cells** in every export sheet.
5. **Centre-align** all export BOM sheets.

## G. Cut-list format overhaul (with a screenshot from the user)
The user attached an image and asked to match the reference parts-bom sheet exactly:
- Restructure into **per-part blocks**: `CODE H W D Qty.` header row → column header → component rows
  → blank row.
- **Darker borders** — switch grid border colour from grey `999999` to **black `000000`** (an earlier
  attempt "still no change / only slight change" led to fully black).
- **Upper template block finish must match the selected colour.** Bug: for Classical **Teak** the
  upper rows showed **White** because `outFin` was hard-coded `"White"` for CL. Fixed by deriving the
  finish from the resolved cut data (`cutFinish`).
- **Inside finish = outside finish.**
- **Merge** the customer-name and MRP-number value cells (so the user doesn't re-merge in Excel).
- **Clean labels:** `Customer Name` (value = party name only — **drop the customer code**) and
  `MRP No` (**drop the factory-code bracket**).
- Column widths copied from the source sheet.

## H. Hardware set-expansion (confirmed with "do it")
- Expand `SET OF N PCS` (and the threaded-rod form `(N PCS … SET)`) in a hardware item name into the
  **actual piece count** (`qty × N`), strip the `( SET OF … )` text from the name, set **UOM → PCS**,
  and **merge** identical items per design.

## I. Hanging profile — cut-list (Classical)
- User: *"in Classical design there is no hanging profile … it is already there in the sheet."*
- **Bug/root cause:** the cut-list only iterated the `FRAME` section, but the hanging profile lives in
  a separate `HANGING PROFILE` section. **Fix:** iterate both
  (`/FRAME/i.test(sec.section) || /HANGING/i.test(sec.section)`). A brace mismatch during the edit
  briefly caused a parse error at line ~404, corrected.

## J. Packing-list rework (most recent functional batch)
User reported and requested:
- **Hanging profile missing from the packing list** (all designs) and from the on-screen view.
  **Root cause:** `getPackingRowsForLine` searched inside the FRAME section; the hanging profile is in
  the `HANGING PROFILE` section. **Fix:** use the dedicated section.
- **Classical jali** missing from the view, the packing list, and other sheets — added; also added to
  the **MRP** (`CLASSICAL JALI` resolves to the `JALI` colour-BOM column).
- **Jali placement rule:** *"if the colour is raw then it will go with the frame, else it will be
  added with the console pack."* Implemented via `isRawFinish()`.
- **Bottom Moulding has 2 items → pack them in a single pack**; **same for the hanging profile**
  (one pack).
- **Hardware split into 2 packs:** a **separate pack** for
  `MS THREAD ROD 10 MM LEN 1 MTR (2 PCS THREADED ROS SET)`, `PVC FLOOR PROTECTION SHEET 6X4`,
  `PLASTIC ROLL FOR PACKING 36 INCH WIDTH`; **all other hardware in one pack**.
- Box counting updated to count **packs**, not rows.
- User confirmations captured mid-stream: *"3. RIGHT"* (agreeing to a proposed behavior) and *"do
  it" / "continue from where it stopped"*.

## K. New master `Inventory SUNROOOF (5).xlsx` (latest change in this package's session)
- Diff vs `(3)`: **only Classical changed.** `COC (210×3950)` **split** into `CO27 (210×2650)` +
  `CO13 (210×1300)`; `CBMC` bottom moulding **4000mm → 1350mm**; 3 chipboard screws UOM `PCS → Set`.
- **Inconsistency found & surfaced to user:** the split landed in **`Classical BOM(WHITE)` only**;
  **Teak/Wooden colour BOMs still use `COC`**, and the cut-list file `parts bom (2).xlsx` (not
  re-issued) still defines `COC`/`CBMC-4000`.
- **User decision (explicit):** **"White only, as-is"** — regenerate exactly from the master; do not
  auto-propagate the split to Teak/Wooden or the cut-list. Consequence documented in `AI_MEMORY.md`.
- Regenerated `designs.json` + `mrpbom.json`, verified White has CO27/CO13 & Teak has COC, built,
  deployed. **New id `dpl_EykfRRiBzbdmPfXLobrjiR9Y47YU`**, rollback `dpl_3UbjSr9ZAEZ26VDvGQ8TZG9utiBC`.

## L. Recurring operational lessons (kept as guidance)
- **Stale Turbopack cache** repeatedly showed phantom parse errors after edits → `rm -rf .next` +
  restart; `npm run build` is authoritative.
- **Browser downloads are suppressed under automation** on this machine → verify exports with
  **deterministic Node simulations** of the export code path rather than opening downloaded files.
- **Back up `src/data/*.json`** to `_backup/<timestamp>/` before each master regeneration.
- Every deploy: record the **new** id and the **previous** id (rollback).

## Rejected / deferred ideas (and why)
| Idea | Status | Why |
|---|---|---|
| Database / server API | Rejected | Internal, batch-updated tool; static JSON is simpler, cheaper, and instantly rollback-able. |
| Parse Excel in the browser at runtime | Rejected | Ships large xlsx, slow/fragile; offline compile yields compact reviewable JSON. |
| Clamp SUNROOOF LOGO to 1 | Reverted | User confirmed 2 per unit. |
| Auto-propagate COC split to Teak/Wooden + cut-list | Deferred | User chose "White only, as-is"; masters/cut-file not re-issued for other colours. |
| Hide Classical 8-series now | Deferred | Awaiting user's call vs. supplying the missing master data. |

