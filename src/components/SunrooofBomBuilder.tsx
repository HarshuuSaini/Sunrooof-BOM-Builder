"use client";

import { useState, type ReactNode } from "react";
import { DESIGNS, REMOTE_COLORS, bomFor, catalog, colorsFor, displayModelCode, filterTree, sizeClassesFor, sizesFor, type RemoteColor } from "@/lib/catalog";
import { exportConsolePackingList, exportProjectBom, exportRafterPackingList } from "@/lib/export";
import { EMPTY_ORDER_META, type BomGroup, type OrderMeta, type ProjectLine } from "@/lib/types";

const inr = (value: number) => "₹" + value.toLocaleString("en-IN");
const META_FIELDS: [keyof OrderMeta, string][] = [
  ["customerCode", "Customer Code"], ["salesPerson", "Sales Person"], ["designer", "Designer"],
  ["planningPerson", "Planning Person"], ["dispatchAddress", "Dispatch Address"],
  ["drawingDate", "Drawing Received Date"], ["clearanceDate", "Clearance Date"],
  ["handoverDate", "Hand Over Date"], ["vehicleNo", "Vehicle No"], ["contactNo", "Contact Number"],
];

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
  const [lines, setLines] = useState<ProjectLine[]>([]);
  const [partyName, setPartyName] = useState("Ms.Lata Ahuja");
  const [mrpNo, setMrpNo] = useState("1181");
  const [orderMeta, setOrderMeta] = useState<OrderMeta>(EMPTY_ORDER_META);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"bom" | "project">("bom");

  const model = colorsFor(designCode, sizeCode).find((item) => item.colorCode === colorCode) ?? colors[0];
  const tree = model ? bomFor(model) : null;
  const shownTree = tree ? filterTree(tree, includeRemote, remoteColor, model?.colorName) : null;
  const fullModelCode = model ? displayModelCode(model) : "";
  const totalValue = lines.reduce((sum, line) => sum + line.model.price * line.qty, 0);
  const totalConsoles = lines.reduce((sum, line) => sum + line.model.console * line.qty, 0);

  function onDesign(code: string) {
    const nextClass = sizeClassesFor(code)[0];
    const nextSize = sizesFor(code, nextClass)[0];
    setDesignCode(code); setSizeClass(nextClass); setSizeCode(nextSize.sizeCode);
    setColorCode(colorsFor(code, nextSize.sizeCode)[0].colorCode);
  }
  function onSizeClass(nextClass: string) {
    const nextSize = sizesFor(designCode, nextClass)[0];
    setSizeClass(nextClass); setSizeCode(nextSize.sizeCode);
    setColorCode(colorsFor(designCode, nextSize.sizeCode)[0].colorCode);
  }
  function onSize(code: string) {
    setSizeCode(code); setColorCode(colorsFor(designCode, code)[0].colorCode);
  }
  function addLine() {
    if (!model) return;
    setLines((current) => [...current, { id: current.reduce((max, line) => Math.max(max, line.id), 0) + 1, qty, model }]);
  }

  return <div className="app planning-app">
    <header className="planning-head no-print">
      <div><h1>Sunrooof BOM Builder</h1><p className="muted">Configure a unit, review its BOM, and build the project packing lists.</p></div>
      <div className="planning-catalog">Catalog: <strong>{DESIGNS.length}</strong> designs · <strong>{catalog.models.length}</strong> models</div>
    </header>

    <div className="planning-shell">
      <aside className="planning-config no-print">
        <h3>① Configuration</h3>
        <ConfigField label="Design" marker="P1"><select value={designCode} onChange={(event) => onDesign(event.target.value)}>{DESIGNS.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></ConfigField>
        <ConfigField label="Layout (A / B / C)" marker="P2"><select value={sizeClass} onChange={(event) => onSizeClass(event.target.value)}>{sizeClasses.map((item) => <option key={item} value={item}>Row {item}</option>)}</select></ConfigField>
        <ConfigField label="Size / Consoles" marker="P3"><select value={sizeCode} onChange={(event) => onSize(event.target.value)}>{sizes.map((item) => <option key={item.sizeCode} value={item.sizeCode}>{item.sizeCode} — {item.cpLxW} ({item.console} console{item.console > 1 ? "s" : ""})</option>)}</select></ConfigField>
        <ConfigField label="Colour" marker="P4"><select value={colorCode} onChange={(event) => setColorCode(event.target.value)}>{colors.map((item) => <option key={item.colorCode} value={item.colorCode}>{item.colorName}</option>)}</select></ConfigField>
        <ConfigField label="Remote Colour" marker="P5"><select value={remoteColor} disabled={!includeRemote} onChange={(event) => setRemoteColor(event.target.value as RemoteColor)}>{REMOTE_COLORS.map((item) => <option key={item} value={item}>{item.charAt(0) + item.slice(1).toLowerCase()}</option>)}</select></ConfigField>
        <label className="check planning-remote"><input type="checkbox" checked={includeRemote} onChange={(event) => setIncludeRemote(event.target.checked)} />Include Remote (D1)</label>
      </aside>

      <main className="planning-workspace">
        {model && <>
          <section className="planning-code-panel">
            <span className="planning-code-label">Model Code</span><div className="planning-code-value">{fullModelCode}</div>
            <div className="planning-code-meta">{model.designName} · {model.colorName} · {model.console} console{model.console > 1 ? "s" : ""} · {model.length}×{model.width}×{model.height} mm</div>
            <button className="planning-copy secondary no-print" onClick={() => navigator.clipboard?.writeText(fullModelCode)}>Copy</button>
          </section>
          <div className="planning-add-row no-print"><label htmlFor="planning-qty">Quantity</label><input id="planning-qty" type="number" min={1} value={qty} onChange={(event) => setQty(Math.max(1, +event.target.value))} /><button onClick={addLine}>＋ Add to Project</button></div>
          <p className="planning-context no-print">Design: <b>{model.designName} · {model.colorName}</b> · Unit: <b>{model.sizeCode} · {model.console} consoles</b> · Remote: <b>{includeRemote ? `D1 ${remoteColor}` : "Not included"}</b></p>
        </>}

        <div className="planning-tabs no-print" role="tablist" aria-label="Builder sections">
          <button role="tab" aria-selected={activeTab === "bom"} className={activeTab === "bom" ? "active" : ""} onClick={() => setActiveTab("bom")}>BOM Preview</button>
          <button role="tab" aria-selected={activeTab === "project"} className={activeTab === "project" ? "active" : ""} onClick={() => setActiveTab("project")}>Project Lines <span>{lines.length}</span></button>
        </div>

        {activeTab === "bom" && model && <section className="planning-tab-panel" role="tabpanel">
          <div className="print-head"><h2>SUNROOOF — Bill of Materials</h2><div className="meta">{fullModelCode} · {model.designName} · {model.colorName}</div></div>
          <div className="planning-panel-head"><h3>② Bill of Materials — This Unit</h3><button className="secondary no-print" disabled={!tree} onClick={() => window.print()}>Print / PDF</button></div>
          <div className="kpi planning-kpi"><div><span className="v">{model.console}</span><span className="l">Consoles</span></div><div><span className="v">{model.length}×{model.width}</span><span className="l">L × W (mm)</span></div><div><span className="v">{model.height}</span><span className="l">Height (mm)</span></div><div><span className="v">{inr(model.price)}</span><span className="l">Price</span></div><div><span className="v">{inr(model.mrp)}</span><span className="l">Suggested MRP</span></div></div>
          {tree ? (shownTree ?? []).map((section, index) => <div key={index} data-bom-section className="planning-bom-section"><div className="section">{section.section}</div><table><thead><tr><th>Item</th><th>Size (mm)</th><th>Qty</th><th>UoM</th></tr></thead><tbody>{section.groups.map((group, groupIndex) => <GroupRows key={groupIndex} group={group} />)}</tbody></table></div>) : <p className="warn">Detailed dispatch BOM for <b>{fullModelCode}</b> is not yet in the source workbook.</p>}
        </section>}

        {activeTab === "project" && <section className="planning-tab-panel no-print" role="tabpanel">
          <div className="planning-panel-head"><h3>② Project Lines</h3><span className="muted">Project planning and downloads</span></div>
          <div className="planning-project-summary"><div><b>{lines.length}</b><span>Project Lines</span></div><div><b>{totalConsoles}</b><span>Total Consoles</span></div><div><b>{mrpNo}</b><span>MRP Number</span></div><div><b>{inr(totalValue)}</b><span>Project Value</span></div></div>
          <div className="planning-project-meta"><label>Party Name<input value={partyName} onChange={(event) => setPartyName(event.target.value)} /></label><label>MRP No<input value={mrpNo} onChange={(event) => setMrpNo(event.target.value)} /></label><button className="secondary" onClick={() => setShowOrderDetails((value) => !value)}>{showOrderDetails ? "Hide Order Details" : "Order Details"}</button></div>
          {showOrderDetails && <div className="row planning-meta-fields">{META_FIELDS.map(([key, label]) => <div className="field" key={key}><label>{label}</label><input type={/Date$/.test(key) ? "date" : "text"} value={orderMeta[key]} onChange={(event) => setOrderMeta((current) => ({ ...current, [key]: event.target.value }))} /></div>)}</div>}
          {lines.length === 0 ? <p className="muted planning-empty">No project lines yet. Configure a unit and select “Add to Project”.</p> : <table className="planning-lines-table"><thead><tr><th>#</th><th>Code</th><th>Design</th><th>Colour</th><th>Consoles</th><th>Qty</th><th>Line Price</th><th /></tr></thead><tbody>{lines.map((line) => <tr key={line.id}><td>{line.id}</td><td className="code">{displayModelCode(line.model)}</td><td>{line.model.designName}</td><td>{line.model.colorName}</td><td>{line.model.console}</td><td>{line.qty}</td><td>{inr(line.model.price * line.qty)}</td><td><button className="ghost" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>Remove</button></td></tr>)}</tbody></table>}
          <div className="planning-project-actions"><button className="secondary" disabled={!lines.length} onClick={() => exportProjectBom(lines, includeRemote, partyName, mrpNo, orderMeta, remoteColor)}>Export BOM</button><button className="secondary" disabled={!lines.length} onClick={() => exportRafterPackingList(lines, partyName, mrpNo, orderMeta)}>Rafter Packing List</button><button className="secondary" disabled={!lines.length} onClick={() => exportConsolePackingList(lines, partyName, mrpNo, orderMeta, includeRemote, remoteColor)}>Console Packing List</button></div>
        </section>}
      </main>
    </div>
    <p className="muted data-note">Data generated from <code>SUNROOOF BOM MAIN.xlsx</code> + <code>SUNROOOF BOM DETAIL.xlsx</code>.</p>
  </div>;
}

function ConfigField({ label, marker, children }: { label: string; marker: string; children: ReactNode }) {
  return <div className="field"><label>{label}<span>{marker}</span></label>{children}</div>;
}

function GroupRows({ group }: { group: BomGroup }) {
  return <><tr className="grouprow"><td><b>{group.name}</b></td><td className="muted">{group.size}</td><td>{group.qty || ""}</td><td className="muted">{group.uom}</td></tr>{group.items.map((item, index) => <tr key={index}><td style={{ paddingLeft: 24 }}>{item.name}</td><td className="muted">{item.size}</td><td>{item.qty}</td><td className="muted">{item.uom}</td></tr>)}</>;
}
