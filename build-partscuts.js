// Extracts per-part cut breakdowns (Side / Box Moulding / Border / Shutter / ...)
// from the customer reference "parts bom.xlsx" into src/data/partscuts.json.
// This is the source for the "Parts BOM" (cut-list) export tab.
//
// Two sheets carry cut data, in two slightly different layouts:
//   • CLASSICAL — part header is an "H | W | D | Qty." label row with the code
//     in col 3 (COA, CR08, CJ12); component rows are marked MRP = "MRP-1".
//   • fernch window — part header is a col-3 "ELE Code" marker with the code
//     (BORDER / INNER PARTS / SHUTTER) on the NEXT row; component rows are
//     marked MRP = "N/A". The French Window frame is one dispatched unit that
//     production cuts into these three sub-parts (see `composites` below).
// (MINIMALIST / GREEN have no cut blocks.)
// Run: node build-partscuts.js
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const FILE = "/Users/Apple/Downloads/parts bom (2).xlsx";
// Three column layouts:
//  • COLOUR_ELE_SHEETS — colour-specific "ELE Code"/"H W D Qty." header blocks
//    (Classical splits by colour: only the finish differs, White vs NEW TEAK).
//    Parts are namespaced "<DESIGN>|<COLOUR>::<part>"; the export resolves by
//    the model's colour. Its PROFILE / BOTTOM MOULDING blocks are aggregates
//    whose components are the individual codes (CHPA.., CBMA..) — split so each
//    maps to its own BOM item.
//  • FLAT_SHEETS — one continuous table, part code in col 1, no Process column
//    (MINIMALIST, GREEN):  1 PART | 2 MRP | 3 Description | 4 H | 5 W | 6 D |
//    7 Qty | 8 Thick | 9 Raw | 10 Inside | 11 Outside.
const COLOUR_ELE_SHEETS = { "CLASSICAL WHITE": "CL|WH", "CLASSICAL TEAK": "CL|TK" };
const AGGREGATE_PARTS = ["PROFILE", "BOTTOM MOULDING"]; // split into per-component parts
const FLAT_SHEETS = ["MINIMALIST", "GREEN"];
// Window designs — each a single frame whose cut breakdown is on its own sheet
// (ELE-Code layout). Their part names collide across sheets ("LOUVERED WINDOW"
// appears on three), so window cut parts are namespaced "<DESIGN>::<part>" and
// the export expands the frame via composites keyed by DESIGN CODE, not name.
const WINDOW_CUT_SHEETS = [
  { sheet: "fernch window",             design: "FW" },
  { sheet: "Louvered window 2 console", design: "LW2" },
  { sheet: "Louvered window 4 console", design: "LW4" },
  { sheet: "Sun French window",         design: "SFW" },
  { sheet: "SUN Louvered window",       design: "SLW" },
  { sheet: "Arch window",               design: "ARW" },
  { sheet: "Double Arch window",        design: "DAW" },
];
const s = (v) => String(v ?? "").trim();
const n = (v) => {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return isNaN(x) ? 0 : x;
};

// Column map (input block), shared by both layouts:
// 1 MRP | 2 ELE Code | 3 Component | 4 Process | 5 H | 6 W | 7 D | 8 Qty | 9 Thick
// 10 Raw | 11 Process(finish) | 12 Inside | 13 Outside | 14 Grain | 15 FrontEB | 16 EB Detail
const isLabelHeader = (r) =>
  s(r[5]) === "H" && s(r[6]) === "W" && s(r[7]) === "D" && /^Qty/i.test(s(r[8]));

function parseSheet(rows, cuts, codesInOrder) {
  let cur = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    // French-window layout: a col-3 "ELE Code" marker; the code is on the next row.
    if (s(r[3]) === "ELE Code") {
      const codeRow = rows[i + 1] || [];
      cur = s(codeRow[3]);
      if (cur && !cuts[cur]) { cuts[cur] = { H: 0, W: 0, D: 0, comps: [] }; codesInOrder.push(cur); }
      i++; // skip the code row
      continue;
    }
    // Classical layout: the H/W/D/Qty label row itself carries the code in col 3.
    if (isLabelHeader(r) && s(r[3]) && s(r[3]) !== "Description" && s(r[3]) !== "ELE Code") {
      cur = s(r[3]);
      if (!cuts[cur]) { cuts[cur] = { H: 0, W: 0, D: 0, comps: [] }; codesInOrder.push(cur); }
      continue;
    }

    // Component row (MRP-1 for Classical, N/A for French Window).
    const mrp = s(r[1]);
    if (cur && (mrp === "MRP-1" || mrp === "N/A") && s(r[3]) && s(r[3]) !== "Description") {
      const comp = {
        comp: s(r[3]),
        proc: s(r[4]),
        H: n(r[5]),
        W: n(r[6]),
        D: n(r[7]),
        qty: n(r[8]),
        thickness: n(r[9]),
        raw: s(r[10]) || "HDHMR",
        process: s(r[11]) || "LQD",
        inside: s(r[12]) || "Base",
        outside: s(r[13]) || "White",
        grain: s(r[14]) || "0",
        frontEB: s(r[15]) || "NA",
        ebDetail: s(r[16]) || "NA",
      };
      cuts[cur].comps.push(comp);
      // Overall part dims from the main panel (first "Side*"/"Front" row):
      // height, thickness-as-width, depth — matching the existing data shape.
      if (/^(side|front)/i.test(comp.comp) && cuts[cur].H === 0 && cuts[cur].D === 0) {
        cuts[cur].H = comp.H;
        cuts[cur].W = comp.thickness;
        cuts[cur].D = comp.D;
      }
    }
  }
}

