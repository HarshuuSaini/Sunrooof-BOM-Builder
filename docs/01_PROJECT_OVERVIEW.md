# 01 · Complete Project Overview

## Project name
**Sunrooof BOM Builder** (Vercel project id `sunrooof-bomb-builder`).

## Vision
Give Magppie's planning/production team a single, fast, error-free tool that turns a **product
configuration** into **factory-ready paperwork** — the Bill of Materials, raw-material consumption
(MRP), and packing lists — with formatting so faithful to the factory's reference documents that no
manual Excel editing is needed. Product knowledge stays in the Excel masters the engineers already
maintain; the app is the reliable, repeatable "print factory docs" button on top of it.

## Objective
- Configure a Sunrooof unit (design, layout row A/B/C, size/console count, colour, quantity, remote).
- Show the exact dispatch **Bill of Materials** for that unit on screen.
- Build a **project** (multiple lines) and export:
  1. **Project BOM workbook** — MRP (raw-material consumption) + HARDWARE + LIGHT PAPER (console/
     electronics) + per-part **cut-list** detail sheets.
  2. **Rafter Packing List** — how frame/rafter parts + hardware are packed into boxes.
  3. **Console Packing List** — how the console/electronics (+ jali when non-raw) are packed.
- Keep everything client-side, zero-ops, instantly deployable.

## Scope

**In scope**
- Product configurator UI for 10 designs / 127 models.
- On-screen BOM preview + print/PDF.
- Three Excel exports with factory-grade styling.
- Offline Excel→JSON data compilation pipeline (4 build scripts).
- Vercel deployment.

**Out of scope (intentionally)**
- No user accounts / authentication / authorization.
- No database or server API.
- No order persistence (projects live in browser memory only, per session).
- No pricing engine beyond the numbers supplied in the masters.
- No inventory/stock tracking, no procurement, no ERP integration (a separate Magppie portal handles
  Zoho Inventory; this app is standalone).

## Features
- **Configurator:** design → layout (A/B/C) → size (console count) → colour → quantity → *Include
  Remote* toggle → **Remote colour** selector (only when remote included).
- **Live BOM preview** grouped into sections/groups/items, with size (mm), qty, UoM; warning banner
  when a model has no detail BOM (Classical 8-series).
- **KPI strip:** consoles, L×W, height, price, suggested MRP.
- **Print / PDF** via a print-optimized stylesheet.
- **Project builder:** add/remove lines, party name, MRP no, order-detail metadata, running total.
- **Export BOM (.xlsx):** MRP consumption + HARDWARE + LIGHT PAPER + cut-list sheets, department-
  banded (PRODUCTION / METAL SHOP / ASSEMBLY / PAINT SHOP / PACKAGING), styled.
- **Rafter Packing List (.xlsx)** and **Console Packing List (.xlsx)** with per-pack box counts.
- **Colour-specific** touch-up paint and cut finishes; **remote** adds D1 remote + batteries.

## Modules (logical)
| Module | File(s) | Responsibility |
|---|---|---|
| Catalog / model lookup | `src/lib/catalog.ts`, `src/data/catalog.json` | designs, models, prices, colours; assemble BOM tree; remote/colour options |
| Design BOM trees | `src/data/designs.json` (← `build-designs.js`) | parts per design+size |
| MRP consumption | `src/data/mrpbom.json` (← `build-mrpbom.js`) | raw-material per part |
| Cut-lists | `src/data/partscuts.json` (← `build-partscuts.js`) | per-part cut breakdowns |
| Types | `src/lib/types.ts` | shared data model |
| UI screen | `src/components/SunrooofBomBuilder.tsx`, `src/app/*` | the single page |
| Export engine | `src/lib/export.ts` | 3 Excel exporters + styling |
| Design system | `src/app/globals.css` | dark theme + print theme |

## User roles
There is **no authentication and no role system in the software**. Operationally, the intended users
are internal Magppie staff:
- **Planner / Production coordinator** — the primary user: configures units, builds the project, and
  exports BOM + packing lists for the factory.
- **Maintainer / Developer** — updates the Excel masters, runs the `build-*.js` scripts, and deploys.

(If auth is ever added, model these two as `operator` and `maintainer`; see `docs/11`.)

## Current implementation status (as of this handover)
- **Live and working** at https://sunrooof-bomb-builder.vercel.app.
- Latest data source: **`Inventory SUNROOOF (5).xlsx`** (cut-list still from `parts bom (2).xlsx`).
- Catalog: **10 designs, 127 models** (CL 24, MI 48, GR 48, + 7 single-config window designs).
- All three exports implemented with the agreed styling and packing rules.
- **Most recent deployment id:** `dpl_EykfRRiBzbdmPfXLobrjiR9Y47YU`
  (previous / rollback target: `dpl_3UbjSr9ZAEZ26VDvGQ8TZG9utiBC`).
- **Open gaps:** Classical 8-series has no BOM; 4 window prices are ₹0; master Teak/Wooden vs White
  Classical profile-split inconsistency intentionally left as-is (see `AI_MEMORY.md` §7).

## Future roadmap
1. Resolve Classical **8-series** BOM (add master data or hide 8A/8B/8C).
2. Provide the **4 missing window prices** (SFW/SLW/ARW/DAW).
3. Optionally realign **Teak/Wooden** Classical BOMs + cut-list file to the White `COC→CO27+CO13`
   split and `CBMC 4000→1350`.
4. Engineering hygiene: put the repo under **git + CI**, add **export snapshot tests**, and a small
   **"master health" linter** that flags cross-colour/cross-file inconsistencies pre-deploy.
5. Possible UX: persist projects (localStorage), and a saved "recent MRP numbers" list.

