export type TransferDirection = "send" | "receive";
export type TransferState = "preparing" | "waiting" | "connecting" | "transferring" | "finishing" | "completed" | "failed" | "cancelled";

export type CrocEvent = {
  type: "transfer-started" | "code-generated" | "file-discovered" | "progress-updated" | "speed-updated" | "eta-updated" | "state-changed" | "warning" | "transfer-completed" | "transfer-failed" | "transfer-cancelled" | "output";
  direction?: TransferDirection;
  state?: TransferState;
  timestamp: number;
  code?: string;
  name?: string;
  count?: number;
  size?: number;
  displaySize?: string;
  percent?: number;
  transferred?: string;
  total?: string;
  speed?: string;
  eta?: string;
  message?: string;
  destination?: string;
  stream?: "stdout" | "stderr";
};

export type TransferSnapshot = {
  id: string;
  direction: TransferDirection;
  state: TransferState;
  destination?: string;
  events: CrocEvent[];
};

export type SelectedItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  kind: "file" | "folder";
  path: string;
};
