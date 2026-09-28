// @ts-ignore
import XLSX from "xlsx-js-style";
import type { ProjectLine, OrderMeta, Model } from "./types";
import { bomFor, filterTree, displayModelCode, type RemoteColor } from "./catalog";
import partsCutsJson from "@/data/partscuts.json";
import mrpBomJson from "@/data/mrpbom.json";

interface CutComp {
  comp: string; proc: string; H: number; W: number; D: number; qty: number;
  thickness: number; raw: string; process: string; inside: string;
  outside: string; grain: string; frontEB: string; ebDetail: string;
}
const partsCuts = partsCutsJson as {
  cutsByPart: Record<string, { H: number; W: number; D: number; comps: CutComp[] }>;
  compositesByDesign?: Record<string, string[]>;
};
const cutsByPart = partsCuts.cutsByPart;
// A window's single frame item is cut into several parts — e.g. French Window ->
// BORDER + INNER PARTS + SHUTTER. Keyed by DESIGN CODE (part names collide across
// window sheets, so the cut parts are namespaced "<DESIGN>::<part>").
const compositesByDesign = partsCuts.compositesByDesign || {};

/** Leading part code from an item name, e.g. "COA (210X1250)" -> "COA". */
const partCodeOf = (name: string) => name.split(/[\s(]/)[0].toUpperCase();
/** Item name without its "(dimensions)" suffix, e.g. "CC MOULDING (…)" -> "CC MOULDING". */
const baseNameOf = (name: string) => name.replace(/\s*\(.*/, "").trim().toUpperCase();
/** BOM item name -> cut-part code, where they differ. */
const CUT_ALIAS: Record<string, string> = { "CLASSICAL JALI": "JALI" };

/**
 * Resolve one BOM frame item to a single cut-part key, honouring colour-specific
 * cut data (Classical). Tries the leading code (COA), the full name (CC
 * MOULDING) and a known alias (CLASSICAL JALI -> JALI); for each, a
 * "<design>|<colour>::" entry wins over the colour-agnostic one. Returns null
 * when no direct part matches (the caller then tries a window composite).
 */
function resolveCutPart(itemName: string, model: Model): string | null {
  const base = baseNameOf(itemName);
  const candidates = [partCodeOf(itemName), base, CUT_ALIAS[base]].filter(Boolean) as string[];
  for (const c of candidates) {
    const scoped = `${model.designCode}|${model.colorCode}::${c}`;
    if (cutsByPart[scoped]) return scoped;
    if (cutsByPart[c]) return c;
  }
  return null;
}

/** Departments the MRP sheet groups by, in the order they appear on the sheet. */
const ORDER_FROM_SEQUENCE = ["PRODUCTION", "METAL SHOP", "ASSEMBLY", "PAINT SHOP", "PACKAGING"];

// The MRP sheet reports the raw materials a unit consumes, taken from the
// inventory master's per-design/per-colour BOM matrices (see build-mrpbom.js):
//   • "<Design> BOM (<COLOUR>)" — board, glue, nails, paints, packing
//   • "<Design> HP BOM"         — aluminium profile + rod/nut/washer/screw set
// Each material's quantity is (qty per part) x (that part's qty in the Master BOM).
const mrpBom = mrpBomJson as {
  byDesignColour: Record<string, { name: string; dept: string; uom: string; perPart: Record<string, number> }[]>;
  hpByDesign: Record<string, { name: string; uom: string; perPart: Record<string, number> }[]>;
};

/** Only these Master BOM groups have a matching column on the BOM matrices. */
const MRP_PART_GROUPS = /Frame Panels|Bottom Moulding|Hanging Profiles|Parts/i;

// Formatting carried over from the reference MRP workbook: sized columns, a
// white header band, and an orange banner across each department separator.
const MRP_COL_WIDTHS = [14, 17, 24, 40, 13, 86, 20, 18, 13, 8, 20, 15, 20].map((wch) => ({ wch }));
const LIGHT_COL_WIDTHS = [14, 16, 22, 37, 13, 69, 20, 18, 13, 8, 21, 13, 15].map((wch) => ({ wch }));
const HEADER_FILL = "FFFFFF";
const BANNER_FILL = "FFCC99";

/** Paint a full 13-column row with a solid fill, creating cells as needed. */
function fillSheetRow(ws: any, r: number, rgb: string): void {
  for (let c = 0; c < 13; c++) {
    const ref = XLSX.utils.encode_cell({ r, c });
    if (!ws[ref]) ws[ref] = { v: "", t: "s" };
    ws[ref].s = { ...(ws[ref].s || {}), fill: { fgColor: { rgb } } };
  }
}

/** Sheet department wording -> the five departments the sheets group by. */
const DEPT_MAP: Record<string, string> = {
  "PRODUCTION": "PRODUCTION",
  "PRODUCTION CONSUMABLE": "PRODUCTION",
  "METAL": "METAL SHOP",
  "METAL SHOP": "METAL SHOP",
  "ASSEMBLY": "ASSEMBLY",
  "INSTALLATION": "ASSEMBLY",
  "PAINT": "PAINT SHOP",
  "PAINT CONSUMABLE": "PAINT SHOP",
  "PACKING": "PACKAGING",
  "PACKAGING": "PACKAGING",
};
const normaliseDept = (d: string) => DEPT_MAP[d.trim().toUpperCase()] || d.trim().toUpperCase() || "PRODUCTION";

const MRP_HEADER = [
  "VOUCHER NO.", "DATE", "PARTY NAME", "FG ITEM NAME", "FG QUANTITY", "RM ITEM NAME",
  "GODOWN", "ORDER FROM", "QUANTITY", "UOM", "MATERIALTYPE", "MRP TYPE", "ORIGINAL MRP NO.",
];

interface DeptRow { orderFrom: string; fgCode: string; name: string; uom: string; qty: number }

/**
 * Build an MRP-format worksheet from accumulated rows, grouped by department in
 * ORDER_FROM_SEQUENCE with an orange banner naming each group (omitted before
 * the first). Shared by the MRP (material consumption) and HARDWARE sheets.
 */
function buildDeptSheet(
  acc: Map<string, DeptRow>,
  fgQtyByCode: Map<string, number>,
  mrpNo: string,
  partyName: string,
  dateStr: string
): any {
  const rows: (string | number)[][] = [MRP_HEADER.slice()];
  const collected = [...acc.values()];
  const departments = [
    ...ORDER_FROM_SEQUENCE,
    ...[...new Set(collected.map((c) => c.orderFrom))].filter((d) => !ORDER_FROM_SEQUENCE.includes(d)),
  ];
  const bannerRowIdx: number[] = [];
  let emitted = false;
  departments.forEach((dept) => {
    const deptRows = collected.filter((c) => c.orderFrom === dept);
    if (!deptRows.length) return;
    if (emitted) { bannerRowIdx.push(rows.length); rows.push(["", "", "", "", "", dept, "", "", "", "", "", "", ""]); }
    deptRows.forEach((a) => {
      rows.push([
        `MRP ${mrpNo}`, dateStr, partyName, a.fgCode, fgQtyByCode.get(a.fgCode) ?? 1,
        a.name, "0Main Location", dept, Math.round(a.qty * 1e6) / 1e6, a.uom || "PCS",
        "CARCASS", "ORIGINAL", mrpNo,
      ]);
    });
    emitted = true;
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = MRP_COL_WIDTHS;
  fillSheetRow(ws, 0, HEADER_FILL);
  bannerRowIdx.forEach((r) => fillSheetRow(ws, r, BANNER_FILL));
  styleGrid(ws, [0, ...bannerRowIdx]);
  return ws;
}

// Black thin border + centre alignment applied to every populated cell; header
// rows (by index) are also bolded. Existing fills (header/banner) are preserved.
const GRID_BORDER = {
  top: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
};
function styleGrid(ws: any, boldRows: number[] = []): void {
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const bold = new Set(boldRows);
  const styleCell = (r: number, c: number, create: boolean) => {
    const cellRef = XLSX.utils.encode_cell({ r, c });
    let cell = ws[cellRef];
    if (!cell) {
      if (!create) return;
      cell = ws[cellRef] = { v: "", t: "s" };
    }
    cell.s = {
      ...(cell.s || {}),
      alignment: { horizontal: "center", vertical: "center", wrapText: false },
      border: GRID_BORDER,
      font: { ...((cell.s && cell.s.font) || {}), bold: bold.has(r) || (cell.s && cell.s.font && cell.s.font.bold) || false },
    };
  };
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.v === "" || cell.v === undefined || cell.v === null) continue;
      styleCell(r, c, false);
    }
  }
  // Border every cell of a merged range whose anchor holds a value, so merged
  // metadata cells (customer name / MRP) are fully enclosed.
  (ws["!merges"] || []).forEach((m: any) => {
    const anchor = ws[XLSX.utils.encode_cell(m.s)];
    if (!anchor || anchor.v === "" || anchor.v === undefined || anchor.v === null) return;
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) styleCell(r, c, true);
    }
  });
}

