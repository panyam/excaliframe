import { hashElementsVersion, reconcileElements } from '@excalidraw/excalidraw';
import type { SyncAdapter, OutgoingUpdate, CursorData, PeerCursor } from '../sync/SyncAdapter';

// Excalidraw types — mirrors ExcalidrawEditor.tsx local definitions.
// Using `any` to avoid deep coupling to Excalidraw's internal branded types
// which change between versions.
type ExcalidrawElement = any;
interface ExcalidrawImperativeAPI {
  getSceneElements: () => readonly ExcalidrawElement[];
  getAppState: () => Record<string, any>;
  updateScene: (scene: { elements?: readonly ExcalidrawElement[]; appState?: Record<string, any> }) => void;
}

export class ExcalidrawSyncAdapter implements SyncAdapter {
  readonly tool = 'excalidraw' as const;

  /** Set to true while applying remote updates to suppress echo in onChange. */
  isApplyingRemote = false;

  private api: ExcalidrawImperativeAPI;
  /** Hash of element versionNonces at last sync point. */
  private lastSyncedHash: number = 0;
  /** Full element snapshots sent at last sync, keyed by id. */
  private lastSyncedElements: Map<string, ExcalidrawElement> = new Map();

  constructor(api: ExcalidrawImperativeAPI) {
    this.api = api;
  }

  computeOutgoing(): OutgoingUpdate | null {
    const elements = this.api.getSceneElements();
    const currentHash = hashElementsVersion(elements);
    if (currentHash === this.lastSyncedHash && this.lastSyncedElements.size > 0) {
      return null;
    }

    // Diff: find elements that changed since last sync
    const updates: Record<string, unknown>[] = [];
    for (const el of elements) {
      const prev = this.lastSyncedElements.get(el.id);
      if (!prev || prev.version !== el.version || prev.versionNonce !== el.versionNonce) {
        updates.push({
          id: el.id,
          version: el.version ?? 0,
          versionNonce: el.versionNonce ?? 0,
          data: JSON.stringify(el),
          deleted: !!el.isDeleted,
        });
      }
    }

    // Detect elements removed from scene (deleted locally)
    const currentIds = new Set(elements.map((el: ExcalidrawElement) => el.id));
    for (const [id, prev] of this.lastSyncedElements) {
      if (!currentIds.has(id)) {
        updates.push({
          id,
          version: (prev.version ?? 0) + 1,
          versionNonce: Math.floor(Math.random() * 2147483647),
          data: JSON.stringify({ ...prev, isDeleted: true }),
          deleted: true,
        });
      }
    }

    // Update tracking state
    this.lastSyncedHash = currentHash;
    this.lastSyncedElements = new Map(elements.map((el: ExcalidrawElement) => [el.id, el]));

    if (updates.length === 0) return null;
    return { type: 'sceneUpdate', payload: { elements: updates } };
  }

  applyRemote(_fromClientId: string, payload: Record<string, unknown>): void {
    const incoming = (payload.elements ?? []) as Array<{
      id: string; version: number; versionNonce: number; data: string; deleted: boolean;
    }>;
    if (incoming.length === 0) return;

    // Deserialize remote elements
    const remoteElements: ExcalidrawElement[] = incoming.map((update) => {
      const el = JSON.parse(update.data);
      if (update.deleted) el.isDeleted = true;
      return el;
    });

    // Use Excalidraw's built-in reconciliation (handles version/nonce conflicts)
    const localElements = this.api.getSceneElements();
    const reconciled = reconcileElements(
      localElements as any,
      remoteElements as any,
      this.api.getAppState() as any,
    );

    this.isApplyingRemote = true;
    this.api.updateScene({ elements: reconciled });
    this.isApplyingRemote = false;

    // Update tracking to avoid echoing these changes back
    const updated = this.api.getSceneElements();
    this.lastSyncedHash = hashElementsVersion(updated);
    this.lastSyncedElements = new Map(updated.map((el: ExcalidrawElement) => [el.id, el]));
  }

  getSceneSnapshot(): string {
    const elements = this.api.getSceneElements();
    const updates = elements.map((el: ExcalidrawElement) => ({
      id: el.id,
      version: el.version ?? 0,
      versionNonce: el.versionNonce ?? 0,
      data: JSON.stringify(el),
      deleted: !!el.isDeleted,
    }));
    return JSON.stringify({ elements: updates });
  }

  applySceneInit(payload: string): void {
    const data = JSON.parse(payload);
    const incoming = (data.elements ?? []) as Array<{
      id: string; version: number; versionNonce: number; data: string; deleted: boolean;
    }>;

    const elements: ExcalidrawElement[] = incoming.map((update) => {
      const el = JSON.parse(update.data);
      if (update.deleted) el.isDeleted = true;
      return el;
    });

    this.isApplyingRemote = true;
    this.api.updateScene({ elements });
    this.isApplyingRemote = false;

    // Initialize tracking state from the received scene
    const updated = this.api.getSceneElements();
    this.lastSyncedHash = hashElementsVersion(updated);
    this.lastSyncedElements = new Map(updated.map((el: ExcalidrawElement) => [el.id, el]));
  }

  // Cursor sync — deferred to Part 3 (stub implementations)
  getCursorData(): CursorData | null { return null; }
  applyRemoteCursor(_peer: PeerCursor): void {}
  removePeerCursor(_clientId: string): void {}
}
