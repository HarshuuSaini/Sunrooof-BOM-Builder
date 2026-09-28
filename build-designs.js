// Converts the per-design HDHMR parametric matrices in the Sunrooof inventory
// workbook into src/data/designs.json — a BOM tree per (design, size variant).
// Designs: Minimalist (MI), Green (GR), Classical (CL). Delete/Modern sheets skipped.
// Run: node build-designs.js
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const FILE = "/Users/Apple/Downloads/Inventory SUNROOOF (5).xlsx";

// sheet name -> design code. Only these are parsed (Delete/Modern sheets ignored).
// NOTE: exact sheet names incl. quirks ("Master - Minimalist " has a trailing space).
// French Window is currently an exact copy of Classical (placeholder) -> not added yet.
const DESIGN_SHEETS = [
  { sheet: "Master - Minimalist ", design: "MI" },
  { sheet: "Master - Green", design: "GR" },
  { sheet: "Master- Classical", design: "CL" },
];

const s = (v) => String(v ?? "").trim();
const num = (v) => {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
};
const rnd = (n) => Math.round(n * 1000) / 1000;
const clean = (n) => n.replace(/\s+/g, " ").trim();

const COL = { name: 0, group: 1, size: 2, h: 3, w: 4, uom: 7, first: 8 };
const N = 24;
const DEPTH = { A: 1, B: 2, C: 3 };

const isLabel = (name) =>
  /->\s*$/.test(name) || /^room size/i.test(name) || /^consoles \(/i.test(name) ||
  /^required room/i.test(name) || name === "Extra" || name === "Minimalist" ||
  name === "Classical" || name === "Green";
const isHardwarePack = (n) => /^hardware pack$/i.test(n);
const isConsolePack = (n) => /^console pack$/i.test(n);
// Set-packaged screws are counted in sets, not pieces (the qty already counts
// sets, e.g. "( SET OF 10 PCS)" qty 2 = 2 sets). The master lists them as PCS;
// normalise the UOM to SET like the nuts/washers/fasteners already are.
const fixUom = (name, uom) => (/SCREW/i.test(name) && /SET OF/i.test(name)) ? "SET" : uom;
// The Minimalist light box lists the console glass as a bare "GLASS"; give it
// its full inventory name.
const renameItem = (name) => (/^glass$/i.test(name) ? "5MM CLEAR FLUTED GLASS 369X1169" : name);
const dimOf = (r) => [s(r[COL.size]), s(r[COL.h]), s(r[COL.w])].filter((x) => /^\d/.test(x)).join("x");

// Find the row whose variant columns hold codes like A1, A2, B3, C8 ...
function findCodeRow(rows) {
  for (let i = 0; i < Math.min(12, rows.length); i++) {
    if (/^[A-C]\d$/.test(s(rows[i][COL.first]))) return i;
  }
  return 3;
}

function parseDesign(sheetName, wb) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
  const codeRow = findCodeRow(rows);

  // variant columns that actually carry a code
  const variantCols = [];
  for (let k = 0; k < N; k++) {
    const code = s(rows[codeRow][COL.first + k]);
    if (/^[A-C]\d$/.test(code)) variantCols.push({ k, code });
  }

  const dimRow = (label) => rows.find((r) => s(r[COL.size]).toLowerCase() === label);
  const widthRow = dimRow("width");
  const lengthRow = dimRow("length");

  const variants = variantCols.map(({ k, code }) => {
    const layout = code[0];
    const widthConsoles = parseInt(code.slice(1), 10);
    const depthConsoles = DEPTH[layout] || 1;
    return {
      code,
      sizeCode: `${widthConsoles}${layout}`,
      layout,
      widthConsoles,
      depthConsoles,
      consoles: widthConsoles * depthConsoles,
      sizeLabel: `${widthConsoles}x${depthConsoles}`,
      unitWidth: widthRow ? num(widthRow[COL.first + k]) : 0,
      unitLength: lengthRow ? num(lengthRow[COL.first + k]) : 0,
    };
  });

  function buildTree(vCol) {
    const col = COL.first + vCol;
    const frame = { section: "FRAME (HDHMR)", groups: [
      { name: "Frame Panels", qty: 0, uom: "", size: "", items: [] },
      { name: "Bottom Moulding", qty: 0, uom: "", size: "", items: [] },
      { name: "Parts", qty: 0, uom: "", size: "", items: [] },
    ] };
    const hang = { section: "HANGING PROFILE", groups: [{ name: "Hanging Profiles", qty: 0, uom: "", size: "", items: [] }] };
    const dynSections = new Map();
    const getSection = (name) => {
      if (!dynSections.has(name)) dynSections.set(name, { section: name, groups: [] });
      return dynSections.get(name);
    };
    let curSectionName = "HARDWARE & PACKING";
    let curGroup = null;

    for (let i = codeRow + 1; i < rows.length; i++) {
      const r = rows[i];
      const name = renameItem(clean(s(r[COL.name])));
      const group = s(r[COL.group]);
      const uom = s(r[COL.uom]);
      let qty = rnd(num(r[col]));
      const sizeText = s(r[COL.size]);

      // A SUNROOOF LOGO sticker is 2 per finished unit, regardless of frame size.
      if (/^SUNROOOF LOGO$/i.test(name)) qty = 2;

      if (!name) { curGroup = null; continue; }
      if (isLabel(name)) continue;

      if (group === "BOM") { if (qty > 0) frame.groups[0].items.push({ name, qty, uom, size: dimOf(r) }); continue; }
      if (group === "Bottom Moulding") { if (qty > 0) frame.groups[1].items.push({ name, qty, uom, size: dimOf(r) }); continue; }
      if (group === "PART") { if (qty > 0) frame.groups[2].items.push({ name, qty, uom, size: /^\d/.test(sizeText) ? dimOf(r) : "" }); continue; }
      if (group === "Hanging Profile") { if (qty > 0) hang.groups[0].items.push({ name, qty, uom, size: /^\d/.test(sizeText) ? `${sizeText}mm` : "" }); continue; }

      if (!group && isHardwarePack(name)) { curSectionName = "HARDWARE & PACKING"; curGroup = null; continue; }
      if (!group && isConsolePack(name)) { curSectionName = "CONSOLE & ELECTRONICS"; curGroup = null; continue; }

      if (!group) {
        // A blank-group row that carries a concrete unit while a kit is already
        // open is a MIS-LABELLED ITEM (some designs, e.g. Classical, leave the
        // "Inventory Item" tag off the screw rows) — nest it, don't start a group.
        if (uom && curGroup) {
          if (qty > 0) curGroup.items.push({ name, qty, uom: fixUom(name, uom), size: "", order: sizeText });
          continue;
        }
        // otherwise it's a kit / sub-section header -> open a new group
        curGroup = { name, qty: qty > 0 ? qty : 0, uom, size: "", items: [] };
        getSection(curSectionName).groups.push(curGroup);
        continue;
      }
      if (group === "Inventory Item") {
        if (qty > 0) {
          if (!curGroup) { curGroup = { name: "Items", qty: 0, uom: "", size: "", items: [] }; getSection(curSectionName).groups.push(curGroup); }
          // col 2 (sizeText here) carries the department for hardware/console items.
          curGroup.items.push({ name, qty, uom: fixUom(name, uom), size: "", order: sizeText });
        }
        continue;
      }
    }

    frame.groups = frame.groups.filter((g) => g.items.length);
    const tree = [];
    if (frame.groups.length) tree.push(frame);
    if (hang.groups[0].items.length) tree.push(hang);
    for (const sec of dynSections.values()) {
      sec.groups = sec.groups.filter((g) => g.items.length > 0 || g.qty > 0);
      if (sec.groups.length) tree.push(sec);
    }
    return tree;
  }

  const bomBySizeCode = {};
  variantCols.forEach(({ k }, idx) => { bomBySizeCode[variants[idx].sizeCode] = buildTree(k); });
  return { variants, bomBySizeCode };
}

