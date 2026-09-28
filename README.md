# Sunroof BOM Builder

Sunroof BOM Builder is a Next.js configurator and Excel-export application for SUNROOOF artificial-sunlight products and window designs. It converts approved master workbooks into a static product catalog, displays the dispatch BOM, and creates production-ready BOM, MRP, hardware, cutting-list, rafter-packing, and console-packing workbooks.

## Current capabilities

- Configure design, layout, console count, colour, quantity, remote inclusion, and remote colour.
- Decode model codes in the UI, for example `CL2C-WH` as Classical, `2 × 3`, six consoles, White.
- Preview the complete frame, hanging-profile, hardware, console, and electronics BOM.
- Build multi-line projects with customer/MRP metadata.
- Export colour-aware MRP, hardware, light-paper, and cutting-list sheets.
- Export rafter and console dispatch packing lists.
- Apply business rules for jali placement, hanging profiles, bottom moulding, remote controls, touch-up boxes, set-to-piece expansion, and packing groups.
- Preserve styled Excel output with bold headings, dark borders, centred content, merged metadata cells, and real dates.

## Technology

- Next.js 16.2.6 and React 19.2.6
- TypeScript 5.9.3
- SheetJS plus `xlsx-js-style`
- Static JSON generated from controlled Excel master workbooks
- Vercel hosting

There is no database, API backend, authentication layer, or required runtime environment variable in the current application.

## Installation and local development

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3020/builder](http://127.0.0.1:3020/builder).

## Validation

```bash
npx tsc --noEmit
npm run build
```

## Updating master data

The committed files under `src/data/` are the runtime data. The source Excel files are intentionally not committed.

1. Place the approved inventory and cutting-list workbooks in a secure local folder.
2. Update the input path constants in the appropriate builder script.
3. Run the relevant generator:

```bash
node build-designs.js
node build-mrpbom.js
node build-partscuts.js
```

4. Review the generated JSON diff.
5. Run TypeScript validation and the production build.

## Deployment

The application is deployed on Vercel. Set a Vercel token in your shell or pass it securely to the included helper; never commit the token.

```bash
./deploy-to-magppie.sh "$VERCEL_TOKEN"
```

See [deployment documentation](docs/10_INTEGRATIONS_DEPLOYMENT.md) and [.env.example](.env.example).

## Documentation

- [AI memory](AI_MEMORY.md)
- [Documentation index](docs/00_INDEX.md)
- [Project overview](docs/01_PROJECT_OVERVIEW.md)
- [Conversation and requirements history](docs/02_CHAT_SUMMARY.md)
- [Architecture](docs/03_ARCHITECTURE.md)
- [Business rules](docs/08_BUSINESS_RULES.md)
- [Testing](docs/12_TESTING.md)
- [Known bugs and backlog](docs/13_BUGS_AND_BACKLOG.md)
- [Latest changes](docs/15_LATEST_CHANGES.md)

## Security

- No credentials are committed.
- `.env*.local`, Vercel linkage, source workbooks, build output, dependencies, backups, and local AI configuration are ignored.
- `.env.example` contains placeholders only.
- Product JSON is committed because the browser application requires it at runtime.

## Known limitations

- Classical 8-series models have specifications/pricing but no detailed BOM in the available source master.
- Some window models still have zero/placeholder prices pending authoritative master data.
- Automated unit and export-snapshot tests have not yet been added; use the documented manual checklist.

The current implementation and committed generated JSON are the source of truth. Historical documentation explains decisions, but code wins if a historical note conflicts with the latest implementation.