function getExcelSerialDate(date: Date): number {
  return Math.floor((date.getTime() - new Date(1899, 11, 30).getTime()) / (24 * 60 * 60 * 1000));
}

export function exportProjectBom(
  lines: ProjectLine[],
  includeRemote = true,
  partyName = "Ms.Lata Ahuja",
  mrpNo = "1181",
  meta?: OrderMeta,
  remoteColor: RemoteColor = "BLACK"
): void {
  const wb = XLSX.utils.book_new();
  // Actual date (DD-MM-YYYY) shown in the DATE column, not the Excel serial.
  const dateStr = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

  const fgQtyByCode = new Map<string, number>();
  const addTo = (acc: Map<string, DeptRow>, orderFrom: string, fgCode: string, name: string, uom: string, qty: number) => {
    if (!qty) return;
    const key = `${fgCode}|${orderFrom}|${name}|${uom}`;
    const cur = acc.get(key) ?? { orderFrom, fgCode, name, uom, qty: 0 };
    cur.qty += qty;
    acc.set(key, cur);
  };

  // -------------------------------------------------------------
  // Sheet 1: MRP — raw-material CONSUMPTION from the design+colour BOM matrix
  // (board, aluminium, glue, paint, packing). Discrete assembly hardware is on
  // the separate HARDWARE sheet; console/electronics are on LIGHT PAPER.
  // -------------------------------------------------------------
  const mrpAcc = new Map<string, DeptRow>();
  // Sheet 3: HARDWARE — the discrete hardware items from each design's Master
  // sheet (Hardware Pack): rods, nuts, washers, screws, clamps, gloves, packing.
  const hwAcc = new Map<string, DeptRow>();

  lines.forEach((line) => {
    const model = line.model;
    const tree = bomFor(model);
    if (!tree) return;

    const colourMats = mrpBom.byDesignColour[`${model.designCode}|${model.colorCode}`] || [];
    const codeSet = new Set(colourMats.flatMap((m) => Object.keys(m.perPart)));
    // A BOM item matches its matrix column by full name ("CC MOULDING"), by its
    // leading code ("COA (210X1250)" -> COA), or — for single-config designs like
    // the French Window, whose column is the size code — by sizeCode ("2B").
    const resolve = (name: string) =>
      [name.toUpperCase(), partCodeOf(name), CUT_ALIAS[baseNameOf(name)], model.sizeCode.toUpperCase()]
        .filter(Boolean).find((c) => codeSet.has(c as string));

    const parts: { code: string; qty: number }[] = [];
    tree
      .filter((sec) => !/CONSOLE/i.test(sec.section) && !/ELECTRONICS/i.test(sec.section))
      .forEach((sec) => {
        sec.groups.forEach((g) => {
          if (!MRP_PART_GROUPS.test(g.name)) return;
          g.items.forEach((item) => {
            const c = resolve(item.name);
            if (c) parts.push({ code: c, qty: item.qty * line.qty });
          });
        });
      });

    const fgCode = displayModelCode(model);
    fgQtyByCode.set(fgCode, (fgQtyByCode.get(fgCode) ?? 0) + line.qty);

    // MRP: consumed materials = Σ (qty per part) × (part qty), from the colour BOM.
    colourMats.forEach((m) => {
      const total = parts.reduce((sum, p) => sum + (m.perPart[p.code] || 0) * p.qty, 0);
      addTo(mrpAcc, normaliseDept(m.dept), fgCode, m.name, m.uom, total);
    });

    // HARDWARE: the discrete Hardware Pack items from the Master BOM tree — the
    // HARDWARE & PACKING section (console/electronics stay on LIGHT PAPER).
    // Set-packaged items ("( SET OF 10 PCS)", "(2 PCS ... SET)") are expanded to
    // actual pieces (qty × pack size), the bracket is stripped from the name, and
    // items that then share a name (per design) merge via addTo's key.
    const hwSection = tree.find((sec) => /HARDWARE/i.test(sec.section));
    hwSection?.groups.forEach((g) => {
      g.items.forEach((item) => {
        const dept = normaliseDept((item as { order?: string }).order || "ASSEMBLY");
        let name = item.name;
        let qty = item.qty * line.qty;
        let uom = item.uom || "PCS";
        const setMatch = name.match(/\(\s*SET OF\s+(\d+)\s*PCS[^)]*\)/i) || name.match(/\(\s*(\d+)\s*PCS[^)]*SET[^)]*\)/i);
        if (setMatch) {
          qty = qty * parseInt(setMatch[1], 10);
          name = name.replace(setMatch[0], "").replace(/\s{2,}/g, " ").trim();
          uom = "PCS";
        }
        addTo(hwAcc, dept, fgCode, name, uom, qty);
      });
    });
  });

  const wsMrp = buildDeptSheet(mrpAcc, fgQtyByCode, mrpNo, partyName, dateStr);
  XLSX.utils.book_append_sheet(wb, wsMrp, "MRP");

  // -------------------------------------------------------------
  // Sheet 2: LIGHT PAPER
  // -------------------------------------------------------------
  const lightRows: (string | number)[][] = [
    [
      "VOUCHER NO.",
      "DATE",
      "PARTY NAME",
      "FG ITEM NAME",
      "FG QUANTITY",
      "RM ITEM NAME",
      "GODOWN",
      "ORDER FROM",
      "QUANTITY",
      "UOM"
    ]
  ];

  lines.forEach((line) => {
    const model = line.model;
    const base = bomFor(model);
    if (!base) return;
    // The ELECTRIC BOX always ships; the D1 remote + batteries are added when
    // the remote is included (in the chosen colour).
    const tree = filterTree(base, includeRemote, remoteColor, model.colorName);

    const consoleSection = tree.find((sec) => /CONSOLE/i.test(sec.section) || /ELECTRONICS/i.test(sec.section));
    if (!consoleSection) return;

    consoleSection.groups.forEach((g) => {
      g.items.forEach((item) => {
        lightRows.push([
          `MRP ${mrpNo}`,
          dateStr,
          partyName,
          displayModelCode(model),
          line.qty,
          item.name,
          "0Main Location",
          "ASSEMBLY",
          item.qty * line.qty,
          item.uom || "PCS"
        ]);
      });
    });
  });

  const wsLight = XLSX.utils.aoa_to_sheet(lightRows);
  wsLight["!cols"] = LIGHT_COL_WIDTHS;
  fillSheetRow(wsLight, 0, HEADER_FILL);
  styleGrid(wsLight, [0]);
  XLSX.utils.book_append_sheet(wb, wsLight, "LIGHT PAPER");

  // -------------------------------------------------------------
  // Sheet 3: HARDWARE — discrete Master-sheet hardware (built above).
  // -------------------------------------------------------------
  const wsHw = buildDeptSheet(hwAcc, fgQtyByCode, mrpNo, partyName, dateStr);
  XLSX.utils.book_append_sheet(wb, wsHw, "HARDWARE");

  // -------------------------------------------------------------
  // Detail sheets: one per project line, named after sizeCode
  // -------------------------------------------------------------
  const sheetNamesUsed = new Set<string>();

  lines.forEach((line) => {
    const model = line.model;
    const tree = bomFor(model);
    if (!tree) return;

    let baseSheetName = model.sizeCode;
    let sheetName = baseSheetName;
    let counter = 2;
    while (sheetNamesUsed.has(sheetName)) {
      sheetName = `${baseSheetName}-${counter}`;
      counter++;
    }
    sheetNamesUsed.add(sheetName);

    // The finish shown on the whole sheet = the outside finish the cut rows
    // carry. Classical has colour-specific cut sheets (White / NEW TEAK), so we
    // read it from the cut data; other designs use the model colour. Inside
    // finish is shown the same as outside.
    const cutSections = tree.filter((sec) => /FRAME/i.test(sec.section) || /HANGING/i.test(sec.section));
    const cutFinish = (() => {
      for (const sec of cutSections) for (const g of sec.groups) for (const item of g.items) {
        const pc = resolveCutPart(item.name, model);
        if (pc && cutsByPart[pc] && cutsByPart[pc].comps.length) return cutsByPart[pc].comps[0].outside;
      }
      return "";
    })();
    const outFin = (model.designCode === "CL" ? cutFinish : model.colorName) || model.colorName || "White";

    // Per-part column header (repeated before each part block, as in the source).
    const descHeader: (string | number)[] = [
      "S.No.", "MRP No", "Elevation", "Description", "Process", "H", "W", "D", "Qty.",
      "Thick ness", "Raw Material ", "Process", "Inside Finish", "Outside Finish", "Grain", "Front EB", "EB Detail",
    ];

    // Top template block (design + order metadata), matching the source sheet.
    // Inside & outside finish both follow the selected colour.
    const detailRows: (string | number)[][] = [
      [], // Row 1: empty
      [
        "Sr. No.",
        "Material Field",
        "Raw MAT",
        "Process",
        "",
        "Thick-ness mm",
        "Inside Finish",
        "Outside Finish",
        "Front EB Code",
        "EB Detail",
        "Grain",
        "Bill of Material"
      ],
      [1, "Side", "HDHMR", "LQD", "", 11, outFin, outFin, "NA", "All Side", 0, "Customer Name", partyName, "", "Drawing Received Date", meta?.drawingDate ?? ""],
      [2, "Bottom", "HDHMR", "LQD", "", 11, outFin, outFin, "NA", "All Side", 0, "MRP No", mrpNo, "", "Clearance Date", meta?.clearanceDate ?? ""],
      [3, "Center", "HDHMR", "LQD", "", 25, outFin, outFin, "NA", "All Side", 0, "Sales Person Name", meta?.salesPerson ?? "", "", "Hand Over Date", meta?.handoverDate ?? ""],
      [4, "Moulding", "Wood", "LQD", "", 12, outFin, outFin, "NA", "All Side", 0, "Designer Name", meta?.designer ?? "", "", "Qty (Nos)", line.qty],
      [5, "Moulding", "Wood", "LQD", "", 6, outFin, outFin, "NA", "All Side", 0, "Planning Person Name", meta?.planningPerson ?? ""],
      [6, "Light Suport", "HDHMR", "LQD", "", 3, outFin, outFin, "Na", "Na", 0, "Dispatch Address", meta?.dispatchAddress ?? ""],
      [7, "Side Suport", "HDHMR", "LQD", "", 25, outFin, outFin, "NA", "NA", 0, "", ""],
      [8, "ANGLE", "METAL", "MS", "", 3, "MS", "MS", "", "", "", "", ""],
      [], // empty
      [], // empty
    ];

    // Merge each metadata value cell (col 12–13) so names/MRP display cleanly.
    const detailMerges: any[] = [];
    for (let r = 2; r <= 7; r++) detailMerges.push({ s: { r, c: 12 }, e: { r, c: 13 } });

    // Explode each frame + hanging-profile part into its cut components (Side /
    // Box Moulding / Profile ...). Each part is emitted as its own block —
    // "<CODE> H W D Qty." header, the column header, its component rows, then a
    // blank separator — mirroring the uploaded cutting-list sheet.
    const detailBoldRows: number[] = [1]; // the "Sr. No. | Material Field ..." header
    const emitPartBlock = (code: string, comps: (string | number)[][]) => {
      detailBoldRows.push(detailRows.length);
      detailRows.push(["", "", "", code, "", "H", "W", "D", "Qty."]);
      detailBoldRows.push(detailRows.length);
      detailRows.push(descHeader.slice());
      comps.forEach((row) => detailRows.push(row));
      detailRows.push([]); // blank separator
    };
    cutSections.forEach((cutSection) => cutSection.groups.forEach((g) => {
      g.items.forEach((item) => {
        const unitQty = item.qty * line.qty;
        // Resolve the item to its cut part(s): a direct panel code (COA, MOA)
        // — colour-specific for Classical — else the window's design-scoped
        // composite (FRENCH WINDOW -> BORDER + INNER PARTS + SHUTTER), else none.
        const direct = resolveCutPart(item.name, model);
        const partCodes = direct
          ? [direct]
          : (compositesByDesign[model.designCode] || []);
        if (partCodes.length) {
          partCodes.forEach((pc) => {
            const cut = cutsByPart[pc];
            if (!cut) return;
            const label = pc.includes("::") ? pc.split("::").pop()! : pc;
            const comps = cut.comps.map((c) => {
              // Non-Classical designs share one cut sheet, so its finish is
              // overridden with the selected model colour. Inside = outside.
              const outside = model.designCode === "CL" ? c.outside : outFin;
              return [
                "", mrpNo, label, c.comp, c.proc,
                c.H || "", c.W || "", c.D || "", c.qty * unitQty, c.thickness || "",
                c.raw, c.process, outside, outside, c.grain, c.frontEB, c.ebDetail,
              ] as (string | number)[];
            });
            emitPartBlock(label, comps);
          });
        } else {
          // fallback: one panel row from the matrix dimensions
          const p = (item.size || "").split("x");
          const d = p[0] || "", h = p[1] || "", w = p[2] || "";
          const rawMaterial = /moulding/i.test(item.name) ? "Wood" : "HDHMR";
          emitPartBlock(item.name, [["", mrpNo, item.name, item.name, "", h, w, d, unitQty, w || "", rawMaterial, "LQD"]]);
        }
      });
    }));

    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
    // Column widths matching the source cutting-list sheet layout.
    wsDetail["!cols"] = [9, 22, 29, 19, 11, 12, 12, 13, 11, 10, 13, 12, 10, 15, 9, 14, 12].map((wch) => ({ wch }));
    wsDetail["!merges"] = detailMerges;
    styleGrid(wsDetail, detailBoldRows);
    XLSX.utils.book_append_sheet(wb, wsDetail, sheetName);
  });

  XLSX.writeFile(wb, `sunrooof-bom-${Date.now()}.xlsx`);
}

