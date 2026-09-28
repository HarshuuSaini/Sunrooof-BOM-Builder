"use client";

import { useMemo, useState } from "react";
import {
  DESIGNS,
  catalog,
  sizeClassesFor,
  sizesFor,
  colorsFor,
  bomFor,
  filterTree,
  displayModelCode,
  REMOTE_COLORS,
} from "@/lib/catalog";
import type { RemoteColor } from "@/lib/catalog";
import { exportProjectBom, exportRafterPackingList, exportConsolePackingList } from "@/lib/export";
import type { Model, ProjectLine, BomTree, OrderMeta } from "@/lib/types";
import { EMPTY_ORDER_META } from "@/lib/types";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

/**
 * Explains each segment of a generated model code for users.
 * Example: CL2C-WH = CL (Classical) + 2C (2x3 / 6 consoles) + WH (White).
 */
function ModelCodeDetails({ model }: { model: Model }) {
  const fullCode = displayModelCode(model);
  return (
    <div className="model-code-details" aria-label={`Model code details for ${fullCode}`}>
      <div><strong>{model.designCode}</strong><span>{model.designName} design</span></div>
      <div>
        <strong>{model.sizeCode}</strong>
        <span>{model.cpLxW.replace(/x/gi, " × ")} layout · {model.console} console{model.console > 1 ? "s" : ""}</span>
      </div>
      <div><strong>{model.colorCode}</strong><span>{model.colorName} colour</span></div>
      <div><strong>SIZE</strong><span>{model.length} × {model.width} × {model.height} mm (L × W × H)</span></div>
    </div>
  );
}

