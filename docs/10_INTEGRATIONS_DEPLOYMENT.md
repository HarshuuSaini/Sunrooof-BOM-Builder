# 10 · Integrations & Deployment

## Integrations
**There are no runtime third-party integrations** — no external APIs, webhooks, OAuth flows, callback
URLs, analytics, error tracking, or payment providers. The app makes **no network calls at runtime**.
The only external systems involved are **build/deploy tooling**:

| Integration | Type | Purpose | Secret? |
|---|---|---|---|
| **Vercel** | Hosting + CLI | Build + host the static site; deployments & rollback | Deploy token (secret) |
| **npm registry** | Package install | `npm install` dependencies | No |
| **Excel masters** | Local files | Source data for `build-*.js` (offline) | No (local files) |

> Related but **separate** systems (not part of this app): Magppie's `Purchase_Store_QC` portal and
> Zoho Inventory integrations live in other projects. This BOM Builder is standalone.

### Vercel — setup
- **Project:** `sunrooof-bomb-builder`
- **Org / team:** `team_3kNUUimkx3oLM7Mfudka1f6S` (scope slug `magppiesilverstonepvtltd`)
- **Project id:** `prj_pMMCW9kHnmMwWYCua3pQkktsz2ew`
- **Production domain:** `sunrooof-bomb-builder.vercel.app`
- Identifiers live in `source/.vercel/project.json` on the maintainer's machine (excluded from this
  package; reproduced in `.env.example`). A prior link under a different personal account
  (`khalsasharan-…`) was moved aside; `deploy-to-magppie.sh` documents that unlink step.

### Required permissions
A Vercel access token with **deploy** rights to the Magppie Silverstone team. Generate at
`https://vercel.com/account/tokens`. Keep it out of git; pass via `--token` or `VERCEL_TOKEN` env.

## Deployment

### Command
```bash
vercel deploy --prod --yes --scope magppiesilverstonepvtltd --token=<VERCEL_TOKEN>
```
or the helper:
```bash
./deploy-to-magppie.sh <VERCEL_TOKEN>   # unlinks a stale .vercel, then deploys --prod
```

### Verify live
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://sunrooof-bomb-builder.vercel.app/builder   # expect 200
```

### Build
- `next build` (Turbopack). Output is a static/prerendered site (the builder page is a client
  component; there are no server routes). Vercel builds from the pushed source using the same command.
- **Node:** any current LTS (18+); Next 16 / React 19 require a modern Node. `@types/node` is 24.x.

### Rollback
Every Vercel deployment is retained. To roll back, open the project in the Vercel dashboard and
**Promote** a previous deployment to production. Always record the current + previous deployment ids
at deploy time so the rollback target is known.

**Deployment id log (most recent first):**
- `dpl_EykfRRiBzbdmPfXLobrjiR9Y47YU` — regenerated from `Inventory SUNROOOF (5).xlsx` (Classical
  COC→CO27/CO13 split, White only).
- `dpl_3UbjSr9ZAEZ26VDvGQ8TZG9utiBC` — redeploy of packing-list state.
- `dpl_5NEw1ESk7o4SSj6EKVMvzNGa1vMM` — packing-list rework.
- `dpl_EZ5YdbsTnnbiWPgcsnZ7pqcbg17C` — prior.

### CI/CD
No GitHub Actions / CI pipeline is configured; deploys are **manual** via the Vercel CLI. The working
directory is **not a git repo**. *Future:* put under git + connect Vercel Git integration or add an
Action that runs `build-*.js` + `next build` and deploys on push.

### Reverse proxy / SSL / domains / monitoring / logging / backup
- **SSL + domain + CDN:** handled entirely by Vercel (automatic HTTPS on `*.vercel.app`).
- **Reverse proxy:** none needed (Vercel edge).
- **Monitoring/logging:** none configured (no runtime server to log). Vercel build logs are available
  in the dashboard.
- **Backup strategy:** the code is in this package + the maintainer's machine; product-data JSON is
  backed up to `_backup/<timestamp>/` before each regeneration. There is no database to back up.
  *Recommendation:* push to a git remote for durable history.

