# 09 · Workflows (step by step)

## W1 — Operator: build a project and export factory docs
1. Open `/builder` (root redirects here).
2. **Configure** a unit: Design → Layout (A/B/C) → Size (console count) → Colour → Quantity.
3. Toggle **Include Remote** (default on); if on, pick **Remote Colour** (Black/White/Gold).
4. Review the **KPI strip** and the **live BOM** in Card ②. Optionally **Print / PDF**.
5. Click **+ Add to Project**. Repeat 2–5 for more line items.
6. In Card ③ set **Party Name** and **MRP No**. Optionally expand **Order Details** and fill the
   cut-list header metadata (customer code, sales person, dates, vehicle, etc.).
7. Export:
   - **⬇ Export BOM (.xlsx)** → workbook with MRP + HARDWARE + LIGHT PAPER + cut-list sheets.
   - **📦 Rafter Packing List** → frame/rafter packs + hardware (2 packs).
   - **📦 Console Packing List** → console/electronics packs (+ jali when non-raw).
8. Downloaded workbooks are factory-ready (styled, bordered, dated) — hand to the factory.

## W2 — Maintainer: update product data from a new Excel master
(See `docs/05` for detail.)
1. Receive new master (e.g. `Inventory SUNROOOF (N).xlsx`) and/or new cut file
   (`parts bom (N).xlsx`).
2. **Diff** vs the current master as *sorted sets of rows* per sheet to isolate real changes (ignore
   reordering).
3. If anything looks internally inconsistent (a change in one colour sheet but not others, cut file
   not re-issued), **surface it to the user and get a decision** before regenerating.
4. Back up: `mkdir -p _backup/$(date +%Y%m%d-%H%M%S) && cp src/data/*.json _backup/<ts>/`.
5. Update the `const FILE = "…"` path(s) in the relevant `build-*.js`.
6. Run `node build-designs.js`, `node build-mrpbom.js` (and `build-partscuts.js` / `build-data.js` if
   those sources changed).
7. **Verify** the JSON diff with Node snippets (`docs/05`): correct part columns per colour, expected
   groups, etc.
8. `npx tsc --noEmit` → `rm -rf .next && npm run build`.
9. **Deploy** (`docs/10`) and record the **new** + **previous** deployment ids.
10. Report the change set, verification, and rollback id to the user.

## W3 — Maintainer: change export logic / formatting / packing rules
1. Edit `src/lib/export.ts` (styling in `styleGrid`/`GRID_BORDER`; packing in
   `getPackingRowsForLine`/`getHardwareRowsForLine`; MRP/HARDWARE/cut-list in the exporter bodies).
2. `npx tsc --noEmit`.
3. Verify via a **Node simulation** of the export code path (downloads are suppressed under
   automation) or by running the dev server and exercising the export in a normal browser.
4. `rm -rf .next && npm run build`, then deploy.

## W4 — Deploy & rollback
1. `vercel deploy --prod --yes --scope magppiesilverstonepvtltd --token=<TOKEN>`.
2. Confirm the alias returns HTTP 200: `curl -I https://sunrooof-bomb-builder.vercel.app/builder`.
3. Record the new deployment id; keep the previous id as the rollback target.
4. **Rollback:** promote the previous deployment in the Vercel dashboard (all deploys retained).

## W5 — Local development
1. `cd source && npm install`.
2. `npm run dev` → http://127.0.0.1:3020/builder (Turbopack).
3. If the dev console shows parse errors that don't match the code → `rm -rf .next` and restart;
   trust `npm run build`.

