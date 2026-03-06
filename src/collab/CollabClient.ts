import { GRPCWSClient } from '@panyam/servicekit-client';
import type { PeerInfo } from './types';
import { resolveRelayUrl } from './url-params';

export interface CollabClientOptions {
  onEvent?: (event: any) => void;
  onPeerJoined?: (peer: PeerInfo) => void;
  onPeerLeft?: (clientId: string) => void;
  onError?: (error: Error) => void;
  onConnect?: (clientId: string) => void;
  onDisconnect?: () => void;
  maxRetries?: number;
  /** Factory for creating GRPCWSClient instances. Defaults to `() => new GRPCWSClient()`.
   *  Override in tests with `GRPCWSClient.createMock()`. */
  _grpcFactory?: () => GRPCWSClient;
}

/**
 * Framework-agnostic WebSocket client for the collab relay.
 * Uses @panyam/servicekit-client GRPCWSClient for envelope protocol
 * and auto ping/pong. Adds reconnect with exponential backoff on top.
 */
export class CollabClient {
  private grpc: GRPCWSClient | null = null;
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
  private maxRetries: number;

  constructor(options: CollabClientOptions = {}) {
    this.options = options;
    this.maxRetries = options.maxRetries ?? 5;
  }

  get clientId(): string { return this._clientId; }
  get isConnected(): boolean { return this._isConnected; }
  get isConnecting(): boolean { return this._isConnecting; }

  connect(relayUrl: string, sessionId: string, username: string, tool: string): void {
    if (this._isConnected) {
      throw new Error('Already connected');
    }

    this._relayUrl = relayUrl;
    this._sessionId = sessionId;
    this._username = username;
    this._tool = tool;
    this._isConnecting = true;
    this.explicitDisconnect = false;
    this.retryCount = 0;

    this.openWebSocket();
  }

  disconnect(): void {
    this.explicitDisconnect = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (!this.grpc) return;

    // Send LeaveRoom before closing
    if (this._isConnected) {
      this.grpc.send({ leave: { reason: 'user disconnected' } });
    }

    this.grpc.close();
    this.resetState();
  }

  send(action: Record<string, unknown>): void {
    if (!this._isConnected || !this.grpc) {
      throw new Error('Not connected');
    }
    this.grpc.send({
      ...action,
      clientId: this._clientId,
      timestamp: Date.now(),
    });
  }

  private openWebSocket(): void {
    const resolved = resolveRelayUrl(this._relayUrl);
    const url = `${resolved}/ws/v1/${this._sessionId}/sync`;
    this.grpc = this.options._grpcFactory ? this.options._grpcFactory() : new GRPCWSClient();

    // GRPCWSClient.onMessage receives data already unwrapped from the
    // servicekit envelope ({type:"data", data:...} → just the data).
    this.grpc.onMessage = (data: any) => {
      this.handleEvent(data);
    };

    this.grpc.onClose = () => {
      this.handleConnectionClosed();
    };

    this.grpc.onError = (err: string) => {
      this.options.onError?.(new Error(err));
    };

    // connect() is Promise-based — send JoinRoom once WS is open.
    // Messages use standard protobuf JSON format (field names at top level
    // for oneof, camelCase for field names) so the Go relay can parse them
    // with protojson.Unmarshal.
    this.grpc.connect(url).then(() => {
      this.grpc?.send({
        join: {
          sessionId: this._sessionId,
          username: this._username,
          tool: this._tool,
          clientType: 'browser',
        },
      });
    }).catch(() => {
      // Error already dispatched via grpc.onError
    });
  }

  private handleEvent(data: any): void {
    this.options.onEvent?.(data);

    // Standard protobuf JSON: oneof fields appear at the top level
    // e.g. { "roomJoined": { "clientId": "c1", ... } }
    if (data.roomJoined) {
      this._clientId = data.roomJoined.clientId;
      this._isConnected = true;
      this._isConnecting = false;
      this.retryCount = 0;
      this.options.onConnect?.(this._clientId);

      // Add self as a peer (server doesn't include joining client in peers list)
      this.options.onPeerJoined?.({
        clientId: this._clientId,
        username: this._username,
        avatarUrl: '',
        clientType: 'browser',
        isActive: true,
      } as PeerInfo);

      // Add existing peers already in the room
      if (data.roomJoined.peers) {
        for (const peer of data.roomJoined.peers) {
          this.options.onPeerJoined?.(peer);
        }
      }
    } else if (data.peerJoined) {
      this.options.onPeerJoined?.(data.peerJoined.peer);
    } else if (data.peerLeft) {
      this.options.onPeerLeft?.(data.peerLeft.clientId);
    }
  }

  private handleConnectionClosed(): void {
    const wasConnected = this._isConnected;
    this._isConnected = false;
    this._isConnecting = false;

    if (wasConnected) {
      this.options.onDisconnect?.();
    }

    // Reconnect on unexpected close
    if (!this.explicitDisconnect && this.retryCount < this.maxRetries) {
      const delay = Math.pow(2, this.retryCount) * 1000;
      this.retryCount++;
      this.retryTimer = setTimeout(() => {
        this.openWebSocket();
      }, delay);
    }
  }

  private resetState(): void {
    this._isConnected = false;
    this._isConnecting = false;
    this._clientId = '';
    this.grpc = null;
  }
}
