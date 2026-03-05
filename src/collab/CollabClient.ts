import type { CollabEvent, PeerInfo } from './types';

export interface CollabClientOptions {
  onEvent?: (event: CollabEvent) => void;
  onPeerJoined?: (peer: PeerInfo) => void;
  onPeerLeft?: (clientId: string) => void;
  onError?: (error: Error) => void;
  onConnect?: (clientId: string) => void;
  onDisconnect?: () => void;
  maxRetries?: number;
}

/**
 * Framework-agnostic WebSocket client for the collab relay.
 * Uses the servicekit JSON envelope protocol ({type: "data", data: {...}}).
 */
export class CollabClient {
  private ws: WebSocket | null = null;
  private _clientId: string = '';
  private _isConnected: boolean = false;
  private _isConnecting: boolean = false;
  private _relayUrl: string = '';
  private _sessionId: string = '';
  private _username: string = '';
  private _tool: string = '';
  private options: CollabClientOptions;
  private retryCount: number = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private explicitDisconnect: boolean = false;

  constructor(options: CollabClientOptions = {}) {
    this.options = options;
  }

  get clientId(): string { return this._clientId; }
  get isConnected(): boolean { return this._isConnected; }
  get isConnecting(): boolean { return this._isConnecting; }

  connect(relayUrl: string, sessionId: string, username: string, tool: string): void {
    // stub
  }

  disconnect(): void {
    // stub
  }

  send(action: Record<string, unknown>): void {
    // stub
  }
}
