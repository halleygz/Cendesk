import type { SelectedItem, TransferSnapshot } from "./types";

type Unsubscribe = () => void;

type WailsRuntime = {
  EventsOn(eventName: string, callback: (payload: unknown) => void): Unsubscribe;
  ClipboardSetText(text: string): Promise<void> | void;
};

type WailsGo = {
  main: {
    App: {
      SelectPaths(): Promise<SelectedItem[]>;
      SelectFolder(): Promise<SelectedItem[]>;
      InspectPaths(paths: string[]): Promise<SelectedItem[]>;
      StartSend(paths: string[]): Promise<TransferSnapshot>;
      StartReceive(code: string): Promise<TransferSnapshot>;
      CancelTransfer(id: string): Promise<boolean>;
      OpenFolder(path: string): Promise<void>;
    };
  };
};

declare global {
  interface Window {
    go?: WailsGo;
    runtime?: WailsRuntime;
  }
}

function app() {
  const boundApp = window.go?.main?.App;
  if (!boundApp) throw new Error("Wails bindings are not ready. Start the app with `wails dev`.");
  return boundApp;
}

export const bridge = {
  selectPaths: () => app().SelectPaths(),
  selectFolder: () => app().SelectFolder(),
  inspectPaths: (paths: string[]) => app().InspectPaths(paths),
  startSend: (paths: string[]) => app().StartSend(paths),
  startReceive: (code: string) => app().StartReceive(code),
  cancelTransfer: (id: string) => app().CancelTransfer(id),
  openFolder: (path: string) => app().OpenFolder(path),
  copyText: async (text: string) => {
    if (window.runtime?.ClipboardSetText) await window.runtime.ClipboardSetText(text);
    else await navigator.clipboard.writeText(text);
  },
  onCrocEvent: (callback: (payload: unknown) => void) => window.runtime?.EventsOn("croc:event", callback) ?? (() => undefined),
};