// ---------------------------------------------------------------------------
// Window designs (French Window, Louvered, Arch, Sun*, Double Arch) — each a
// single, non-parametric configuration on its own sheet. Unlike the matrix
// designs they have one column of quantities (col 8), the frame is a single
// unit (its cut breakdown lives in parts bom), and they use the same Hardware
// Pack / Console Pack kit structure as the others.
// Columns: 0 name | 1 group | 2 process | 3 H | 4 W | 5 weight | 7 uom | 8 qty
// The frame row is the first row carrying both a UOM and numeric dimensions,
// which appears before the first "Hardware Pack" (the config/label rows above
// it have no UOM or non-numeric dims).
// ---------------------------------------------------------------------------
function parseWindowSheet(sheetName, wb) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
  const FC = { name: 0, group: 1, proc: 2, h: 3, w: 4, uom: 7, qty: 8 };

  const frame = { section: "FRAME (HDHMR)", groups: [{ name: "Frame Panels", qty: 0, uom: "", size: "", items: [] }] };
  const hw = { section: "HARDWARE & PACKING", groups: [] };
  const cons = { section: "CONSOLE & ELECTRONICS", groups: [] };
  let curSection = null;
  let curGroup = null;
  let started = false;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = renameItem(clean(s(r[FC.name])));
    const group = s(r[FC.group]);
    const uom = s(r[FC.uom]);
    let qty = rnd(num(r[FC.qty]));
    if (/^SUNROOOF LOGO$/i.test(name)) qty = 2;

    if (!name) { curGroup = null; continue; }

    // The finished frame row (before any kit) → single Frame Panel item.
    if (!started && uom && /^\d/.test(s(r[FC.h]))) {
      const size = [s(r[FC.h]), s(r[FC.w])].filter((x) => /^\d/.test(x)).join("x");
      frame.groups[0].items.push({ name, qty: qty || 1, uom: uom || "PCS", size });
      started = true;
      continue;
    }
    if (!started) continue;

    if (!group && isHardwarePack(name)) { curSection = hw; curGroup = null; continue; }
    if (!group && isConsolePack(name)) { curSection = cons; curGroup = null; continue; }
    if (!curSection) continue;

    if (!group) {
      // kit / sub-section header (Utility Box, Light Box, ELECTRIC BOX, Touch-up Box)
      curGroup = { name, qty: qty > 0 ? qty : 0, uom, size: "", items: [] };
      curSection.groups.push(curGroup);
      continue;
    }
    if (group === "Inventory Item" && qty > 0) {
      if (!curGroup) { curGroup = { name: "Items", qty: 0, uom: "", size: "", items: [] }; curSection.groups.push(curGroup); }
      curGroup.items.push({ name, qty, uom: fixUom(name, uom), size: "", order: s(r[FC.proc]) });
    }
  }

  frame.groups = frame.groups.filter((g) => g.items.length);
  const tree = [];
  if (frame.groups.length) tree.push(frame);
  if (hw.groups.length) tree.push(hw);
  if (cons.groups.length) tree.push(cons);
  return tree;
}

