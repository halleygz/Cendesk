import { useState } from "react";
import packageInfo from "../package.json";
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
const errorDetail = (error: unknown) => error instanceof Error ? error.message : String(error);

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
  const [code, setCode] = useState("");
  const [selectionError, setSelectionError] = useState<string>();
  const { view, startSend, startReceive, cancel, dismiss } = useCrocTransfer();
  const busy = isActive(view.state);

  const reportError = (action: string, error: unknown) => {
    const detail = `${action}: ${errorDetail(error)}`;
    console.error(detail, error);
    void bridge.reportClientError(detail).catch(() => undefined);
  };

  const inspectPaths = async (paths: string[]) => {
    const files = await bridge.inspectPaths(paths);
    setItems((current) => [...files, ...current]);
  };

  const chooseFiles = async () => {
    setSelectionError(undefined);
    try {
      const files = await bridge.selectPaths();
      if (!files?.length) return;
      setItems((current) => [...files, ...current]);
    } catch (error) {
      reportError("Choose files", error);
      setSelectionError("We couldn't open the file picker. Please try again.");
    }
  };

  const chooseFolder = async () => {
    setSelectionError(undefined);
    try {
      const folders = await bridge.selectFolder();
      if (!folders?.length) return;
      setItems((current) => [...folders, ...current]);
    } catch (error) {
      reportError("Choose folder", error);
      setSelectionError("We couldn't open the folder picker. Please try again.");
    }
  };

  const sendFiles = async () => {
    setSelectionError(undefined);
    try {
      await startSend(items.map((item) => item.path));
    } catch (error) {
      reportError("Start transfer", error);
      setSelectionError("We couldn't start the transfer. Please try again.");
    }
  };

  const receiveFiles = async () => {
    try {
      await startReceive(code);
    } catch (error) {
      reportError("Receive transfer", error);
      setSelectionError("We couldn't start receiving. Check the transfer code and try again.");
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span><h1>Cendesk</h1></div>
        <nav className="mode-tabs" aria-label="Transfer mode"><button className={tab === "send" ? "active" : ""} type="button" onClick={() => setTab("send")} disabled={busy}><span className="nav-icon send-icon" aria-hidden="true" />Send files</button><button className={tab === "receive" ? "active" : ""} type="button" onClick={() => setTab("receive")} disabled={busy}><span className="nav-icon receive-icon" aria-hidden="true" />Receive files</button></nav>
      </header>
      <section className="workspace">
        <div className="workspace-content">
          {tab === "send" ? <>
            <section className="intro compact-intro"><div><h3>Share directly, securely.</h3><p>Choose files or folders to create an encrypted peer-to-peer transfer.</p></div><div className="intro-actions"><button className="secondary-button" type="button" disabled={busy} onClick={chooseFolder}>Choose folder</button><button className="primary-button" type="button" disabled={busy} onClick={chooseFiles}>Choose files</button></div></section>
            <section className="drop-zone" onClick={() => !busy && chooseFiles()} role="button" tabIndex={0} onKeyDown={(event) => { if (!busy && (event.key === "Enter" || event.key === " ")) chooseFiles(); }}><div className="drop-icon" aria-hidden="true">+</div><div><h3>Choose files to add</h3><p>Click to browse your computer</p></div></section>
            {selectionError && <div className="error-banner selection-error">{selectionError}</div>}
            <section className="inventory"><div className="inventory-heading"><div><h3>Files to send <span>{items.length}</span></h3><p>{items.length === 0 ? "Add files or folders to start a transfer." : "Files are sent directly from their current location."}</p></div><div className="inventory-actions">{items.length > 0 && !busy && <button className="clear-button" type="button" onClick={() => setItems([])}>Clear</button>}<button className="primary-button" type="button" disabled={items.length === 0 || busy} onClick={sendFiles}>{busy ? "Transfer active" : "Send files"}</button></div></div>
              {items.length === 0 ? <div className="empty-state"><span className="empty-folder" aria-hidden="true" /><p>No files selected</p></div> : <div className="file-list">{items.map((item) => <article className="file-row" key={item.id}><div className={`file-symbol ${item.kind}`} aria-hidden="true" /><div className="file-name"><strong>{item.name}</strong><span>{item.path}</span></div><dl className="file-details"><div><dt>Size</dt><dd>{item.kind === "folder" ? "Folder" : formatBytes(item.size)}</dd></div><div><dt>Modified</dt><dd>{formatDate(item.lastModified)}</dd></div></dl>{!busy && <button className="remove-button" type="button" aria-label={`Remove ${item.name}`} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}>Remove</button>}</article>)}</div>}
            </section>
          </> : <section className="receive-view"><div className="receive-copy"><span className="receive-symbol" aria-hidden="true" /><h3>Receive a shared file</h3><p>Enter the one-time transfer code from the sender. Files are saved to your Downloads folder by default.</p></div><div className="receive-form"><label htmlFor="transfer-code">Transfer code</label><input id="transfer-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. 4804-gizmo-stella-smart" autoComplete="off" spellCheck={false} disabled={busy} /><button className="primary-button" type="button" onClick={receiveFiles} disabled={code.trim().length < 6 || busy}>{busy ? "Connecting..." : "Receive files"}</button><small>Your transfer code is used only to start Croc and is never stored by Cendesk.</small>{selectionError && <div className="error-banner">{selectionError}</div>}</div></section>}
          <TransferPanel view={view} onCancel={cancel} onDismiss={dismiss} />
        </div>
        <footer>v{packageInfo.version}</footer>
      </section>
    </main>
  );
}
