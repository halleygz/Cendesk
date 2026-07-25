import { useEffect, useRef, useState } from "react";
import type { CrocEvent, TransferDirection, TransferSnapshot, TransferState } from "./types";
import { bridge } from "./wails";

export type TransferView = {
  id?: string;
  direction?: TransferDirection;
  state: TransferState | "idle";
  message: string;
  code?: string;
  progress: number;
  speed?: string;
  eta?: string;
  fileName?: string;
  fileCount?: number;
  totalSize?: string;
  destination?: string;
  warnings: string[];
  error?: string;
};

const initialView: TransferView = {
  state: "idle",
  message: "Ready",
  progress: 0,
  warnings: [],
};

export function useCrocTransfer() {
  const [view, setView] = useState<TransferView>(initialView);
  const activeIdRef = useRef<string | undefined>(undefined);

  useEffect(() => bridge.onCrocEvent((payload) => applyEvent(payload as CrocEvent)), []);

  const applyEvent = (event: CrocEvent) => {
    setView((current) => {
      switch (event.type) {
        case "code-generated": return { ...current, code: event.code };
        case "file-discovered": return { ...current, fileName: event.name, fileCount: event.count ?? current.fileCount, totalSize: event.displaySize ?? current.totalSize };
        case "progress-updated": return { ...current, progress: event.percent ?? current.progress, totalSize: event.total ?? current.totalSize };
        case "speed-updated": return { ...current, speed: event.speed };
        case "eta-updated": return { ...current, eta: event.eta };
        case "state-changed": return { ...current, state: event.state ?? current.state, message: event.message ?? current.message };
        case "warning": return { ...current, warnings: [...current.warnings.slice(-4), event.message ?? "Croc reported a warning"] };
        case "transfer-completed": return { ...current, state: "completed", progress: 100, message: "Transfer complete", destination: event.destination ?? current.destination };
        case "transfer-failed": return { ...current, state: "failed", message: "Transfer failed", error: event.message ?? "Croc exited unexpectedly" };
        case "transfer-cancelled": return { ...current, state: "cancelled", message: "Transfer cancelled" };
        default: return current;
      }
    });
  };

  const applySnapshot = (snapshot: TransferSnapshot) => {
    activeIdRef.current = snapshot.id;
    setView((current) => ({ ...current, id: snapshot.id, direction: snapshot.direction, state: snapshot.state, destination: snapshot.destination }));
    snapshot.events.forEach(applyEvent);
  };

  const startSend = async (paths: string[]) => {
    setView({ ...initialView, direction: "send", state: "preparing", message: "Starting Croc" });
    applySnapshot(await bridge.startSend(paths));
  };

  const startReceive = async (code: string) => {
    setView({ ...initialView, direction: "receive", state: "preparing", message: "Starting Croc" });
    applySnapshot(await bridge.startReceive(code.trim()));
  };

  const cancel = async () => {
    if (!activeIdRef.current) return;
    await bridge.cancelTransfer(activeIdRef.current);
  };

  const dismiss = () => {
    activeIdRef.current = undefined;
    setView(initialView);
  };

  return { view, startSend, startReceive, cancel, dismiss };
}