const wb = XLSX.readFile(FILE);
const bomByDesignSize = {};
const variantsByDesign = {};
const summary = [];
for (const { sheet, design } of DESIGN_SHEETS) {
  if (!wb.Sheets[sheet]) { console.warn(`!! missing sheet: ${sheet}`); continue; }
  const { variants, bomBySizeCode } = parseDesign(sheet, wb);
  bomByDesignSize[design] = bomBySizeCode;
  variantsByDesign[design] = variants;
  summary.push(`${design}: ${variants.length} sizes [${variants.map((v) => v.sizeCode).join(",")}]`);
}

// Window designs — each a single fixed size on its own "Master- ..." sheet.
const WINDOW_SHEETS = [
  { sheet: "Master- French Window",           design: "FW",  size: "2B", consoles: 4 },
  { sheet: "Master- Louvered Window 2 conso",  design: "LW2", size: "2A", consoles: 2 },
  { sheet: "Master- Louvered Window 4 conso",  design: "LW4", size: "2B", consoles: 4 },
  { sheet: "Master- Sun French Window",        design: "SFW", size: "2A", consoles: 2 },
  { sheet: "Master- Sun Louvered Window",      design: "SLW", size: "2A", consoles: 2 },
  { sheet: "Master- Arch Window",              design: "ARW", size: "2B", consoles: 4 },
  { sheet: "Master-Double Arch Window",        design: "DAW", size: "4B", consoles: 8 },
];
for (const { sheet, design, size, consoles } of WINDOW_SHEETS) {
  if (!wb.Sheets[sheet]) { console.warn(`!! missing window sheet: ${sheet}`); continue; }
  const tree = parseWindowSheet(sheet, wb);
  bomByDesignSize[design] = { [size]: tree };
  variantsByDesign[design] = [{
    code: size, sizeCode: size, layout: size.slice(-1), widthConsoles: parseInt(size, 10) || 2,
    depthConsoles: 1, consoles, sizeLabel: size, unitWidth: 1020, unitLength: 2630,
  }];
  const items = tree.reduce((a, sec) => a + sec.groups.reduce((b, g) => b + g.items.length, 0), 0);
  summary.push(`${design}: 1 size [${size}] (${items} items)`);
}

// ---------------------------------------------------------------------------
// Touch-Up boxes are colour-specific (the paint/stainer differs per colour).
// The "Touch-Up" sheet lists one box per colour: "Touch-up Box (<Colour>)".
// Keyed by upper-cased colour name so the app can swap a model's touch-up box
// for the one matching its selected colour.
// ---------------------------------------------------------------------------
function parseTouchUp(wb) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets["Touch-Up"], { header: 1, defval: "" });
  const byColour = {};
  let cur = null;
  for (const r of rows) {
    const name = clean(s(r[0]));
    const m = name.match(/^touch-up box\s*\((.+)\)/i);
    if (m) { cur = m[1].trim().toUpperCase(); byColour[cur] = []; continue; }
    if (cur && s(r[1]) === "Inventory Item") {
      const qty = rnd(num(r[6]));
      if (qty > 0) byColour[cur].push({ name, qty, uom: s(r[7]), size: "", order: s(r[2]) });
    }
  }
  return byColour;
}
const touchByColour = wb.Sheets["Touch-Up"] ? parseTouchUp(wb) : {};
console.log(`Touch-up boxes: ${Object.keys(touchByColour).join(", ")}`);

const out = {
  generatedFrom: [path.basename(FILE)],
  bomByDesignSize,
  variantsByDesign,
  touchByColour,
};

const outDir = path.join(__dirname, "src", "data");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "designs.json"), JSON.stringify(out));

summary.forEach((l) => console.log(l));
console.log(`designs.json written (${(fs.statSync(path.join(outDir, "designs.json")).size / 1024).toFixed(0)} KB)`);
