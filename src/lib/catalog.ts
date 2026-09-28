// ============================================================================
// Catalog access + BOM flattening — reads the bundled catalog.json
// (generated from the Sunrooof BOM xlsx files via build-data.js)
// ============================================================================
import catalogJson from "@/data/catalog.json";
import designsJson from "@/data/designs.json";
import type { Catalog, FlatRow, Model, BomTree, ProjectLine } from "./types";

export const catalog = catalogJson as unknown as Catalog;

// Per-design BOMs come from the parametric inventory matrices
// (Inventory SUNROOOF.xlsx -> build-designs.js). Keyed by designCode -> sizeCode.
const designBoms = designsJson as unknown as {
  bomByDesignSize: Record<string, Record<string, BomTree>>;
  touchByColour?: Record<string, { name: string; qty: number; uom: string; size: string }[]>;
};
// Colour-specific Touch-up Box items (paint/stainer differs per colour).
const touchByColour = designBoms.touchByColour || {};

export const DESIGNS = catalog.designs;

/**
 * Human-facing finished-goods code. The short `model.code` remains the stable
 * BOM lookup key; this expanded code also carries console count and L × W × H.
 * Example: CL2A-WH-2-1250-850-210.
 */
export function displayModelCode(model: Model): string {
  return `${model.code}-${model.console}-${model.length}-${model.width}-${model.height}`;
}

/** Distinct size classes (A/B/C) available for a design. */
export function sizeClassesFor(designCode: string): string[] {
  return [...new Set(catalog.models.filter((m) => m.designCode === designCode).map((m) => m.sizeClass))];
}

/** Models for a design + size class (the size-variant picker), de-duplicated by sizeCode. */
export function sizesFor(designCode: string, sizeClass: string): Model[] {
  const seen = new Set<string>();
  const out: Model[] = [];
  for (const m of catalog.models) {
    if (m.designCode === designCode && m.sizeClass === sizeClass && !seen.has(m.sizeCode)) {
      seen.add(m.sizeCode);
      out.push(m);
    }
  }
  return out.sort((a, b) => a.console - b.console);
}

/** Colours available for a design + sizeCode. */
export function colorsFor(designCode: string, sizeCode: string): Model[] {
  return catalog.models.filter((m) => m.designCode === designCode && m.sizeCode === sizeCode);
}

export function findModel(code: string): Model | undefined {
  return catalog.models.find((m) => m.code === code);
}

export function bomFor(model: Model): BomTree | null {
  // Prefer the parametric inventory-matrix BOM (by design + sizeCode), all colours.
  const t = designBoms.bomByDesignSize[model.designCode]?.[model.sizeCode];
  if (t) return t;
  // Fallback to the older dispatch BOM (e.g. Classical 8-series not in the matrix).
  return model.bomKey ? catalog.boms[model.bomKey] ?? null : null;
}

/** Remote colours offered for the D1 magnetic remote. */
export const REMOTE_COLORS = ["BLACK", "WHITE", "GOLD"] as const;
export type RemoteColor = (typeof REMOTE_COLORS)[number];

/**
 * Apply the colour-dependent and remote options to a model's BOM tree:
 *  - the Touch-up Box items are swapped for the ones matching `colorName`
 *    (the paint/stainer differs per colour);
 *  - the ELECTRIC BOX (Casambi + logo) is always present, and when the remote
 *    is included the D1 magnetic remote (in `remoteColor`) + batteries are added.
 * Returns a shallow copy so the cached tree is never mutated.
 */
export function filterTree(
  tree: BomTree,
  includeRemote: boolean,
  remoteColor: RemoteColor = "BLACK",
  colorName?: string
): BomTree {
  const touch = colorName ? touchByColour[colorName.toUpperCase()] : undefined;
  return tree.map((sec) => ({
    ...sec,
    groups: sec.groups.map((g) => {
      if (touch && /touch-?up box/i.test(g.name)) {
        return { ...g, items: touch.map((it) => ({ ...it })) };
      }
      if (includeRemote && /electric box/i.test(g.name)) {
        return {
          ...g,
          items: [
            ...g.items,
            { name: `D1 REMOTE ${remoteColor}`, qty: 1, uom: "PCS", size: "" },
            { name: "DURACELL", qty: 2, uom: "PCS", size: "" },
          ],
        };
      }
      return g;
    }),
  }));
}

/** Flatten a model's BOM tree into rows, scaled by line quantity. */
export function flattenBom(model: Model, lineQty: number, includeRemote = true): FlatRow[] {
  const rows: FlatRow[] = [];
  rows.push({
    level: 0,
    name: displayModelCode(model),
    size: `${model.length}x${model.width}x${model.height}`,
    perUnitQty: 1,
    actualQty: lineQty,
    uom: "nos",
  });
  const t0 = bomFor(model);
  const tree = t0 ? filterTree(t0, includeRemote) : null;
  if (!tree) return rows;
  for (const sec of tree) {
    rows.push({ level: 1, name: sec.section, size: "", perUnitQty: 1, actualQty: lineQty, uom: "" });
    for (const g of sec.groups) {
      rows.push({
        level: 2,
        name: g.name,
        size: g.size,
        perUnitQty: g.qty || 1,
        actualQty: (g.qty || 1) * lineQty,
        uom: g.uom,
      });
      for (const it of g.items) {
        rows.push({
          level: 3,
          name: it.name,
          size: it.size,
          perUnitQty: it.qty,
          actualQty: it.qty * lineQty,
          uom: it.uom,
        });
      }
    }
  }
  return rows;
}

/** Aggregate raw items (leaf rows) across all project lines. */
export function aggregateItems(lines: ProjectLine[], includeRemote = true): { name: string; uom: string; qty: number }[] {
  const map = new Map<string, { name: string; uom: string; qty: number }>();
  for (const line of lines) {
    for (const r of flattenBom(line.model, line.qty, includeRemote)) {
      if (r.level !== 3) continue;
      const key = `${r.name}__${r.uom}`;
      const cur = map.get(key) ?? { name: r.name, uom: r.uom, qty: 0 };
      cur.qty += r.actualQty;
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
