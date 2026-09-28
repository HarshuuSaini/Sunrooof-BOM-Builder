# 11 · Environment Configuration & Authentication

## Environment variables
**The runtime app reads no environment variables.** There is no `process.env` usage in the app code;
nothing is required to `dev`/`build`/`start`. See the root [`.env.example`](../.env.example) for the
full annotated list. Summary:

| Variable | Required for | Secret | Description |
|---|---|---|---|
| `VERCEL_TOKEN` | deploy | **Yes** | Vercel access token with deploy rights to the Magppie team. Generate at vercel.com/account/tokens. Pass via `--token`. |
| `VERCEL_SCOPE` | deploy | No | Team slug `magppiesilverstonepvtltd`. |
| `VERCEL_PROJECT_ID` | deploy (ref) | No | `prj_pMMCW9kHnmMwWYCua3pQkktsz2ew`. |
| `VERCEL_ORG_ID` | deploy (ref) | No | `team_3kNUUimkx3oLM7Mfudka1f6S`. |
| `VERCEL_PROJECT_NAME` | deploy (ref) | No | `sunrooof-bomb-builder`. |
| `MASTER_INVENTORY_XLSX` | data regen (local) | No | Path to the Inventory master; currently hardcoded in `build-designs.js`/`build-mrpbom.js`. |
| `PARTS_BOM_XLSX` | data regen (local) | No | Path to the cut-list workbook; hardcoded in `build-partscuts.js`. |
| `CATALOG_MAIN_XLSX` / `CATALOG_DETAIL_XLSX` | data regen (local) | No | Legacy catalog sources; hardcoded in `build-data.js`. |

> The build scripts currently use **hardcoded absolute paths** (macOS `~/Downloads/...`). If you run
> the pipeline on another machine, either edit those constants or refactor the scripts to read the env
> vars above. This is the single most common "it doesn't work elsewhere" gotcha.

## Configuration guide
1. **Run/build locally:** nothing to configure — `npm install && npm run dev`.
2. **Deploy:** export `VERCEL_TOKEN` (or pass `--token`) and use the deploy command in `docs/10`.
3. **Regenerate data:** point the `build-*.js` `FILE` constants at your workbook paths, run them,
   rebuild.

**Never commit real secrets.** Only `VERCEL_TOKEN` is sensitive; store it in your shell/CI secret
store, not in the repo.

## Authentication & Authorization
**None. The application has no authentication, authorization, sessions, JWTs, middleware, or role
enforcement.** It is an internal, unauthenticated static tool. Consequences:
- Anyone with the URL can use it. If that becomes a concern, options: Vercel password protection /
  SSO (deployment protection) at the platform layer, or add real auth (see below).
- There is no token refresh flow, no protected routes, no `middleware.ts`.

### If authentication is added later (design guidance)
- Model two roles: **operator** (configure + export) and **maintainer** (also manage data/deploy).
- Prefer platform-level protection first (Vercel Access / SSO) since there is no backend to host a
  session store.
- If app-level auth is needed, you'd be introducing the project's first backend — document its
  secrets here and its flow (login → session/JWT → middleware-guarded routes → refresh). Keep the
  existing client-only export path intact.
- Update `docs/11`, `.env.example`, and `AI_MEMORY.md` §7/§9 accordingly.

