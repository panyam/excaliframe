import { GRPCWSClient } from '@panyam/servicekit-client';
import type { PeerInfo } from './types';

export interface CollabClientOptions {
  onEvent?: (event: any) => void;
  onPeerJoined?: (peer: PeerInfo) => void;
  onPeerLeft?: (clientId: string) => void;
  onError?: (error: Error) => void;
  onConnect?: (clientId: string) => void;
  onDisconnect?: () => void;
  maxRetries?: number;
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
      this.grpc.send({
        action: { case: 'leave', value: { reason: 'user disconnected' } },
      });
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
    const url = `${this._relayUrl}/ws/v1/${this._sessionId}/sync`;
    this.grpc = new GRPCWSClient();

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
    this.grpc.connect(url).then(() => {
      this.grpc?.send({
        action: {
          case: 'join',
          value: {
            sessionId: this._sessionId,
            username: this._username,
            tool: this._tool,
            clientType: 'browser',
          },
        },
      });
    }).catch(() => {
      // Error already dispatched via grpc.onError
    });
  }

  private handleEvent(data: any): void {
    this.options.onEvent?.(data);

    const evt = data.event;
    if (!evt) return;

    switch (evt.case) {
      case 'roomJoined': {
        this._clientId = evt.value.clientId;
        this._isConnected = true;
        this._isConnecting = false;
        this.retryCount = 0;
        this.options.onConnect?.(this._clientId);
        break;
      }
      case 'peerJoined': {
        this.options.onPeerJoined?.(evt.value.peer);
        break;
      }
      case 'peerLeft': {
        this.options.onPeerLeft?.(evt.value.clientId);
        break;
      }
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