export default function SunrooofBomBuilder() {
  const [designCode, setDesignCode] = useState(DESIGNS[0].code);
  const sizeClasses = sizeClassesFor(designCode);
  const [sizeClass, setSizeClass] = useState(sizeClasses[0]);
  const sizes = sizesFor(designCode, sizeClass);
  const [sizeCode, setSizeCode] = useState(sizes[0].sizeCode);
  const colors = colorsFor(designCode, sizeCode);
  const [colorCode, setColorCode] = useState(colors[0].colorCode);
  const [qty, setQty] = useState(1);
  const [includeRemote, setIncludeRemote] = useState(true);
  const [remoteColor, setRemoteColor] = useState<RemoteColor>("BLACK");

  const model: Model | undefined =
    colorsFor(designCode, sizeCode).find((m) => m.colorCode === colorCode) ?? colors[0];

  const [lines, setLines] = useState<ProjectLine[]>([]);
  const [counter, setCounter] = useState(1);
  const [partyName, setPartyName] = useState("Ms.Lata Ahuja");
  const [mrpNo, setMrpNo] = useState("1181");
  const [orderMeta, setOrderMeta] = useState<OrderMeta>(EMPTY_ORDER_META);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const upMeta = (k: keyof OrderMeta, v: string) => setOrderMeta((m) => ({ ...m, [k]: v }));

  function onDesign(code: string) {
    setDesignCode(code);
    const sc = sizeClassesFor(code)[0];
    setSizeClass(sc);
    const s = sizesFor(code, sc)[0];
    setSizeCode(s.sizeCode);
    setColorCode(colorsFor(code, s.sizeCode)[0].colorCode);
  }
  function onSizeClass(sc: string) {
    setSizeClass(sc);
    const s = sizesFor(designCode, sc)[0];
    setSizeCode(s.sizeCode);
    setColorCode(colorsFor(designCode, s.sizeCode)[0].colorCode);
  }
  function onSize(code: string) {
    setSizeCode(code);
    setColorCode(colorsFor(designCode, code)[0].colorCode);
  }

  function addLine() {
    if (!model) return;
    setLines((ls) => [...ls, { id: counter, qty, model }]);
    setCounter((c) => c + 1);
  }
  const removeLine = (id: number) => setLines((ls) => ls.filter((l) => l.id !== id));

  const tree: BomTree | null = model ? bomFor(model) : null;
  const shownTree: BomTree | null = tree ? filterTree(tree, includeRemote, remoteColor, model?.colorName) : null;
  const fullModelCode = model ? displayModelCode(model) : "";
  const totalValue = lines.reduce((s, l) => s + l.model.price * l.qty, 0);

  return (
    <div className="app">
      <h1>Sunrooof BOM Builder</h1>
      <p className="muted">
        Configure a Sunrooof unit → view specs, the full dispatch Bill of Materials, and export to Excel.
        <span className="muted"> Catalog: {DESIGNS.length} designs · {catalog.models.length} models.</span>
      </p>

      {/* CONFIGURATOR */}
      <div className="card no-print">
        <h3>① Configure</h3>
        <div className="row">
          <div className="field">
            <label>Design</label>
            <select value={designCode} onChange={(e) => onDesign(e.target.value)}>
              {DESIGNS.map((d) => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Layout (A / B / C)</label>
            <select value={sizeClass} onChange={(e) => onSizeClass(e.target.value)}>
              {sizeClasses.map((sc) => (
                <option key={sc} value={sc}>Row {sc}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Size (consoles)</label>
            <select value={sizeCode} onChange={(e) => onSize(e.target.value)}>
              {sizes.map((s) => (
                <option key={s.sizeCode} value={s.sizeCode}>
                  {s.sizeCode} — {s.cpLxW} ({s.console} console{s.console > 1 ? "s" : ""})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Colour</label>
            <select value={colorCode} onChange={(e) => setColorCode(e.target.value)}>
              {colors.map((c) => (
                <option key={c.colorCode} value={c.colorCode}>{c.colorName}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Quantity</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value))} />
          </div>
          <div className="field">
            <label>Options</label>
            <label className="check">
              <input
                type="checkbox"
                checked={includeRemote}
                onChange={(e) => setIncludeRemote(e.target.checked)}
              />
              Include Remote (D1)
            </label>
          </div>
          {includeRemote && (
            <div className="field">
              <label>Remote Colour</label>
              <select value={remoteColor} onChange={(e) => setRemoteColor(e.target.value as RemoteColor)}>
                {REMOTE_COLORS.map((c) => (
                  <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          )}
          <button onClick={addLine} disabled={!model}>+ Add to Project</button>
        </div>
      </div>

      {/* PREVIEW */}
      {model && (
        <div className="card">
          <div className="print-head">
            <h2>SUNROOOF — Bill of Materials</h2>
            <div className="meta">
              {fullModelCode} · {model.designName} · {model.colorName} · {model.console} console
              {model.console > 1 ? "s" : ""} · {model.length}×{model.width}×{model.height} mm
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>② {fullModelCode}</h3>
            <button className="secondary no-print" disabled={!tree} onClick={() => window.print()}>
              🖨 Print / PDF
            </button>
          </div>
          <div className="code">{fullModelCode}</div>
          <ModelCodeDetails model={model} />
          <div className="kpi" style={{ marginTop: 12 }}>
            <div><span className="v">{model.console}</span><span className="l">Consoles</span></div>
            <div><span className="v">{model.length}×{model.width}</span><span className="l">L × W (mm)</span></div>
            <div><span className="v">{model.height}</span><span className="l">Height (mm)</span></div>
            <div><span className="v">{inr(model.price)}</span><span className="l">Price</span></div>
            <div><span className="v">{inr(model.mrp)}</span><span className="l">Suggested MRP</span></div>
          </div>

          <h3 style={{ marginTop: 20 }}>Bill of Materials</h3>
          {!tree ? (
            <p className="warn">
              ⚠ Detailed dispatch BOM for <b>{model.code}</b> is not yet in the source workbook
              (Classical 8-series sheets pending). Specs and pricing above are from the MODEL sheet.
              Provide the <code>{model.designCode}8{model.sizeClass}</code> detail sheet to populate this.
            </p>
          ) : (
            (shownTree ?? []).map((sec, si) => (
              <div key={si} data-bom-section style={{ marginBottom: 14 }}>
                <div className="section">{sec.section}</div>
                <table>
                  <thead>
                    <tr><th>Item</th><th>Size (mm)</th><th>Qty</th><th>UoM</th></tr>
                  </thead>
                  <tbody>
                    {sec.groups.map((g, gi) => (
                      <FragmentGroup key={gi} g={g} />
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}

      {/* PROJECT */}
      <div className="card no-print">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>③ Project ({lines.length} {lines.length === 1 ? "line" : "lines"})</h3>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {lines.length > 0 && (
              <>
                <span className="muted" style={{ fontSize: 12 }}>Party Name:</span>
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  style={{ width: 140, padding: "5px 8px", fontSize: 12 }}
                  placeholder="Party Name"
                />
                <span className="muted" style={{ fontSize: 12 }}>MRP No:</span>
                <input
                  type="text"
                  value={mrpNo}
                  onChange={(e) => setMrpNo(e.target.value)}
                  style={{ width: 80, padding: "5px 8px", fontSize: 12 }}
                  placeholder="MRP No"
                />
                <span className="muted">Total: <b style={{ color: "var(--accent)" }}>{inr(totalValue)}</b></span>
                <button className="secondary" onClick={() => setShowOrderDetails((v) => !v)} title="Order details for the Parts-BOM tab">
                  {showOrderDetails ? "▾ Order Details" : "▸ Order Details"}
                </button>
              </>
            )}
            <button className="secondary" disabled={!lines.length} onClick={() => exportProjectBom(lines, includeRemote, partyName, mrpNo, orderMeta, remoteColor)}>
              ⬇ Export BOM (.xlsx)
            </button>
            <button className="secondary" disabled={!lines.length} onClick={() => exportRafterPackingList(lines, partyName, mrpNo, orderMeta)}>
              📦 Rafter Packing List
            </button>
            <button className="secondary" disabled={!lines.length} onClick={() => exportConsolePackingList(lines, partyName, mrpNo, orderMeta, includeRemote, remoteColor)}>
              📦 Console Packing List
            </button>
          </div>
        </div>

        {lines.length > 0 && showOrderDetails && (
          <div className="row" style={{ marginTop: 12, marginBottom: 4 }}>
            {([
              ["customerCode", "Customer Code"],
              ["salesPerson", "Sales Person"],
              ["designer", "Designer"],
              ["planningPerson", "Planning Person"],
              ["dispatchAddress", "Dispatch Address"],
              ["drawingDate", "Drawing Received Date"],
              ["clearanceDate", "Clearance Date"],
              ["handoverDate", "Hand Over Date"],
              ["vehicleNo", "Vehicle No"],
              ["contactNo", "Contact Number"],
            ] as [keyof OrderMeta, string][]).map(([key, label]) => (
              <div className="field" key={key}>
                <label>{label}</label>
                <input
                  type={/Date$/.test(key) ? "date" : "text"}
                  value={orderMeta[key]}
                  onChange={(e) => upMeta(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
        {lines.length === 0 ? (
          <p className="muted">No lines yet. Configure a unit and click “Add to Project”.</p>
        ) : (
          <table>
            <thead>
              <tr><th>#</th><th>Code</th><th>Design</th><th>Colour</th><th>Consoles</th><th>Qty</th><th>Line Price</th><th></th></tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.id}</td>
                  <td className="code" style={{ fontSize: 12 }}>{displayModelCode(l.model)}</td>
                  <td>{l.model.designName}</td>
                  <td>{l.model.colorName}</td>
                  <td>{l.model.console}</td>
                  <td>{l.qty}</td>
                  <td>{inr(l.model.price * l.qty)}</td>
                  <td><button className="ghost" onClick={() => removeLine(l.id)}>remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Data generated from <code>SUNROOOF BOM MAIN.xlsx</code> + <code>SUNROOOF BOM DETAIL.xlsx</code>.
      </p>
    </div>
  );
}

import type { BomGroup } from "@/lib/types";
function FragmentGroup({ g }: { g: BomGroup }) {
  return (
    <>
      <tr className="grouprow">
        <td><b>{g.name}</b></td>
        <td className="muted">{g.size}</td>
        <td>{g.qty || ""}</td>
        <td className="muted">{g.uom}</td>
      </tr>
      {g.items.map((it, i) => (
        <tr key={i}>
          <td style={{ paddingLeft: 24 }}>{it.name}</td>
          <td className="muted">{it.size}</td>
          <td>{it.qty}</td>
          <td className="muted">{it.uom}</td>
        </tr>
      ))}
    </>
  );
}