const borderThin = {
  top: { style: "thin", color: { rgb: "D3D3D3" } },
  bottom: { style: "thin", color: { rgb: "D3D3D3" } },
  left: { style: "thin", color: { rgb: "D3D3D3" } },
  right: { style: "thin", color: { rgb: "D3D3D3" } }
};

const borderHeader = {
  top: { style: "medium", color: { rgb: "000000" } },
  bottom: { style: "medium", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "7F7F7F" } },
  right: { style: "thin", color: { rgb: "7F7F7F" } }
};

const styles: Record<string, any> = {
  title: {
    font: { name: "Arial", sz: 16, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1F497D" } },
    alignment: { horizontal: "center", vertical: "center" }
  },
  company: {
    font: { name: "Arial", sz: 10, bold: true, color: { rgb: "595959" } },
    alignment: { horizontal: "center", vertical: "center" }
  },
  meta: {
    font: { name: "Arial", sz: 10, bold: true },
    alignment: { horizontal: "left", vertical: "center" }
  },
  header: {
    font: { name: "Arial", sz: 10, bold: true, color: { rgb: "000000" } },
    fill: { fgColor: { rgb: "D9D9D9" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: borderHeader
  },
  data_left: {
    font: { name: "Arial", sz: 10 },
    alignment: { horizontal: "left", vertical: "center" },
    border: borderThin
  },
  data_center: {
    font: { name: "Arial", sz: 10 },
    alignment: { horizontal: "center", vertical: "center" },
    border: borderThin
  },
  section_title: {
    font: { name: "Arial", sz: 10, bold: true, color: { rgb: "1F497D" } },
    fill: { fgColor: { rgb: "EAEAEA" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: borderThin
  },
  group_left: {
    font: { name: "Arial", sz: 10, bold: true, color: { rgb: "1F497D" } },
    fill: { fgColor: { rgb: "EAEAEA" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: borderThin
  },
  group_center: {
    font: { name: "Arial", sz: 10, bold: true, color: { rgb: "1F497D" } },
    fill: { fgColor: { rgb: "EAEAEA" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: borderThin
  },
  total_label: {
    font: { name: "Arial", sz: 11, bold: true },
    alignment: { horizontal: "right", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "double", color: { rgb: "000000" } }
    }
  },
  total_val: {
    font: { name: "Arial", sz: 11, bold: true },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "double", color: { rgb: "000000" } }
    }
  },
  footer: {
    font: { name: "Arial", sz: 10, bold: true },
    alignment: { horizontal: "center", vertical: "center" }
  }
};

function buildWorksheet(
  rawRows: any[][],
  merges: any[],
  cols: any[],
  rowsHeight: any[]
): any {
  const ws: Record<string, any> = {};
  let maxCol = 0;
  const maxRow = rawRows.length;

  rawRows.forEach((row) => {
    if (row.length > maxCol) maxCol = row.length;
  });

  // Pre-fill sheet with empty styled cells to maintain borders/fills
  for (let r = 0; r < maxRow; r++) {
    for (let c = 0; c < maxCol; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      ws[cellRef] = { v: "", t: "s", s: {} };
    }
  }

  // Populate data
  rawRows.forEach((row, r) => {
    row.forEach((cellData, c) => {
      if (cellData === null || cellData === undefined) return;
      const cellRef = XLSX.utils.encode_cell({ r, c });

      let val: any;
      let styleName = "";

      if (typeof cellData === "object" && cellData !== null && "val" in cellData) {
        val = cellData.val;
        styleName = cellData.style;
      } else {
        val = cellData;
      }

      const t = typeof val === "number" ? "n" : "s";
      ws[cellRef] = {
        v: val === null || val === undefined ? "" : val,
        t,
        s: styles[styleName] || {}
      };
    });
  });

  // Apply styling to merged range cells to keep fills/borders uniform
  merges.forEach((m) => {
    const startCellRef = XLSX.utils.encode_cell(m.s);
    const startCell = ws[startCellRef];
    if (!startCell) return;
    const style = startCell.s;

    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) continue;
        const cellRef = XLSX.utils.encode_cell({ r, c });
        ws[cellRef].s = style;
      }
    }
  });

  ws["!merges"] = merges;
  ws["!cols"] = cols;
  ws["!rows"] = rowsHeight;
  ws["!ref"] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: maxCol - 1, r: maxRow - 1 } });

  // Set showGridLines to true
  ws["!views"] = [{ showGridLines: true }];

  return ws;
}

