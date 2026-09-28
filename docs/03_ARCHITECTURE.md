# 03 · Architecture & Folder Structure

## High-level architecture

```
┌─────────────────────── OFFLINE (Node, run by maintainer) ───────────────────────┐
│                                                                                  │
│  Excel masters in ~/Downloads:                                                   │
│    Inventory SUNROOOF (5).xlsx      parts bom (2).xlsx                            │
│    SUNROOOF BOM MAIN.xlsx           SUNROOOF BOM DETAIL.xlsx  (legacy catalog)    │
│                    │                                                             │
│      ┌─────────────┼───────────────┬────────────────────┐                        │
│      ▼             ▼               ▼                    ▼                         │
│ build-designs   build-mrpbom   build-partscuts     build-data                    │
│      │             │               │                    │                        │
│      ▼             ▼               ▼                    ▼                         │
│ designs.json   mrpbom.json    partscuts.json       catalog.json   (src/data/)    │
└──────────────────────────────────────────────────────────────────────────────────┘
                                   │  (imported at build time)
┌──────────────────────────── RUNTIME (browser only) ──────────────────────────────┐
│  src/lib/types.ts  ── shared TS types                                             │
│  src/lib/catalog.ts ── reads the 4 JSON files; model lookup; assembles BOM tree;  │
│                        applies remote + colour options (filterTree)               │
│           │                                                                       │
│  src/app/{layout,page}.tsx + src/app/builder/page.tsx  ── Next App Router shell   │
│           ▼                                                                       │
│  src/components/SunrooofBomBuilder.tsx  ── the single interactive screen          │
│           │  (user clicks Export)                                                 │
│           ▼                                                                       │
│  src/lib/export.ts ── builds .xlsx in-browser with xlsx-js-style, triggers download│
└──────────────────────────────────────────────────────────────────────────────────┘
                                   │  next build → static assets → Vercel CDN
                                   ▼
                         https://sunrooof-bomb-builder.vercel.app
```

**Key properties**
- **No server code.** The only Next.js server usage is the `/` → `/builder` redirect and static
  rendering; there are no route handlers / server actions / API routes.
- **No network at runtime.** All data is bundled; Excel is generated client-side.
- **Data is a build-time import**, so changing JSON requires a rebuild/redeploy.

## Tech stack & dependencies

Runtime (`source/package.json`):
| Package | Version | Role |
|---|---|---|
| `next` | 16.2.6 | App Router framework, static export, Turbopack dev |
| `react` / `react-dom` | 19.2.6 | UI |
| `xlsx` | 0.18.5 | **Reading** masters in `build-*.js` (and types); community SheetJS |
| `xlsx-js-style` | ^1.2.0 | **Writing styled** .xlsx in `export.ts` (styled SheetJS fork) |

Dev:
| Package | Version |
|---|---|
| `typescript` | 5.9.3 |
| `@types/node` | 24.10.1 |
| `@types/react` | 19.2.7 |
| `@types/react-dom` | 19.2.3 |

Scripts (`package.json`): `dev` (`next dev -H 127.0.0.1 -p 3020`), `build` (`next build`),
`start` (`next start -H 127.0.0.1 -p 3020`), `lint` (`next lint`).

TS path alias (`tsconfig.json`): `@/*` → `src/*`.

## Complete folder structure (source, verbatim)

```
source/
├── .claude/
│   └── launch.json                # local dev-server launch config (port 3020)
├── .gitignore
├── README.md                      # original project README (kept)
├── build-data.js                  # → src/data/catalog.json  (legacy MAIN+DETAIL workbooks)
├── build-designs.js               # → src/data/designs.json  (BOM tree per design+size)
├── build-mrpbom.js                # → src/data/mrpbom.json   (raw-material consumption matrices)
├── build-partscuts.js             # → src/data/partscuts.json(cut-lists)
├── deploy-to-magppie.sh           # one-shot Vercel deploy helper
├── next-env.d.ts
├── next.config.ts                 # (empty config)
├── package.json
├── package-lock.json
├── tsconfig.json
└── src/
    ├── app/
    │   ├── globals.css            # dark theme + print theme (the design system)
    │   ├── layout.tsx             # root layout + <title>
    │   ├── page.tsx               # redirect("/builder")
    │   └── builder/
    │       └── page.tsx           # renders <SunrooofBomBuilder/>
    ├── components/
    │   └── SunrooofBomBuilder.tsx # the ONLY screen (configurator + preview + project + exports)
    ├── lib/
    │   ├── catalog.ts             # model lookup + BOM assembly + filterTree(remote/colour)
    │   ├── export.ts              # 3 Excel exporters + styling helpers  (largest file)
    │   └── types.ts               # shared data model
    └── data/
        ├── catalog.json           # 10 designs, 127 models, prices, colours
        ├── designs.json           # bomByDesignSize + touchByColour
        ├── mrpbom.json            # byDesignColour + hpByDesign consumption
        └── partscuts.json         # per-part cut breakdowns (Classical colour-scoped, window design-scoped)
```

Excluded from the package (regenerable or environment-specific): `node_modules/`, `.next/`,
`_backup/`, `.vercel/` + `.vercel.bak.*` (contain project/org ids; reproduced in `.env.example`),
`tsconfig.tsbuildinfo`.

## Module responsibilities (one line each)
- **types.ts** — `Model`, `BomItem/Group/Section`, `BomTree`, `Catalog`, `ProjectLine`, `OrderMeta`,
  `FlatRow`.
- **catalog.ts** — `DESIGNS`, `sizeClassesFor/sizesFor/colorsFor/findModel/bomFor`, `filterTree`,
  `flattenBom`, `aggregateItems`, `REMOTE_COLORS`.
- **export.ts** — `exportProjectBom`, `exportRafterPackingList`, `exportConsolePackingList` + private
  helpers (dept sheets, packing rows, hardware split, cut-part resolution, grid styling).
- **SunrooofBomBuilder.tsx** — all UI state + wiring to catalog/export.
- **build-\*.js** — offline compilers (see `docs/05`).

