# 07 · UI / UX

Single screen, single component: `src/components/SunrooofBomBuilder.tsx` (client component),
rendered by `src/app/builder/page.tsx`. Root `/` redirects to `/builder`. Styling is one hand-written
stylesheet, `src/app/globals.css` (dark theme + a print theme). No component library, no CSS framework.

## Screen: `/builder` — three stacked cards

### Card ① Configure  (`.no-print`)
A flex row of fields:
- **Design** — `<select>` of the 10 designs.
- **Layout (A / B / C)** — `<select>` of the design's size classes ("Row A/B/C").
- **Size (consoles)** — `<select>` of sizes for the design+class, labelled `2A — 2x1 (2 consoles)`.
- **Colour** — `<select>` of colours for the design+size.
- **Quantity** — numeric input (min 1).
- **Options** — "Include Remote (D1)" checkbox (styled `.check` pill), default **on**.
- **Remote Colour** — `<select>` (Black/White/Gold) **only rendered when Include Remote is checked**.
- **+ Add to Project** button.

Cascading resets: changing Design resets class→size→colour; changing class resets size→colour;
changing size resets colour (handlers `onDesign/onSizeClass/onSize`).

### Card ② `<model.code>` — BOM preview
- **Print header** (`.print-head`, screen-hidden): `SUNROOOF — Bill of Materials` + a meta line.
- **KPI strip** (`.kpi`): Consoles · L×W (mm) · Height (mm) · Price · Suggested MRP (₹, `en-IN`).
- **🖨 Print / PDF** button (`window.print()`).
- **Bill of Materials** table: sections (`.section` heading) → group rows (`.grouprow`, bold, shaded)
  → indented item rows, columns **Item · Size (mm) · Qty · UoM**. Rendered from `shownTree`
  (`filterTree(tree, includeRemote, remoteColor, model.colorName)`).
- **Warning banner** (`.warn`) when a model has no detail BOM (Classical 8-series): shows which detail
  sheet is needed; specs/pricing above still render from the model sheet.

### Card ③ Project  (`.no-print`)
- Header shows line count; when lines exist: **Party Name** input (default "Ms.Lata Ahuja"),
  **MRP No** input (default "1181"), running **Total** (₹), and a **▸ Order Details** toggle.
- **Order Details** (collapsible): Customer Code, Sales Person, Designer, Planning Person, Dispatch
  Address, Drawing Received Date, Clearance Date, Hand Over Date, Vehicle No, Contact Number (fields
  ending in `Date` render as `<input type="date">`). Stored in `orderMeta` (`OrderMeta`), used in the
  cut-list header.
- **Export buttons:** ⬇ Export BOM (.xlsx) · 📦 Rafter Packing List · 📦 Console Packing List
  (disabled until at least one line).
- **Lines table:** # · Code · Design · Colour · Consoles · Qty · Line Price · remove.

## Design system (`globals.css`)

### Colour tokens (dark theme, `:root`)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0f1115` | page background |
| `--panel` | `#181b22` | card background |
| `--panel2` | `#1f232c` | inputs, group rows, tags |
| `--border` | `#2a2f3a` | borders/dividers |
| `--text` | `#e7eaf0` | primary text |
| `--muted` | `#9aa3b2` | secondary text, labels |
| `--accent` | `#f5a623` | primary buttons, code, brand amber |
| `--accent2` | `#4aa3ff` | section headings (blue) |
| `--danger` | `#ff5c5c` | remove/ghost buttons |

### Typography
System UI stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`), base 14px.
Monospace (`ui-monospace, SFMono-Regular, Menlo`) for model codes (`.code`, amber). Labels are
uppercase 12px with letter-spacing; section headings uppercase 11px bold blue; KPI values 20px bold.

### Components / classes
`.app` (max-width 1280, centred), `.card` (rounded 12px panel), `.row`/`.field` (flex form layout),
`select/input` (dark, rounded 8px), `button` (amber) + `.secondary` (panel) + `.ghost` (danger
outline), `.kpi`, `.section`, `tr.grouprow`, `.tag`, `.banner`, `.warn`, `.check`, `.muted`, `code`.

### Icons
Emoji only (🖨 📦 ⬇ ① ② ③ ▸ ▾ ⚠). No icon library.

### Responsiveness
Fluid: `.row`/`.field`/`.kpi` use `flex-wrap`, fields `min-width:150px`, container `max-width:1280px`
and centres. No explicit mobile breakpoints — it reflows by wrapping. (A dedicated mobile layout is a
possible future enhancement.)

### Animations
None (no transitions/keyframes) — intentionally utilitarian.

### Print theme (`@media print`)
Overrides tokens to white/black, hides `.no-print`, `h1`, and the top `p.muted`; reveals
`.print-head`; removes card chrome; shrinks tables to 10px; forces group-row shading with
`print-color-adjust: exact`; `break-inside: avoid` on cards and `div[data-bom-section]`. Produces a
clean printable/PDF BOM.

## Primary user flow
```
Open /builder
 → pick Design → Layout → Size → Colour → Qty → (toggle Remote, pick Remote colour)
 → review KPIs + live BOM (Card ②)  [optional: Print/PDF]
 → "+ Add to Project"  (repeat for more lines)
 → set Party Name + MRP No  [optional: Order Details]
 → Export BOM (.xlsx) / Rafter Packing List / Console Packing List
 → downloaded workbook is factory-ready (no manual editing expected)
```