interface PackingRow {
  name: string;
  pack: string;
  pcs: number | string;
  box: number | string; // 1 = a new box; "" = continuation of the pack above
  dim: string;
  note: string;
}

function getPackingRowsForLine(
  line: ProjectLine,
  lineIdx: number,
  mrpNo: string,
  startPackNo: number
): { rows: PackingRow[]; nextPackNo: number } {
  const model = line.model;
  const tree = bomFor(model);
  if (!tree) return { rows: [], nextPackNo: startPackNo };

  const lineSuffix = String.fromCharCode(65 + lineIdx);
  const noteText = `${mrpNo}-${lineSuffix} SET-${lineIdx + 1}`;
  let packNo = startPackNo;
  const rows: PackingRow[] = [];

  const frameSection = tree.find((sec) => /FRAME/i.test(sec.section));
  const hangSection = tree.find((sec) => /HANGING/i.test(sec.section));
  const dimOf = (item: { name: string; size: string }) => {
    const m = item.name.toUpperCase().match(/\(([^)]+)\)/);
    return m ? m[1] : item.size || "";
  };
  const baseOf = (item: { name: string }) => item.name.replace(/\s*\([^)]+\)/g, "").trim();

  // 1. Frame Panels — one pack per panel (long panels split 1 pc per pack)
  const panelGroup = frameSection?.groups.find((g) => /Frame Panels/i.test(g.name));
  panelGroup?.items.forEach((item) => {
    const dim = dimOf(item);
    const baseName = baseOf(item);
    const totalPcs = item.qty * line.qty;
    const isLongPanel = baseName.includes("COC") || parseInt(dim.split("X")[1] || "0") >= 3000;
    if (isLongPanel) {
      for (let i = 0; i < totalPcs; i++) rows.push({ name: baseName, pack: `PACK-${packNo++}`, pcs: 1, box: 1, dim, note: noteText });
    } else {
      rows.push({ name: baseName, pack: `PACK-${packNo++}`, pcs: totalPcs, box: 1, dim, note: noteText });
    }
  });

  // 2. Bottom Moulding — all items in ONE pack (one box)
  const bmGroup = frameSection?.groups.find((g) => /Bottom Moulding/i.test(g.name));
  if (bmGroup?.items.length) {
    const pack = `PACK-${packNo++}`;
    bmGroup.items.forEach((item, i) => rows.push({ name: baseOf(item), pack, pcs: item.qty * line.qty, box: i === 0 ? 1 : "", dim: dimOf(item), note: noteText }));
  }

  // 3. Hanging Profiles — its own section; all items in ONE pack (one box)
  const hpGroup = hangSection?.groups.find((g) => /Hanging Profile/i.test(g.name));
  if (hpGroup?.items.length) {
    const pack = `PACK-${packNo++}`;
    hpGroup.items.forEach((item, i) => rows.push({ name: baseOf(item), pack, pcs: item.qty * line.qty, box: i === 0 ? 1 : "", dim: dimOf(item), note: noteText }));
  }

  // 4. Parts (e.g. CLASSICAL JALI) — packed with the frame ONLY when its finish
  //    is raw; otherwise it ships with the console pack (see console packing list).
  const partsGroup = frameSection?.groups.find((g) => /^Parts$/i.test(g.name));
  partsGroup?.items.forEach((item) => {
    if (!isRawFinish(model, item.name)) return;
    rows.push({ name: baseOf(item), pack: `PACK-${packNo++}`, pcs: item.qty * line.qty, box: 1, dim: dimOf(item), note: noteText });
  });

  return { rows, nextPackNo: packNo };
}

