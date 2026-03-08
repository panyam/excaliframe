import type { SyncAdapter, OutgoingUpdate, CursorData, PeerCursor } from '../sync/SyncAdapter';
import { getPeerColor, getPeerLabel, hashClientIdToColorIndex } from '../peerColors';

export interface MermaidRemoteCursor {
  clientId: string;
  username: string;
  line: number;
  charOffset: number;
  color: { background: string; stroke: string };
}

export class MermaidSyncAdapter implements SyncAdapter {
  readonly tool = 'mermaid' as const;

  /** Set to true while applying remote updates to suppress echo in onChange. */
  isApplyingRemote = false;

  private getCode: () => string;
  private setCode: (code: string) => void;
  private lastSyncedText: string = '';
  private localVersion: number = 0;

  // Cursor tracking state
  private localSelection: { start: number; end: number } | null = null;
  private remoteCursors: Map<string, MermaidRemoteCursor> = new Map();
  private peerIndex: Map<string, number> = new Map();
  private nextPeerIndex: number = 0;
  onCursorsChange?: () => void;

  constructor(getCode: () => string, setCode: (code: string) => void, onCursorsChange?: () => void) {
    this.getCode = getCode;
    this.setCode = setCode;
    this.lastSyncedText = getCode();
    this.onCursorsChange = onCursorsChange;
  }

  computeOutgoing(): OutgoingUpdate | null {
    const current = this.getCode();
    if (current === this.lastSyncedText) return null;

    this.localVersion++;
    this.lastSyncedText = current;

    return {
      type: 'textUpdate',
      payload: { text: current, version: this.localVersion },
    };
  }

  applyRemote(_fromClientId: string, payload: Record<string, unknown>): void {
    const incomingVersion = (payload.version as number) ?? 0;
    const incomingText = payload.text;
    if (typeof incomingText !== 'string') return;

    if (incomingVersion > this.localVersion) {
      this.isApplyingRemote = true;
      this.setCode(incomingText);
      this.localVersion = incomingVersion;
      this.lastSyncedText = incomingText;
      this.isApplyingRemote = false;
    }
  }

  getSceneSnapshot(): string {
    return JSON.stringify({
      text: this.getCode(),
      version: this.localVersion,
    });
  }

  applySceneInit(payload: string): void {
    const data = JSON.parse(payload);
    const text = data.text as string;
    const version = (data.version as number) ?? 0;

    this.isApplyingRemote = true;
    this.setCode(text);
    this.localVersion = version;
    this.lastSyncedText = text;
    this.isApplyingRemote = false;
  }

  // Cursor tracking

  setLocalSelection(start: number, end: number): void {
    this.localSelection = { start, end };
  }

  getCursorData(): CursorData | null {
    if (!this.localSelection) return null;
    return { x: this.localSelection.start, y: this.localSelection.end, tool: 'text' };
  }

  private ensurePeerIndex(clientId: string): number {
    let idx = this.peerIndex.get(clientId);
    if (idx === undefined) {
      idx = this.nextPeerIndex++;
      this.peerIndex.set(clientId, idx);
    }
    return idx;
  }

  private charOffsetToLine(offset: number): number {
    const text = this.getCode();
    const slice = text.slice(0, Math.max(0, offset));
    let line = 1;
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] === '\n') line++;
    }
    return line;
  }

  applyRemoteCursor(peer: PeerCursor): void {
    const idx = this.ensurePeerIndex(peer.clientId);
    const colorIdx = hashClientIdToColorIndex(peer.clientId);
    const color = getPeerColor(colorIdx);
    const line = this.charOffsetToLine(peer.x);
    this.remoteCursors.set(peer.clientId, {
      clientId: peer.clientId,
      username: peer.username || getPeerLabel(idx),
      line,
      charOffset: peer.x,
      color,
    });
    this.onCursorsChange?.();
  }

  removePeerCursor(clientId: string): void {
    this.remoteCursors.delete(clientId);
    this.onCursorsChange?.();
  }

  getRemoteCursors(): Map<string, MermaidRemoteCursor> {
    return this.remoteCursors;
  }
}
