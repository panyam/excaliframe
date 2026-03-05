import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CollabClient } from './CollabClient';

// ─── Mock WebSocket ─────────────────────────────

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) { this.sentMessages.push(data); }
  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code: code || 1000, reason }));
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }
  simulateMessage(data: unknown) {
    // Servicekit envelope: {type: "data", data: <payload>}
    this.onmessage?.(new MessageEvent('message', {
      data: JSON.stringify({ type: 'data', data }),
    }));
  }
  simulateError() { this.onerror?.(new Event('error')); }
  simulateClose(code = 1006) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code }));
  }
}

// ─── Tests ──────────────────────────────────────

describe('CollabClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket as unknown);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('creates instance with default disconnected state', () => {
      const client = new CollabClient();
      expect(client.isConnected).toBe(false);
      expect(client.isConnecting).toBe(false);
      expect(client.clientId).toBe('');
    });
  });

  describe('connect', () => {
    it('constructs correct WebSocket URL from relay URL and session ID', () => {
      const client = new CollabClient();
      client.connect('ws://localhost:8787', 'test-session', 'Alice', 'excalidraw');
      expect(MockWebSocket.instances).toHaveLength(1);
      expect(MockWebSocket.instances[0].url).toBe('ws://localhost:8787/ws/v1/test-session/sync');
    });

    it('sets isConnecting to true while connecting', () => {
      const client = new CollabClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      expect(client.isConnecting).toBe(true);
      expect(client.isConnected).toBe(false);
    });

    it('sends JoinRoom action (servicekit envelope) on WebSocket open', () => {
      const client = new CollabClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      MockWebSocket.instances[0].simulateOpen();

      expect(MockWebSocket.instances[0].sentMessages).toHaveLength(1);
      const envelope = JSON.parse(MockWebSocket.instances[0].sentMessages[0]);
      expect(envelope.type).toBe('data');
      const msg = envelope.data;
      expect(msg.action).toMatchObject({ case: 'join' });
      expect(msg.action.value.sessionId).toBe('sess1');
      expect(msg.action.value.username).toBe('Alice');
      expect(msg.action.value.tool).toBe('excalidraw');
      expect(msg.action.value.clientType).toBe('browser');
    });

    it('sets isConnected after receiving RoomJoined event', () => {
      const onConnect = vi.fn();
      const client = new CollabClient({ onConnect });
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({
        event: { case: 'roomJoined', value: { clientId: 'client-123', sessionId: 'sess1', peers: [] } },
      });

      expect(client.isConnected).toBe(true);
      expect(client.isConnecting).toBe(false);
      expect(client.clientId).toBe('client-123');
      expect(onConnect).toHaveBeenCalledWith('client-123');
    });

    it('calls onPeerJoined callback when peer joins', () => {
      const onPeerJoined = vi.fn();
      const client = new CollabClient({ onPeerJoined });
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({
        event: { case: 'roomJoined', value: { clientId: 'c1', sessionId: 'sess1', peers: [] } },
      });
      ws.simulateMessage({
        event: {
          case: 'peerJoined',
          value: {
            peer: { clientId: 'c2', username: 'Bob', avatarUrl: '', clientType: 'browser', isActive: true },
          },
        },
      });

      expect(onPeerJoined).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'c2', username: 'Bob' }),
      );
    });

    it('calls onPeerLeft callback when peer leaves', () => {
      const onPeerLeft = vi.fn();
      const client = new CollabClient({ onPeerLeft });
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({
        event: { case: 'roomJoined', value: { clientId: 'c1', sessionId: 'sess1', peers: [] } },
      });
      ws.simulateMessage({
        event: { case: 'peerLeft', value: { clientId: 'c2', reason: 'disconnected', peerCount: 1 } },
      });

      expect(onPeerLeft).toHaveBeenCalledWith('c2');
    });

    it('calls onEvent callback for all received events', () => {
      const onEvent = vi.fn();
      const client = new CollabClient({ onEvent });
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();

      ws.simulateMessage({ event: { case: 'roomJoined', value: { clientId: 'c1', sessionId: 's1', peers: [] } } });
      ws.simulateMessage({ event: { case: 'peerJoined', value: { peer: { clientId: 'c2' } } } });

      expect(onEvent).toHaveBeenCalledTimes(2);
    });

    it('calls onError callback on WebSocket error', () => {
      const onError = vi.fn();
      const client = new CollabClient({ onError });
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      MockWebSocket.instances[0].simulateError();

      expect(onError).toHaveBeenCalled();
    });

    it('calls onDisconnect callback on WebSocket close', () => {
      const onDisconnect = vi.fn();
      const client = new CollabClient({ onDisconnect });
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({
        event: { case: 'roomJoined', value: { clientId: 'c1', sessionId: 's1', peers: [] } },
      });
      ws.simulateClose(1000);

      expect(onDisconnect).toHaveBeenCalled();
    });

    it('throws if already connected', () => {
      const client = new CollabClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({
        event: { case: 'roomJoined', value: { clientId: 'c1', sessionId: 's1', peers: [] } },
      });

      expect(() => {
        client.connect('ws://localhost:8787', 'sess2', 'Alice', 'excalidraw');
      }).toThrow();
    });
  });

  describe('disconnect', () => {
    it('sends LeaveRoom action (servicekit envelope) before closing', () => {
      const client = new CollabClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({
        event: { case: 'roomJoined', value: { clientId: 'c1', sessionId: 's1', peers: [] } },
      });

      ws.sentMessages = [];
      client.disconnect();

      expect(ws.sentMessages).toHaveLength(1);
      const envelope = JSON.parse(ws.sentMessages[0]);
      expect(envelope.type).toBe('data');
      expect(envelope.data.action).toMatchObject({ case: 'leave' });
    });

    it('closes WebSocket connection', () => {
      const client = new CollabClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({
        event: { case: 'roomJoined', value: { clientId: 'c1', sessionId: 's1', peers: [] } },
      });

      client.disconnect();
      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    });

    it('resets state to disconnected', () => {
      const client = new CollabClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({
        event: { case: 'roomJoined', value: { clientId: 'c1', sessionId: 's1', peers: [] } },
      });

      client.disconnect();
      expect(client.isConnected).toBe(false);
      expect(client.isConnecting).toBe(false);
    });

    it('is a no-op if not connected', () => {
      const client = new CollabClient();
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe('send', () => {
    it('serializes and sends over WebSocket in servicekit envelope', () => {
      const client = new CollabClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({
        event: { case: 'roomJoined', value: { clientId: 'c1', sessionId: 's1', peers: [] } },
      });

      ws.sentMessages = [];
      client.send({ action: { case: 'presence', value: { isActive: true, username: 'Alice' } } });

      expect(ws.sentMessages).toHaveLength(1);
      const envelope = JSON.parse(ws.sentMessages[0]);
      expect(envelope.type).toBe('data');
      expect(envelope.data.clientId).toBe('c1');
      expect(envelope.data.timestamp).toBeDefined();
    });

    it('throws if not connected', () => {
      const client = new CollabClient();
      expect(() => client.send({ action: { case: 'presence' } })).toThrow();
    });
  });

  describe('reconnect', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('attempts reconnect after unexpected disconnect', () => {
      const client = new CollabClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({
        event: { case: 'roomJoined', value: { clientId: 'c1', sessionId: 's1', peers: [] } },
      });

      ws.simulateClose(1006);
      vi.advanceTimersByTime(1000);

      expect(MockWebSocket.instances).toHaveLength(2);
    });

    it('uses exponential backoff (1s, 2s, 4s)', () => {
      const client = new CollabClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      let ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({
        event: { case: 'roomJoined', value: { clientId: 'c1', sessionId: 's1', peers: [] } },
      });

      // First unexpected close
      ws.simulateClose(1006);
      vi.advanceTimersByTime(1000); // 1s
      expect(MockWebSocket.instances).toHaveLength(2);

      // Second failure
      ws = MockWebSocket.instances[1];
      ws.simulateClose(1006);
      vi.advanceTimersByTime(1000); // not enough
      expect(MockWebSocket.instances).toHaveLength(2);
      vi.advanceTimersByTime(1000); // 2s total
      expect(MockWebSocket.instances).toHaveLength(3);

      // Third failure
      ws = MockWebSocket.instances[2];
      ws.simulateClose(1006);
      vi.advanceTimersByTime(3000); // not enough
      expect(MockWebSocket.instances).toHaveLength(3);
      vi.advanceTimersByTime(1000); // 4s total
      expect(MockWebSocket.instances).toHaveLength(4);
    });

    it('stops reconnecting after maxRetries', () => {
      const client = new CollabClient({ maxRetries: 2 });
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      let ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({
        event: { case: 'roomJoined', value: { clientId: 'c1', sessionId: 's1', peers: [] } },
      });

      ws.simulateClose(1006);
      vi.advanceTimersByTime(1000);
      expect(MockWebSocket.instances).toHaveLength(2);

      MockWebSocket.instances[1].simulateClose(1006);
      vi.advanceTimersByTime(2000);
      expect(MockWebSocket.instances).toHaveLength(3);

      MockWebSocket.instances[2].simulateClose(1006);
      vi.advanceTimersByTime(60000);
      expect(MockWebSocket.instances).toHaveLength(3); // no more retries
    });

    it('does not reconnect after explicit disconnect', () => {
      const client = new CollabClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({
        event: { case: 'roomJoined', value: { clientId: 'c1', sessionId: 's1', peers: [] } },
      });

      client.disconnect();
      vi.advanceTimersByTime(60000);
      expect(MockWebSocket.instances).toHaveLength(1);
    });
  });
});