/** True when a part's cut finish is raw (unfinished) rather than a paint colour. */
function isRawFinish(model: Model, itemName: string): boolean {
  const pc = resolveCutPart(itemName, model);
  const fin = (pc && cutsByPart[pc] && cutsByPart[pc].comps[0]) ? cutsByPart[pc].comps[0].outside : (model.colorName || "");
  return /raw/i.test(fin);
}

// Items that go in their OWN hardware pack (separate box); everything else in
// the single main hardware pack.
const SEPARATE_HW = /MS THREAD ROD|PVC FLOOR PROTECTION SHEET 6X4|PLASTIC ROLL FOR PACKING 36 INCH WIDTH/i;

function getHardwareRowsForLine(
  line: ProjectLine,
  lineIdx: number,
  mrpNo: string
): { rows: { val: any; style: string }[][]; boxes: number } {
  const model = line.model;
  const tree = bomFor(model);
  if (!tree) return { rows: [], boxes: 0 };

  const lineSuffix = String.fromCharCode(65 + lineIdx);
  const title = `HARDWARE ${mrpNo}-${lineSuffix}`;

  // Rafter dispatch = everything OUTSIDE the CONSOLE & ELECTRONICS head.
  // Only HARDWARE & PACKING items are boxed here; console/electronics items
  // (incl. Touch-up Box, HAND GLOVES, etc.) belong to the Console dispatch.
  const hwSection = tree.find((sec) => /HARDWARE/i.test(sec.section));

  const itemsList: { name: string; qty: string | number }[] = [];

  const addItemsFromSection = (section: any) => {
    if (!section) return;
    section.groups.forEach((g: any) => {
      g.items.forEach((item: any) => {
        const name = item.name;
        let qtyVal: number | string = item.qty * line.qty;
        const uom = item.uom || "";

        // Format quantities / UOMs professionally, keeping exact name.
        // Set-packaged hardware (screws, nuts, washers, fasteners) is expanded
        // from "sets" to total pieces by reading the pack size straight from the
        // name ("... SET OF N PCS") — so it stays correct when the master sheet
        // repackages (e.g. SET OF 12 -> SET OF 6). Plain (non-"SET OF") U-clamp
        // nuts/washers/fasteners keep their per-clamp multipliers.
        const setOf = name.match(/SET OF\s+(\d+)\s*PCS/i);
        if (uom.toUpperCase() === "KG") {
          qtyVal = Math.round(Number(qtyVal) * 1000) + " GM";
        } else if (uom.toUpperCase() === "MTR" || uom.toUpperCase() === "M") {
          qtyVal = Math.round(Number(qtyVal)) + " MTR";
        } else if (name.toUpperCase().includes("THREAD ROD") || name.toUpperCase().includes("THREADROD")) {
          qtyVal = Math.ceil(Number(qtyVal) * 1.25);
        } else if (setOf) {
          qtyVal = Number(qtyVal) * parseInt(setOf[1], 10);
        } else if (name.toUpperCase().includes("NUT FOR THREAD")) {
          qtyVal = Number(qtyVal) * 12;
        } else if (name.toUpperCase().includes("WASHERS")) {
          qtyVal = Number(qtyVal) * 12;
        } else if (name.toUpperCase().includes("FASTENERS")) {
          qtyVal = Number(qtyVal) * 4;
        }

        const existing = itemsList.find((it) => it.name === name);
        if (existing) {
          if (typeof qtyVal === "number" && typeof existing.qty === "number") {
            existing.qty += qtyVal;
          }
        } else {
          itemsList.push({ name, qty: qtyVal });
        }
      });
    });
  };

  addItemsFromSection(hwSection);

  if (model.designCode === "CL") {
    itemsList.push({ name: "SDI BLADE", qty: 1 });
  }

  if (model.designCode === "MI" || model.designCode === "GR") {
    itemsList.push({ name: "HAND GLOVES", qty: 8 });
  }

  // Split into two packs: a separate pack for the bulky/loose items, and one
  // main pack for everything else. Each pack is its own box.
  const sepList = itemsList.filter((it) => SEPARATE_HW.test(it.name));
  const mainList = itemsList.filter((it) => !SEPARATE_HW.test(it.name));
  const rows: any[][] = [];
  let boxes = 0;
  const emitPack = (packTitle: string, items: { name: string; qty: string | number }[]) => {
    if (!items.length) return;
    boxes++;
    rows.push([null, { val: packTitle, style: "section_title" }, null, null, { val: 1, style: "data_center" }]);
    items.forEach((item) => rows.push([null, { val: item.name, style: "data_left" }, null, { val: item.qty, style: "data_center" }]));
  };
  emitPack(title, mainList);
  emitPack(`${title} (LOOSE)`, sepList);
  return { rows, boxes };
}

