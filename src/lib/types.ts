// ============================================================================
// Sunrooof BOM Builder — types (real data model, built from the BOM xlsx files)
// ============================================================================

export interface Model {
  sn: number;
  designName: string;   // CLASSICAL / MINIMALIST / GREEN
  designCode: string;   // CL / MI / GR
  sizeCode: string;     // 2A, 4B, 1C ...
  colorCode: string;    // WH / TK / BZ / TG
  code: string;         // CL2A-WH
  sizeClass: string;    // A / B / C
  colorName: string;    // WHITE / TEAK / REGAL BRONZE / TITANIUM GREY
  cpLxW: string;        // console panel layout, e.g. "2x1"
  console: number;      // number of light consoles
  length: number;       // mm
  width: number;        // mm
  height: number;       // mm
  price: number;        // current price (INR)
  mrp: number;          // suggested MRP (INR)
  bomKey: string | null; // key into boms map (null if no detail sheet)
}

export interface BomItem {
  name: string;
  qty: number;
  uom: string;
  size: string;         // "1250x48x210" or ""
}
export interface BomGroup {
  name: string;
  qty: number;
  uom: string;
  size: string;
  items: BomItem[];
}
export interface BomSection {
  section: string;      // FRAME DISPATCH / CONSOLE DISPATCH
  groups: BomGroup[];
}
export type BomTree = BomSection[];

export interface Catalog {
  generatedFrom: string[];
  designs: { code: string; name: string }[];
  models: Model[];
  boms: Record<string, BomTree>;
}

export interface ProjectLine {
  id: number;
  qty: number;
  model: Model;
}

/** Order metadata for the Parts-BOM (cut-list) export header. */
export interface OrderMeta {
  customerName: string;
  customerCode: string;
  factoryMrpNo: string;
  salesPerson: string;
  designer: string;
  planningPerson: string;
  dispatchAddress: string;
  drawingDate: string;
  clearanceDate: string;
  handoverDate: string;
  vehicleNo: string;
  contactNo: string;
}

export const EMPTY_ORDER_META: OrderMeta = {
  customerName: "", customerCode: "", factoryMrpNo: "", salesPerson: "",
  designer: "", planningPerson: "", dispatchAddress: "", drawingDate: "",
  clearanceDate: "", handoverDate: "", vehicleNo: "", contactNo: "",
};

/** A flattened BOM row for display / Excel export. */
export interface FlatRow {
  level: number;        // 0 model, 1 section, 2 group, 3 item
  name: string;
  size: string;
  perUnitQty: number;   // qty within one finished unit
  actualQty: number;    // perUnitQty x line qty
  uom: string;
}
