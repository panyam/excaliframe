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
 * Uses @panyam/servicekit-client GRPCWSClient for envelope protocol handling.
 * Adds reconnect/retry logic on top.
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
    if (!this.ws) return;

    // Send LeaveRoom action before closing
    if (this._isConnected) {
      this.sendEnvelope({
        action: { case: 'leave', value: { reason: 'user disconnected' } },
      });
    }

    this.ws.close(1000, 'user disconnected');
    this.resetState();
  }

  send(action: Record<string, unknown>): void {
    if (!this._isConnected || !this.ws) {
      throw new Error('Not connected');
    }
    this.sendEnvelope({
      ...action,
      clientId: this._clientId,
      timestamp: Date.now(),
    });
  }

  private openWebSocket(): void {
    const url = `${this._relayUrl}/ws/v1/${this._sessionId}/sync`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      // Send JoinRoom action in servicekit envelope
      this.sendEnvelope({
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
    };

    this.ws.onmessage = (ev: MessageEvent) => {
      try {
        const envelope = JSON.parse(ev.data);
        if (envelope.type === 'data' && envelope.data) {
          this.handleEvent(envelope.data);
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onerror = () => {
      this.options.onError?.(new Error('WebSocket error'));
    };

    this.ws.onclose = () => {
      const wasConnected = this._isConnected;
      this._isConnected = false;
      this._isConnecting = false;

      if (wasConnected) {
        this.options.onDisconnect?.();
      }

      // Attempt reconnect on unexpected close
      if (!this.explicitDisconnect && this.retryCount < this.maxRetries) {
        const delay = Math.pow(2, this.retryCount) * 1000;
        this.retryCount++;
        this.retryTimer = setTimeout(() => {
          this.openWebSocket();
        }, delay);
      }
    };
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

  /** Send data wrapped in servicekit envelope */
  private sendEnvelope(data: Record<string, unknown>): void {
    if (!this.ws) return;
    this.ws.send(JSON.stringify({ type: 'data', data }));
  }

  private resetState(): void {
    this._isConnected = false;
    this._isConnecting = false;
    this._clientId = '';
    this.ws = null;
  }
}