export function exportRafterPackingList(
  lines: ProjectLine[],
  partyName = "Ms.Lata Ahuja",
  mrpNo = "1181",
  meta?: OrderMeta
): void {
  const wb = XLSX.utils.book_new();
  const rawRows: any[][] = [];
  const merges: any[] = [];

  // Header blocks
  merges.push({ s: { c: 1, r: 0 }, e: { c: 5, r: 0 } });
  merges.push({ s: { c: 0, r: 1 }, e: { c: 5, r: 1 } });
  merges.push({ s: { c: 0, r: 2 }, e: { c: 5, r: 2 } });
  merges.push({ s: { c: 0, r: 3 }, e: { c: 1, r: 3 } });
  merges.push({ s: { c: 2, r: 3 }, e: { c: 5, r: 3 } });
  merges.push({ s: { c: 0, r: 4 }, e: { c: 1, r: 4 } });
  merges.push({ s: { c: 2, r: 4 }, e: { c: 5, r: 4 } });
  merges.push({ s: { c: 0, r: 5 }, e: { c: 1, r: 5 } });
  merges.push({ s: { c: 2, r: 5 }, e: { c: 5, r: 5 } });
  merges.push({ s: { c: 2, r: 6 }, e: { c: 5, r: 6 } });

  const dateStr = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

  rawRows.push([null, { val: "PACKING LIST", style: "title" }]);
  rawRows.push([{ val: "                                       SUNROOOF LUMINARIES PRIVATE LIMITED", style: "company" }]);
  rawRows.push([{ val: "PLOT NO- 0358, SECTOR- 08, IMT MANESAR GURUGRAM, HARYANA-122050", style: "company" }]);
  rawRows.push([
    { val: `MRP NO / COMPLAINT NO : MRP ${mrpNo}`, style: "meta" },
    null,
    { val: `DATE : ${dateStr}`, style: "meta" }
  ]);
  rawRows.push([
    { val: `CUSTOMER NAME : ${partyName.toUpperCase()}`, style: "meta" },
    null,
    { val: "PROJECT : SUNROOOF FRAME+LIGHT", style: "meta" }
  ]);
  rawRows.push([
    { val: `DESTINATION : ${meta?.dispatchAddress || ""}`, style: "meta" },
    null,
    { val: `VEHICLE NO : ${meta?.vehicleNo || ""}`, style: "meta" }
  ]);
  rawRows.push([
    null,
    null,
    { val: `CONTACT NUMBER : ${meta?.contactNo || ""}`, style: "meta" }
  ]);
  rawRows.push([
    { val: "S.NO.", style: "header" },
    { val: "ITEM NAME ", style: "header" },
    { val: "PACK ", style: "header" },
    { val: "PCS", style: "header" },
    { val: "BOX", style: "header" },
    { val: "           BOX DIMENSION                ( L x W x H )", style: "header" },
    { val: "Notes", style: "header" }
  ]);

  let serialNo = 0;
  let packNo = 1;
  let panelBoxCount = 0;

  // Add panel items for each project line
  lines.forEach((line, lineIdx) => {
    const startRow = rawRows.length;
    const res = getPackingRowsForLine(line, lineIdx, mrpNo, packNo);

    res.rows.forEach((r) => {
      serialNo++;
      if (r.box) panelBoxCount++; // count boxes (pack starts), not continuation rows
      rawRows.push([
        { val: serialNo, style: "data_center" },
        { val: r.name, style: "data_left" },
        { val: r.pack, style: "data_center" },
        { val: r.pcs, style: "data_center" },
        { val: r.box, style: "data_center" },
        { val: r.dim, style: "data_center" },
        { val: r.note, style: "data_center" }
      ]);
    });

    packNo = res.nextPackNo;
    const endRow = rawRows.length - 1;
    if (endRow >= startRow) {
      merges.push({ s: { c: 6, r: startRow }, e: { c: 6, r: endRow } });
    }
  });

  // Empty row separator
  rawRows.push([]);

  // Total boxes = panel packs + hardware packs (both counted from what's emitted)
  let totalBoxes = panelBoxCount;

  // Add hardware packs for each project line
  lines.forEach((line, lineIdx) => {
    const { rows: hwRows, boxes } = getHardwareRowsForLine(line, lineIdx, mrpNo);
    totalBoxes += boxes;
    hwRows.forEach((r) => {
      const startHwRow = rawRows.length;
      rawRows.push(r);
      // merge the pack-title cell across the name columns
      if (r[1] && r[1].style === "section_title") merges.push({ s: { c: 1, r: startHwRow }, e: { c: 3, r: startHwRow } });
    });
  });

  // Total boxes row
  merges.push({ s: { c: 0, r: rawRows.length }, e: { c: 3, r: rawRows.length } });
  rawRows.push([
    { val: "                                        TOTAL BOXES", style: "total_label" },
    null,
    null,
    null,
    { val: totalBoxes, style: "total_val" }
  ]);

  // Footers
  rawRows.push([]);
  rawRows.push([]);

  const f1 = rawRows.length;
  rawRows.push([
    null,
    null,
    { val: "             FOR SUNROOOF LUMINARIES PRIVATE LIMITED", style: "footer" }
  ]);
  merges.push({ s: { c: 2, r: f1 }, e: { c: 5, r: f1 } });

  const f2 = rawRows.length;
  rawRows.push([
    { val: "PREPARED BY                                ", style: "footer" }
  ]);
  merges.push({ s: { c: 0, r: f2 }, e: { c: 1, r: f2 } });

  const f3 = rawRows.length;
  rawRows.push([
    null,
    null,
    { val: "Authorised Signatory", style: "footer" }
  ]);
  merges.push({ s: { c: 2, r: f3 }, e: { c: 5, r: f3 } });

  const cols = [
    { wch: 6 },
    { wch: 45 },
    { wch: 10 },
    { wch: 8 },
    { wch: 8 },
    { wch: 30 },
    { wch: 20 },
  ];

  const rowsHeight = rawRows.map((_, idx) => {
    if (idx === 0) return { hpt: 35, hpx: 35 };
    if (idx === 1 || idx === 2) return { hpt: 18, hpx: 18 };
    if (idx === 7) return { hpt: 24, hpx: 24 };
    return { hpt: 18, hpx: 18 };
  });

  const ws = buildWorksheet(rawRows, merges, cols, rowsHeight);
  XLSX.utils.book_append_sheet(wb, ws, "SAMRIDDHI");
  XLSX.writeFile(wb, `sunrooof-rafter-packing-list-${mrpNo}.xlsx`);
}

