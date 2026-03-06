/** Tool-agnostic sync adapter interface. Each editor tool (Excalidraw, Mermaid)
 *  implements this to provide diffing, merging, and scene snapshot logic.
 *  The useSync hook orchestrates timing (debounce, throttle) and routing
 *  without knowing anything about the tool's data model. */

export interface SyncAdapter {
  readonly tool: 'excalidraw' | 'mermaid';

  /** Compute diff of local changes since last sync. Return null if nothing changed. */
  computeOutgoing(): OutgoingUpdate | null;

  /** Apply a remote update from another peer. Handles conflict resolution internally. */
  applyRemote(fromClientId: string, payload: Record<string, unknown>): void;

  /** Build full scene snapshot for a new joiner requesting init. */
  getSceneSnapshot(): string;

  /** Apply full scene from an existing peer (on join). */
  applySceneInit(payload: string): void;

  /** Extract current cursor position for broadcasting. */
  getCursorData(): CursorData | null;

  /** Display a remote peer's cursor. */
  applyRemoteCursor(peer: PeerCursor): void;

  /** Remove a disconnected peer's cursor. */
  removePeerCursor(clientId: string): void;
}

export interface OutgoingUpdate {
  type: 'sceneUpdate' | 'textUpdate';
  payload: Record<string, unknown>;
}

export interface CursorData {
  x: number;
  y: number;
  tool?: string;
  button?: string;
  selectedElementIds?: Record<string, boolean>;
}

export interface PeerCursor {
  clientId: string;
  username: string;
  x: number;
  y: number;
  tool?: string;
  button?: string;
  selectedElementIds?: Record<string, boolean>;
}

export interface SyncState {
  /** True once initial scene has been received (or we're the first peer). */
  isInitialized: boolean;
}

export interface SyncActions {
  /** Call on every editor onChange. Cheap — just resets debounce timer. */
  notifyLocalChange(): void;
  /** Call on cursor move. Throttled internally. */
  notifyCursorMove(): void;
  /** Route an incoming collab event to the adapter. Called by the editor. */
  handleEvent(event: any): void;
}

/** Minimal connection info useSync needs — no dependency on useCollaboration types. */
export interface SyncConnection {
  isConnected: boolean;
  clientId: string;
  isOwner: boolean;
  peers: Map<string, unknown>;
  send: (msg: Record<string, unknown>) => void;
}
