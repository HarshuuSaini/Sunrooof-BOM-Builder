# Documentation Index

Read in this order. `AI_MEMORY.md` (repo root) is the fastest way in.

| # | File | Covers the handover requirement(s) |
|---|------|------------------------------------|
| 01 | [Project Overview](01_PROJECT_OVERVIEW.md) | §1 Overview: vision, objective, scope, features, modules, roles, status, roadmap |
| 02 | [Complete Chat Summary](02_CHAT_SUMMARY.md) | §2 Every requirement, decision, business rule, rejected idea, bug, improvement |
| 03 | [Architecture & Folder Structure](03_ARCHITECTURE.md) | §3 Source map, §4 Folder structure, architecture |
| 04 | [Data Model ("Database")](04_DATA_MODEL.md) | §5 Schemas, relationships, constraints, sample data, ER diagram |
| 05 | [Data Pipeline (Excel→JSON)](05_DATA_PIPELINE.md) | §5+§9 the build-*.js compilers, source workbooks, workflows |
| 06 | [Export Engine & Business Logic](06_EXPORT_ENGINE.md) | §8 Business logic, §6 "API" (function surface) of export.ts |
| 07 | [UI / UX](07_UI_UX.md) | §7 Screens, components, design system, colours, typography, flows |
| 08 | [Business Rules](08_BUSINESS_RULES.md) | §8 Every product/business rule, edge cases |
| 09 | [Workflows](09_WORKFLOWS.md) | §9 Every workflow, step by step |
| 10 | [Integrations & Deployment](10_INTEGRATIONS_DEPLOYMENT.md) | §10 Integrations, §14 Deployment, hosting, CI/CD, rollback |
| 11 | [Environment Configuration](11_ENV_CONFIG.md) | §11 env vars, §12 auth (n/a) |
| 12 | [Testing](12_TESTING.md) | §15 Test cases, checklist, verification method |
| 13 | [Bugs & Prioritized Backlog](13_BUGS_AND_BACKLOG.md) | §16 Bugs, §17 Pending tasks/backlog |
| 14 | [Function & Module Reference (the "API")](14_API_AND_FUNCTIONS.md) | §6 API docs, §19 per-function/module docs |

## Requirement → location cross-reference

- **§1 Project Overview** → 01
- **§2 Chat Summary** → 02
- **§3 Source Code** → `source/` (verbatim) + 06/14 for walkthroughs
- **§4 Folder Structure** → 03
- **§5 Database** → 04 (data model) + 05 (how it's produced). *No SQL/NoSQL DB exists; the "database" is compiled JSON.*
- **§6 API** → 14. *No HTTP API exists; the public surface is the exported TS functions.*
- **§7 UI/UX** → 07
- **§8 Business Logic** → 06 + 08
- **§9 Workflows** → 09
- **§10 Integrations** → 10
- **§11 Environment** → 11 + root `.env.example`
- **§12 Authentication** → 11 (§"Authentication" = none; documented why)
- **§13 Dependencies** → `source/package.json` + `source/package-lock.json` (03 lists them)
- **§14 Deployment** → 10
- **§15 Testing** → 12
- **§16 Bugs** → 13
- **§17 Pending Tasks** → 13
- **§18 AI Memory** → root `AI_MEMORY.md`
- **§19 Documentation** → 14 (+ inline code comments in `source/`)
- **§20 README** → root `README.md`

## FAQs

**Q: Where is the database?**
There isn't one. Product data is compiled from Excel into `source/src/data/*.json` and imported
directly. See 04 + 05.

**Q: Where is the backend / API?**
There is none. The app is 100% client-side; Excel is generated in the browser. The "API" documented in
14 is the TypeScript module/function surface.

**Q: How do I change what appears in a BOM or export?**
If it's product data (parts, qty, consumption, cut sizes) → change the Excel master and re-run the
relevant `build-*.js`. If it's *formatting/logic* (packing rules, sheet styling) → edit
`source/src/lib/export.ts`. See 05 and 06.

**Q: Why do I see parse errors in the dev console that don't match the code?**
Stale Turbopack cache. `rm -rf .next && npm run dev`. Trust `npm run build`.

**Q: How do I roll back a bad deploy?**
Promote the previous deployment in the Vercel dashboard (every deploy is retained). Deploy ids are
recorded in the chat summary (02) and should be recorded on every future deploy.