export function exportConsolePackingList(
  lines: ProjectLine[],
  partyName = "Ms.Lata Ahuja",
  mrpNo = "1181",
  meta?: OrderMeta,
  includeRemote = true,
  remoteColor: RemoteColor = "BLACK"
): void {
  const wb = XLSX.utils.book_new();
  const rawRows: any[][] = [];
  const merges: any[] = [];

  // Header blocks
  merges.push({ s: { c: 1, r: 0 }, e: { c: 5, r: 0 } });
  merges.push({ s: { c: 0, r: 1 }, e: { c: 5, r: 1 } });
  merges.push({ s: { c: 0, r: 2 }, e: { c: 5, r: 2 } });
  merges.push({ s: { c: 0, r: 3 }, e: { c: 1, r: 3 } });
  merges.push({ s: { c: 2, r: 3 }, e: { c: 5, r: 3 } });
  merges.push({ s: { c: 0, r: 4 }, e: { c: 1, r: 4 } });
  merges.push({ s: { c: 2, r: 4 }, e: { c: 5, r: 4 } });
  merges.push({ s: { c: 0, r: 5 }, e: { c: 1, r: 5 } });
  merges.push({ s: { c: 2, r: 5 }, e: { c: 5, r: 5 } });
  merges.push({ s: { c: 2, r: 6 }, e: { c: 5, r: 6 } });

  const dateStr = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

  rawRows.push([null, { val: "PACKING LIST", style: "title" }]);
  rawRows.push(["                                       SUNROOOF LUMINARIES PRIVATE LIMITED"]);
  rawRows.push(["PLOT NO- 0358, SECTOR- 08, IMT MANESAR GURUGRAM, HARYANA-122050"]);
  rawRows.push([`MRP NO / COMPLAINT NO :- MRP ${mrpNo}`, null, `DATE :  ${dateStr}`]);
  rawRows.push([`CUSTOMER NAME : ${partyName.toUpperCase()}`, null, "PROJECT : SUNROOOF LIGHT"]);
  rawRows.push([`DESTINATION : ${meta?.dispatchAddress || ""}`, null, `VEHICLE NO : ${meta?.vehicleNo || ""}`]);
  rawRows.push([`PAPER PERSON : ${meta?.planningPerson || ""}`, null, `CONTACT NUMBER : ${meta?.contactNo || ""}`]);
  rawRows.push([
    { val: "S.NO.", style: "header" },
    { val: "ITEM NAME ", style: "header" },
    { val: "PACK ", style: "header" },
    { val: "PCS", style: "header" },
    { val: "BOX", style: "header" },
    { val: "REMARKS", style: "header" }
  ]);

  let totalBoxes = 0;

  // Aggregate the CONSOLE & ELECTRONICS section by group, preserving the group
  // order and each group's own box count. Every item under this head lands in
  // the Console dispatch, grouped exactly like the BOM tree:
  //   Light Box (n console box) / ELECTRIC BOX / Touch-up Box.
  // Each group is rendered as a numbered pack (S.No + PACK-n) whose BOX column
  // holds its box count (BOM box qty x units, floored to 1 so every group ships
  // as at least one box — e.g. the ELECTRIC BOX, whose BOM box qty is 0).
  interface ConsoleGroupAgg {
    name: string;
    boxQty: number;      // physical boxes for this group (BOM box qty x units)
    order: number;
    items: { name: string; qty: number | string }[];
  }
  const groupMap = new Map<string, ConsoleGroupAgg>();
  let groupOrder = 0;

  lines.forEach((line) => {
    const base = bomFor(line.model);
    if (!base) return;
    const tree = filterTree(base, includeRemote, remoteColor, line.model.colorName);
    const consoleSection = tree.find((sec) => /CONSOLE/i.test(sec.section) || /ELECTRONICS/i.test(sec.section));
    if (!consoleSection) return;

    consoleSection.groups.forEach((g) => {
      let ga = groupMap.get(g.name);
      if (!ga) {
        ga = { name: g.name, boxQty: 0, order: groupOrder++, items: [] };
        groupMap.set(g.name, ga);
      }
      ga.boxQty += (g.qty || 0) * line.qty;

      g.items.forEach((item) => {
        const name = item.name;
        let qtyVal: number | string = item.qty * line.qty;
        const uom = item.uom || "";

        // Format quantities / UOMs professionally, keeping exact name.
        // KG -> grams (with suffix); metres shown as a plain rounded number.
        if (uom.toUpperCase() === "KG") {
          qtyVal = Math.round(Number(qtyVal) * 1000) + " GM";
        } else if (uom.toUpperCase() === "MTR" || uom.toUpperCase() === "M") {
          qtyVal = Math.round(Number(qtyVal));
        }

        const existing = ga!.items.find((it) => it.name === name);
        if (existing) {
          if (typeof qtyVal === "number" && typeof existing.qty === "number") {
            existing.qty += qtyVal;
          }
        } else {
          ga!.items.push({ name, qty: qtyVal });
        }
      });
    });

    // The jali (FRAME → "Parts") ships with the console pack unless its finish
    // is raw (then it's packed with the frame — see rafter packing list).
    tree.filter((sec) => /FRAME/i.test(sec.section)).forEach((sec) => {
      sec.groups.filter((g) => /^Parts$/i.test(g.name)).forEach((g) => {
        g.items.forEach((item) => {
          if (isRawFinish(line.model, item.name)) return;
          let ga = groupMap.get("JALI");
          if (!ga) { ga = { name: "JALI", boxQty: 0, order: groupOrder++, items: [] }; groupMap.set("JALI", ga); }
          const existing = ga.items.find((it) => it.name === item.name);
          if (existing && typeof existing.qty === "number") existing.qty += item.qty * line.qty;
          else ga.items.push({ name: item.name, qty: item.qty * line.qty });
        });
      });
    });
  });

  const consoleGroups = [...groupMap.values()].sort((a, b) => a.order - b.order);

  let groupNo = 0;
  consoleGroups.forEach((ga) => {
    groupNo++;
    const groupBoxes = Math.max(ga.boxQty, 1); // every listed group is >= 1 box
    totalBoxes += groupBoxes;

    // Group header row: S.No + name + PACK-n + its box count, banded across all columns
    rawRows.push([
      { val: groupNo, style: "group_center" },
      { val: ga.name, style: "group_left" },
      { val: `PACK-${groupNo}`, style: "group_center" },
      { val: "", style: "group_center" },
      { val: groupBoxes, style: "group_center" },
      { val: "", style: "group_center" }
    ]);

    // Item rows: no S.No / PACK, just the item name and its PCS count
    ga.items.forEach((item) => {
      rawRows.push([
        { val: "", style: "data_center" },
        { val: item.name, style: "data_left" },
        { val: "", style: "data_center" },
        { val: item.qty, style: "data_center" },
        { val: "", style: "data_center" },
        { val: "", style: "data_center" }
      ]);
    });
  });

  // Total boxes row
  merges.push({ s: { c: 0, r: rawRows.length }, e: { c: 3, r: rawRows.length } });
  rawRows.push([
    { val: "                                        TOTAL BOXES", style: "total_label" },
    null,
    null,
    null,
    { val: totalBoxes, style: "total_val" }
  ]);

  // Footers
  rawRows.push([]);
  rawRows.push([]);

  const f1 = rawRows.length;
  rawRows.push([
    null,
    null,
    { val: "             FOR SUNROOOF LUMINARIES PRIVATE LIMITED", style: "footer" }
  ]);
  merges.push({ s: { c: 2, r: f1 }, e: { c: 5, r: f1 } });

  const f2 = rawRows.length;
  rawRows.push([
    { val: "PREPARED BY                                ", style: "footer" }
  ]);
  merges.push({ s: { c: 0, r: f2 }, e: { c: 1, r: f2 } });

  const f3 = rawRows.length;
  rawRows.push([
    null,
    null,
    { val: "Authorised Signatory", style: "footer" }
  ]);
  merges.push({ s: { c: 2, r: f3 }, e: { c: 5, r: f3 } });

  const cols = [
    { wch: 6 },
    { wch: 45 },
    { wch: 10 },
    { wch: 8 },
    { wch: 8 },
    { wch: 20 }
  ];

  const rowsHeight = rawRows.map((_, idx) => {
    if (idx === 0) return { hpt: 35, hpx: 35 };
    if (idx === 1 || idx === 2) return { hpt: 18, hpx: 18 };
    if (idx === 7) return { hpt: 24, hpx: 24 };
    return { hpt: 18, hpx: 18 };
  });

  const ws = buildWorksheet(rawRows, merges, cols, rowsHeight);
  XLSX.utils.book_append_sheet(wb, ws, "Packing List");
  XLSX.writeFile(wb, `sunrooof-console-packing-list-${mrpNo}.xlsx`);
}
