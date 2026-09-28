// Builds src/data/mrpbom.json — the raw-material consumption model behind the
// MRP sheet of the "Export BOM" workbook.
//
// Two kinds of source sheet in the inventory master, both matrices whose COLUMNS
// are part codes and whose ROWS are materials consumed per one of that part:
//
//  1. "<Design> BOM (<COLOUR>)"  e.g. "Classical BOM(WHITE)", "Minimalist BOM (REGAL)"
//     Columns 7+  = part codes (COA, CBMA, CC MOULDING, CHPA ...)
//     Row 1       = the part-code header
//     Rows 8+     = materials: 0 name | 1 type | 2 department | 6 UOM | 7+ qty/part
//     Covers raw board, glue, nails, paints and packing — and is colour specific
//     (paints differ per colour), which is why the sheet is chosen by colour.
//
//  2. "<Design> HP BOM"  e.g. "Classical HP BOM"
//     Columns 3+  = hanging-profile codes (CHPA, CHP4 ...)
//     Rows 2+     = materials: 0 name | 1 wastage% | 2 UOM | 3+ qty/part
//     Covers the aluminium profile (METAL SHOP) and the rod/nut/washer/clamp/
//     screw hardware (ASSEMBLY). Rows without a UOM are group headers.
//
// Run: node build-mrpbom.js
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const FILE = "/Users/Apple/Downloads/Inventory SUNROOOF (5).xlsx";

// design|colourCode -> colour BOM sheet
const COLOUR_SHEETS = {
  "CL|WH": "Classical BOM(WHITE)",
  "CL|TK": "Classical BOM(TEAK)",
  "MI|BZ": "Minimalist BOM (REGAL)",
  "MI|TG": "Minimalist BOM (GREY)",
  "GR|WH": "Green BOM (WHITE)",
  "GR|TK": "Green BOM (TEAK)",
  "FW|WH": "French Window BOM(WHITE)",
  "LW2|WH": "Louvered Window BOM(WHITE) 2 co",
  "LW4|WH": "Louvered Window BOM(WHITE) 4 co",
  "SFW|WH": "Sun French Window BOM(WHITE)",
  "SLW|WH": "Sun Louvered Window BOM(WHITE)",
  "ARW|WH": "Arch Window BOM(WHITE)",
  "DAW|WH": "Double Arch Window BOM(WHITE)",
};
// design -> hanging-profile BOM sheet. Each design has its own; sheets that are
// not in the workbook yet are simply skipped (and reported below).
const HP_SHEETS = {
  CL: "Classical HP BOM",
  MI: "Minimalist HP BOM",
  GR: "Green HP BOM",
  FW: "French Window HP BOM",
};

const s = (v) => String(v ?? "").trim();
const n = (v) => {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return isNaN(x) ? 0 : x;
};

/** Read a matrix sheet's part-code header into { CODE: columnIndex }. */
function headerCols(row, from) {
  const cols = {};
  for (let c = from; c < row.length; c++) {
    const code = s(row[c]);
    if (code) cols[code.toUpperCase()] = c;
  }
  return cols;
}

/** Per-part quantities for one material row, dropping zeroes. */
function perPartOf(row, cols) {
  const perPart = {};
  Object.keys(cols).forEach((code) => {
    const q = n(row[cols[code]]);
    if (q) perPart[code] = q;
  });
  return perPart;
}

function parseColourSheet(rows) {
  const cols = headerCols(rows[1] || [], 7);
  const materials = [];
  for (let i = 8; i < rows.length; i++) {
    const r = rows[i] || [];
    const name = s(r[0]);
    const type = s(r[1]);
    if (!name || (type !== "Rm of Bom" && type !== "Inventory Item")) continue;
    const perPart = perPartOf(r, cols);
    if (!Object.keys(perPart).length) continue;
    materials.push({ name, dept: s(r[2]), uom: s(r[6]), perPart });
  }
  return { parts: Object.keys(cols), materials };
}

function parseHpSheet(rows) {
  const cols = headerCols(rows[1] || [], 3);
  const materials = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] || [];
    const name = s(r[0]);
    const uom = s(r[2]);
    // Rows without a UOM are group headers ("Threaded Rod Set BOM", "Threaded
    // Rod Hardware") or specs ("SCREW POINT"). The "Threaded Rod Set" row is an
    // aggregate whose components are itemised right below it — skip it so the
    // rods aren't counted twice.
    if (!name || !uom) continue;
    if (/^threaded rod set$/i.test(name)) continue;
    const perPart = perPartOf(r, cols);
    if (!Object.keys(perPart).length) continue;
    materials.push({ name, uom, perPart });
  }
  return { parts: Object.keys(cols), materials };
}

const wb = XLSX.readFile(FILE);
const byDesignColour = {};
const hpByDesign = {};
const missing = [];

Object.keys(COLOUR_SHEETS).forEach((key) => {
  const sheet = COLOUR_SHEETS[key];
  if (!wb.Sheets[sheet]) { missing.push(sheet); return; }
  const { parts, materials } = parseColourSheet(XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "" }));
  byDesignColour[key] = materials;
  console.log(`${key.padEnd(6)} <- ${sheet.padEnd(26)} ${String(materials.length).padStart(2)} materials, ${parts.length} parts`);
});

Object.keys(HP_SHEETS).forEach((design) => {
  const sheet = HP_SHEETS[design];
  if (!wb.Sheets[sheet]) { missing.push(sheet); return; }
  const { parts, materials } = parseHpSheet(XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "" }));
  hpByDesign[design] = materials;
  console.log(`${design.padEnd(6)} <- ${sheet.padEnd(26)} ${String(materials.length).padStart(2)} materials, ${parts.length} profiles`);
});

const out = { generatedFrom: path.basename(FILE), byDesignColour, hpByDesign };
const outDir = path.join(__dirname, "src", "data");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "mrpbom.json"), JSON.stringify(out));

if (missing.length) console.log(`\n!! sheets not in workbook (skipped): ${missing.join(", ")}`);
console.log(`\nmrpbom.json written (${(fs.statSync(path.join(outDir, "mrpbom.json")).size / 1024).toFixed(0)} KB)`);
