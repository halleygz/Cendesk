import { DragEvent, useState } from "react";
import type { SelectedItem } from "./types";
import { useCrocTransfer, type TransferView } from "./useCrocTransfer";
import { bridge } from "./wails";

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** unitIndex).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${units[unitIndex]}`;
};

const formatDate = (timestamp: number) => timestamp
  ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(timestamp)
  : "Unavailable";

const isActive = (state: TransferView["state"]) => ["preparing", "waiting", "connecting", "transferring", "finishing"].includes(state);
const terminalState = (state: TransferView["state"]) => ["completed", "failed", "cancelled"].includes(state);

function TransferPanel({ view, onCancel, onDismiss }: { view: TransferView; onCancel: () => void; onDismiss: () => void }) {
  if (view.state === "idle") return null;
  const active = isActive(view.state);
  return (
    <section className={`transfer-panel state-${view.state}`}>
      <div className="transfer-topline">
        <div><p className="section-label">Live transfer</p><h2>{view.message}</h2></div>
        <span className="transfer-state">{view.state}</span>
      </div>
      {view.code && <div className="code-block"><span>One-time Croc code</span><button type="button" title="Copy transfer code" onClick={() => bridge.copyText(view.code!)}>{view.code}<b>Copy</b></button><small>This code is also the encrypted transfer key. Share it only with the receiver.</small></div>}
      <div className="progress-track" aria-label={`${view.progress}% complete`}><span style={{ width: `${view.progress}%` }} /></div>
      <div className="transfer-metrics"><div><span>Progress</span><strong>{view.progress}%</strong></div><div><span>Speed</span><strong>{view.speed ?? "--"}</strong></div><div><span>Remaining</span><strong>{view.eta ?? "--"}</strong></div><div><span>Size</span><strong>{view.totalSize ?? "--"}</strong></div></div>
      {view.fileName && <p className="current-file">{view.direction === "send" ? "Sending" : "Receiving"}: <strong>{view.fileName}</strong>{view.fileCount ? ` · ${view.fileCount} items` : ""}</p>}
      {view.destination && <p className="destination-line">Saved to <strong>{view.destination}</strong></p>}
      {view.error && <div className="error-banner">{view.error}</div>}
      {view.warnings.map((warning, index) => <div className="warning-banner" key={`${warning}-${index}`}>{warning}</div>)}
      <div className="transfer-actions">
        {active && <button className="danger-button" type="button" onClick={onCancel}>Cancel transfer</button>}
        {terminalState(view.state) && <button className="secondary-button" type="button" onClick={onDismiss}>Dismiss</button>}
        {view.state === "completed" && view.destination && <button className="primary-button" type="button" onClick={() => bridge.openFolder(view.destination!)}>Open destination</button>}
      </div>
    </section>
  );
}

export default function App() {
  const [tab, setTab] = useState<"send" | "receive">("send");
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [code, setCode] = useState("");
  const [selectionError, setSelectionError] = useState<string>();
  const { view, startSend, startReceive, cancel, dismiss } = useCrocTransfer();
  const busy = isActive(view.state);

  const inspectPaths = async (paths: string[]) => {
    const files = await bridge.inspectPaths(paths);
    setItems((current) => [...files, ...current]);
  };

  const chooseFiles = async () => {
    setSelectionError(undefined);
    try {
      const files = await bridge.selectPaths();
      setItems((current) => [...files, ...current]);
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : "Unable to choose files.");
    }
  };

  const chooseFolder = async () => {
    setSelectionError(undefined);
    try {
      const folders = await bridge.selectFolder();
      setItems((current) => [...folders, ...current]);
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : "Unable to choose a folder.");
    }
  };

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    setSelectionError(undefined);
    const paths = event.dataTransfer.getData("text/uri-list").split(/\r?\n/).filter((uri) => uri.startsWith("file://")).map((uri) => decodeURIComponent(new URL(uri).pathname));
    try {
      if (paths.length === 0) throw new Error("Drop local files or use Choose files.");
      await inspectPaths(paths);
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : "Unable to add dropped files.");
    }
  };

  const sendFiles = async () => {
    setSelectionError(undefined);
    try {
      await startSend(items.map((item) => item.path));
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : "Unable to start sending.");
    }
  };

  const receiveFiles = async () => {
    try {
      await startReceive(code);
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : "Unable to start receiving.");
    }
  };

  return (
    <main className="app-shell" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={handleDrop}>
      <header className="topbar"><div className="brand-lockup"><span className="brand-mark" aria-hidden="true"><span /><span /></span><div><p className="eyebrow">Secure peer-to-peer transfer</p><h1>File Atlas</h1></div></div><div className="status-pill"><span /> Croc desktop</div></header>
      <nav className="mode-tabs" aria-label="Transfer mode"><button className={tab === "send" ? "active" : ""} type="button" onClick={() => setTab("send")} disabled={busy}>Send</button><button className={tab === "receive" ? "active" : ""} type="button" onClick={() => setTab("receive")} disabled={busy}>Receive</button></nav>

      {tab === "send" ? <>
        <section className="intro compact-intro"><div><p className="section-label">Send with Croc</p><h2>Share files,<br /><em>not friction.</em></h2></div><p className="intro-copy">Choose files or folders, or drop local paths. Wails sends the real filesystem paths directly to Croc, so the app no longer needs staging API routes.</p></section>
        <section className={`drop-zone${isDragging ? " is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }} onClick={() => !busy && chooseFiles()} role="button" tabIndex={0} onKeyDown={(event) => { if (!busy && (event.key === "Enter" || event.key === " ")) chooseFiles(); }}><div className="drop-icon" aria-hidden="true">+</div><div><h3>{isDragging ? "Release to add" : "Drop files or choose paths"}</h3><p><span>Choose files</span> from your computer</p></div><div className="drop-hint">Powered by Croc</div></section>
        {selectionError && <div className="error-banner selection-error">{selectionError}</div>}
        <section className="inventory"><div className="inventory-heading"><div><p className="section-label">Transfer inventory</p><h2>{items.length === 0 ? "Nothing selected" : `${items.length} ${items.length === 1 ? "item" : "items"} ready`}</h2></div><div className="inventory-actions">{items.length > 0 && !busy && <button className="clear-button" type="button" onClick={() => setItems([])}>Clear all</button>}<button className="secondary-button" type="button" disabled={busy} onClick={chooseFolder}>Choose folder</button><button className="primary-button" type="button" disabled={items.length === 0 || busy} onClick={sendFiles}>{busy ? "Transfer active" : "Send with Croc"}</button></div></div>
          {items.length === 0 ? <div className="empty-state"><span className="empty-line" /><p>Your files and folders will appear here.</p><span className="empty-line" /></div> : <div className="file-list">{items.map((item, index) => <article className="file-row" key={item.id}><div className="file-index">{String(index + 1).padStart(2, "0")}</div><div className="file-symbol" aria-hidden="true">{item.kind === "folder" ? "DIR" : item.type.startsWith("image/") ? "IMG" : "FILE"}</div><div className="file-name"><strong>{item.name}</strong><span>{item.path}</span></div><dl className="file-details"><div><dt>Size</dt><dd>{item.kind === "folder" ? "Calculated by Croc" : formatBytes(item.size)}</dd></div><div><dt>Modified</dt><dd>{formatDate(item.lastModified)}</dd></div></dl>{!busy && <button className="remove-button" type="button" aria-label={`Remove ${item.name}`} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}>×</button>}</article>)}</div>}
        </section>
      </> : <section className="receive-view"><div className="receive-copy"><p className="section-label">Receive with Croc</p><h2>Bring a transfer<br /><em>home.</em></h2><p>Enter the one-time code from the sender. Received files are saved to your Downloads folder by default.</p></div><div className="receive-form"><label htmlFor="transfer-code">Transfer code</label><input id="transfer-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. 4804-gizmo-stella-smart" autoComplete="off" spellCheck={false} disabled={busy} /><button className="primary-button" type="button" onClick={receiveFiles} disabled={code.trim().length < 6 || busy}>{busy ? "Connecting..." : "Receive files"}</button><small>The code is passed to Croc through the process environment and is never stored.</small>{selectionError && <div className="error-banner">{selectionError}</div>}</div></section>}

      <TransferPanel view={view} onCancel={cancel} onDismiss={dismiss} />
      <footer><span>OFFICIAL CROC CLI</span><span>WAILS + GO</span><span>NO LOCAL HTTP SERVER</span></footer>
    </main>
  );
}
