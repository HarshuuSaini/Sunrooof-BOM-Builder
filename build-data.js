// Converts the two Sunrooof xlsx files into src/data/catalog.json
// Run: node build-data.js
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const MAIN = "/Users/apple/Downloads/SUNROOOF BOM MAIN.xlsx";
const DETAIL = "/Users/apple/Downloads/SUNROOOF BOM DETAIL.xlsx";

const num = (v) => {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
};
const str = (v) => String(v ?? "").trim();

// ---------- MODEL sheet -> models[] ----------
const mainWb = XLSX.readFile(MAIN);
const modelRows = XLSX.utils.sheet_to_json(mainWb.Sheets["MODEL"], { header: 1, defval: "" });
const models = [];
for (let i = 1; i < modelRows.length; i++) {
  const r = modelRows[i];
  const code = str(r[5]);
  if (!code) continue;
  models.push({
    sn: num(r[0]),
    designName: str(r[1]),
    designCode: str(r[2]),
    sizeCode: str(r[3]),
    colorCode: str(r[4]),
    code,
    sizeClass: str(r[6]),
    colorName: str(r[7]),
    cpLxW: str(r[8]),
    console: num(r[9]),
    length: num(r[10]),
    width: num(r[11]),
    height: num(r[12]),
    price: num(r[13]),
    mrp: num(r[15]) || num(r[13]),
  });
}

// ---------- DETAIL sheets -> boms keyed by code ----------
const detailWb = XLSX.readFile(DETAIL);
const boms = {};

function parseBomSheet(name) {
  const rows = XLSX.utils.sheet_to_json(detailWb.Sheets[name], { header: 1, defval: "" });
  // locate header row (contains "DESCRIPTION")
  let hIdx = rows.findIndex((r) => r.some((c) => str(c).toUpperCase() === "DESCRIPTION"));
  if (hIdx < 0) hIdx = 1;
  const header = rows[hIdx].map((c) => str(c).toUpperCase());
  const descCol = Math.max(1, header.indexOf("DESCRIPTION"));
  const qtyCol = header.indexOf("QTY.") >= 0 ? header.indexOf("QTY.") : header.indexOf("QTY");
  const uomCol = qtyCol >= 0 ? qtyCol + 1 : -1;
  const lenCol = header.indexOf("LENGTH");
  const htCol = header.indexOf("HEIGHT");
  const wdCol = header.indexOf("WIDTH");

  const tree = []; // [{section, groups:[{name, qty, uom, items:[...]}]}]
  let section = null;
  let group = null;

  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const c0 = str(r[0]);
    const desc = str(r[descCol]);
    const qty = qtyCol >= 0 ? num(r[qtyCol]) : 0;
    const uom = uomCol >= 0 ? str(r[uomCol]) : "";

    if (!c0 && !desc) continue;
    if (/TOTAL PACKET/i.test(desc)) continue;

    // Section header: e.g. "FRAME DISPATCH", "CONSOLE DISPATCH"
    if (c0 && !desc && /DISPATCH/i.test(c0)) {
      section = { section: c0, groups: [] };
      tree.push(section);
      group = null;
      continue;
    }
    if (!section) {
      section = { section: "BOM", groups: [] };
      tree.push(section);
    }

    // Group header: c0 is a number, desc is the group name
    if (c0 && /^\d+$/.test(c0) && desc) {
      const dims = [lenCol, htCol, wdCol]
        .map((ci) => (ci >= 0 ? num(r[ci]) : 0));
      group = {
        name: desc,
        qty,
        uom,
        size: dims.some((d) => d) ? dims.filter(Boolean).join("x") : "",
        items: [],
      };
      section.groups.push(group);
      continue;
    }

    // Item row (indented): desc present, c0 empty
    if (desc) {
      if (!group) {
        group = { name: "ITEMS", qty: 0, uom: "", size: "", items: [] };
        section.groups.push(group);
      }
      const L = lenCol >= 0 ? num(r[lenCol]) : 0;
      const Ht = htCol >= 0 ? num(r[htCol]) : 0;
      const Wd = wdCol >= 0 ? num(r[wdCol]) : 0;
      const size = [L, Ht, Wd].some((d) => d) ? [L, Ht, Wd].filter(Boolean).join("x") : "";
      group.items.push({ name: desc, qty, uom, size });
    }
  }
  return tree;
}

const sheetNames = detailWb.SheetNames.filter((n) => /^[A-Z]{2}\d/.test(n)); // CL2A-WH etc.
sheetNames.forEach((n) => {
  boms[n.toUpperCase()] = parseBomSheet(n);
});

// ---------- attach a bomKey to every model ----------
// exact code match, else by designCode+sizeCode prefix (color-agnostic)
const bomByPrefix = {};
Object.keys(boms).forEach((k) => {
  const prefix = k.split("-")[0]; // e.g. MI3B
  if (!bomByPrefix[prefix]) bomByPrefix[prefix] = k;
});
let withBom = 0;
models.forEach((m) => {
  const exact = boms[m.code.toUpperCase()];
  const prefix = (m.designCode + m.sizeCode).toUpperCase();
  if (exact) m.bomKey = m.code.toUpperCase();
  else if (bomByPrefix[prefix]) m.bomKey = bomByPrefix[prefix];
  else m.bomKey = null;
  if (m.bomKey) withBom++;
});

// ---------- taxonomy helpers ----------
const designs = [];
const seen = new Set();
models.forEach((m) => {
  if (!seen.has(m.designCode)) {
    seen.add(m.designCode);
    designs.push({ code: m.designCode, name: m.designName });
  }
});

const out = {
  generatedFrom: ["SUNROOOF BOM MAIN.xlsx", "SUNROOOF BOM DETAIL.xlsx"],
  designs,
  models,
  boms,
};

const outDir = path.join(__dirname, "src", "data");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "catalog.json"), JSON.stringify(out));

console.log(`Models: ${models.length}  (with BOM: ${withBom})`);
console.log(`Designs: ${designs.map((d) => `${d.code}=${d.name}`).join(", ")}`);
console.log(`BOM sheets parsed: ${Object.keys(boms).length}`);
console.log(`Colors: ${[...new Set(models.map((m) => m.colorCode + "=" + m.colorName))].join(", ")}`);
const sizeClasses = [...new Set(models.map((m) => m.sizeClass))];
console.log(`Size classes: ${sizeClasses.join(", ")}`);
console.log(`catalog.json written (${(fs.statSync(path.join(outDir, "catalog.json")).size / 1024).toFixed(0)} KB)`);