// Flat-table layout (MINIMALIST / GREEN): a single table whose part code lives
// in col 1 and repeats on every component row; no per-part header block and no
// Process column. Group consecutive rows by their part code.
function parseFlatSheet(rows, cuts, codesInOrder) {
  let h = -1;
  for (let i = 0; i < rows.length; i++) {
    if (s(rows[i][1]) === "PART" && s(rows[i][3]) === "Description" && s(rows[i][4]) === "H") { h = i; break; }
  }
  if (h < 0) return;
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i];
    const code = s(r[1]);
    const comp = s(r[3]);
    if (!code || !comp || code === "PART") continue;
    if (!cuts[code]) { cuts[code] = { H: 0, W: 0, D: 0, comps: [] }; codesInOrder.push(code); }
    const c = {
      comp,
      proc: "",
      H: n(r[4]), W: n(r[5]), D: n(r[6]), qty: n(r[7]), thickness: n(r[8]),
      raw: s(r[9]) || "HDHMR",
      process: "LQD",
      inside: s(r[10]) || "Base",
      outside: s(r[11]) || "White",
      grain: "0", frontEB: "NA", ebDetail: "NA",
    };
    cuts[code].comps.push(c);
    if (/^(side|rafter|joist|front)/i.test(comp) && cuts[code].H === 0 && cuts[code].D === 0) {
      cuts[code].H = c.H;
      cuts[code].W = c.thickness;
      cuts[code].D = c.D;
    }
  }
}

const wb = XLSX.readFile(FILE);
const cuts = {};
const codesInOrder = [];

// Colour-specific Classical sheets: parse into scratch, split the aggregate
// PROFILE / BOTTOM MOULDING parts into one part per component (keyed by that
// component's code, e.g. CHPA / CBMA), then namespace everything by colour.
for (const sheet of Object.keys(COLOUR_ELE_SHEETS)) {
  if (!wb.Sheets[sheet]) { console.warn(`!! missing sheet: ${sheet}`); continue; }
  const prefix = COLOUR_ELE_SHEETS[sheet];
  const scratch = {};
  const order = [];
  parseSheet(XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "" }), scratch, order);
  order.forEach((part) => {
    const entry = scratch[part];
    if (!entry || !entry.comps.length) return;
    if (AGGREGATE_PARTS.includes(part.toUpperCase())) {
      // Each component is a whole item (e.g. CHPA) → its own single-piece part.
      entry.comps.forEach((c) => {
        const key = `${prefix}::${c.comp.toUpperCase()}`;
        cuts[key] = { H: c.H, W: c.thickness, D: c.D, comps: [c] };
      });
    } else {
      cuts[`${prefix}::${part.toUpperCase()}`] = entry;
    }
  });
}
for (const sheet of FLAT_SHEETS) {
  if (!wb.Sheets[sheet]) { console.warn(`!! missing sheet: ${sheet}`); continue; }
  parseFlatSheet(XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "" }), cuts, codesInOrder);
}

// Window designs: parse into a scratch object, then re-key each part as
// "<DESIGN>::<part>" so same-named parts on different sheets don't collide.
// compositesByDesign[DESIGN] lists that design's parts (in sheet order) — the
// export expands a window's single frame item into all of them.
const compositesByDesign = {};
for (const { sheet, design } of WINDOW_CUT_SHEETS) {
  if (!wb.Sheets[sheet]) { console.warn(`!! missing window sheet: ${sheet}`); continue; }
  const scratch = {};
  const order = [];
  parseSheet(XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "" }), scratch, order);
  const parts = order.filter((k) => scratch[k] && scratch[k].comps.length);
  if (!parts.length) continue;
  compositesByDesign[design] = parts.map((p) => {
    const key = `${design}::${p}`;
    cuts[key] = scratch[p];
    return key;
  });
}

// Drop empty non-window parts.
Object.keys(cuts).forEach((k) => { if (!cuts[k].comps.length) { delete cuts[k]; } });

const out = { generatedFrom: path.basename(FILE), cutsByPart: cuts, compositesByDesign };
const outDir = path.join(__dirname, "src", "data");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "partscuts.json"), JSON.stringify(out));

const codes = Object.keys(cuts);
console.log(`Parts with cut breakdown: ${codes.length}`);
console.log(`Non-window codes: ${codes.filter((c) => !c.includes("::")).join(", ")}`);
console.log(`Window composites: ${JSON.stringify(compositesByDesign)}`);
console.log(`partscuts.json written`);
