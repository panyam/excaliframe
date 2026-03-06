import type { SyncAdapter, OutgoingUpdate, CursorData, PeerCursor } from '../sync/SyncAdapter';

export class MermaidSyncAdapter implements SyncAdapter {
  readonly tool = 'mermaid' as const;

  /** Set to true while applying remote updates to suppress echo in onChange. */
  isApplyingRemote = false;

  private getCode: () => string;
  private setCode: (code: string) => void;
  private lastSyncedText: string = '';
  private localVersion: number = 0;

  constructor(getCode: () => string, setCode: (code: string) => void) {
    this.getCode = getCode;
    this.setCode = setCode;
    this.lastSyncedText = getCode();
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
    const incomingText = payload.text as string;
    if (incomingText === undefined) return;

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

  // Cursor sync — deferred to Part 3 (Mermaid text cursor OT is complex)
  getCursorData(): CursorData | null { return null; }
  applyRemoteCursor(_peer: PeerCursor): void {}
  removePeerCursor(_clientId: string): void {}
}
