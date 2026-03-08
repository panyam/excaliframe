import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GRPCWSClient } from '@panyam/servicekit-client';
import type { MockController } from '@panyam/servicekit-client';
import { CollabClient } from './CollabClient';

// ─── Flush microtasks (GRPCWSClient.connect() is Promise-based) ──

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// ─── Test helper ─────────────────────────────────
// Each CollabClient gets a _grpcFactory that creates mock GRPCWSClients.
// The controllers array tracks all mock instances (important for reconnect tests).

function createTestClient(options: ConstructorParameters<typeof CollabClient>[0] = {}) {
  const controllers: MockController[] = [];
  const client = new CollabClient({
    ...options,
    _grpcFactory: () => {
      const { client: grpc, controller } = GRPCWSClient.createMock();
      controllers.push(controller);
      return grpc;
    },
  });
  return { client, controllers };
}

/** Connect a test client through the full handshake (open + roomJoined). */
async function connectAndJoin(
  client: CollabClient,
  ctrl: MockController,
  opts: { clientId?: string; sessionId?: string } = {},
) {
  ctrl.simulateOpen();
  await flushPromises();
  // Standard protobuf JSON: oneof fields at top level
  ctrl.simulateMessage({
    roomJoined: {
      clientId: opts.clientId ?? 'c1',
      sessionId: opts.sessionId ?? 'sess1',
      peers: [],
    },
  });
}

// ─── Tests ──────────────────────────────────────

describe('CollabClient', () => {
  describe('constructor', () => {
    it('creates instance with default disconnected state', () => {
      const client = new CollabClient();
      expect(client.isConnected).toBe(false);
      expect(client.isConnecting).toBe(false);
      expect(client.clientId).toBe('');
    });
  });

  describe('connect', () => {
    it('sets isConnecting to true while connecting', () => {
      const { client } = createTestClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      expect(client.isConnecting).toBe(true);
      expect(client.isConnected).toBe(false);
    });

    it('sends JoinRoom action on WebSocket open', async () => {
      const { client, controllers } = createTestClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ctrl = controllers[0];
      ctrl.simulateOpen();
      await flushPromises();

      expect(ctrl.sentMessages).toHaveLength(1);
      const msg = ctrl.sentMessages[0] as any;
      expect(msg.join).toBeDefined();
      expect(msg.join.sessionId).toBe('sess1');
      expect(msg.join.username).toBe('Alice');
      expect(msg.join.tool).toBe('excalidraw');
      expect(msg.join.clientType).toBe('browser');
    });

    it('sets isConnected after receiving RoomJoined event', async () => {
      const onConnect = vi.fn();
      const { client, controllers } = createTestClient({ onConnect });
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      await connectAndJoin(client, controllers[0], { clientId: 'client-123' });

      expect(client.isConnected).toBe(true);
      expect(client.isConnecting).toBe(false);
      expect(client.clientId).toBe('client-123');
      expect(onConnect).toHaveBeenCalledWith('client-123');
    });

    it('dispatches self as peer on roomJoined', async () => {
      const onPeerJoined = vi.fn();
      const { client, controllers } = createTestClient({ onPeerJoined });
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      await connectAndJoin(client, controllers[0]);

      // Self-peer dispatched during roomJoined processing
      expect(onPeerJoined).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'c1', username: 'Alice' }),
      );
    });

    it('dispatches existing peers from roomJoined', async () => {
      const onPeerJoined = vi.fn();
      const { client, controllers } = createTestClient({ onPeerJoined });
      client.connect('ws://localhost:8787', 'sess1', 'Bob', 'excalidraw');
      const ctrl = controllers[0];
      ctrl.simulateOpen();
      await flushPromises();

      // Server sends roomJoined with one existing peer
      ctrl.simulateMessage({
        roomJoined: {
          clientId: 'c2',
          sessionId: 'sess1',
          peers: [{ clientId: 'c1', username: 'Alice', avatarUrl: '', clientType: 'browser', isActive: true }],
        },
      });

      // Self-peer (Bob) + existing peer (Alice)
      expect(onPeerJoined).toHaveBeenCalledTimes(2);
      expect(onPeerJoined).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'c2', username: 'Bob' }));
      expect(onPeerJoined).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'c1', username: 'Alice' }));
    });

    it('calls onPeerJoined callback when peer joins later', async () => {
      const onPeerJoined = vi.fn();
      const { client, controllers } = createTestClient({ onPeerJoined });
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ctrl = controllers[0];
      await connectAndJoin(client, ctrl);
      onPeerJoined.mockClear(); // clear the self-peer call

      ctrl.simulateMessage({
        peerJoined: {
          peer: { clientId: 'c2', username: 'Bob', avatarUrl: '', clientType: 'browser', isActive: true },
        },
      });

      expect(onPeerJoined).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'c2', username: 'Bob' }),
      );
    });

    it('calls onPeerLeft callback when peer leaves', async () => {
      const onPeerLeft = vi.fn();
      const { client, controllers } = createTestClient({ onPeerLeft });
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ctrl = controllers[0];
      await connectAndJoin(client, ctrl);

      ctrl.simulateMessage({
        peerLeft: { clientId: 'c2', reason: 'disconnected', peerCount: 1 },
      });

      expect(onPeerLeft).toHaveBeenCalledWith('c2');
    });

    it('calls onEvent callback for all received events', async () => {
      const onEvent = vi.fn();
      const { client, controllers } = createTestClient({ onEvent });
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ctrl = controllers[0];
      ctrl.simulateOpen();
      await flushPromises();

      ctrl.simulateMessage({ roomJoined: { clientId: 'c1', sessionId: 's1', peers: [] } });
      ctrl.simulateMessage({ peerJoined: { peer: { clientId: 'c2' } } });

      expect(onEvent).toHaveBeenCalledTimes(2);
    });

    it('calls onError callback on error', () => {
      const onError = vi.fn();
      const { client, controllers } = createTestClient({ onError });
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      controllers[0].simulateError('connection failed');

      expect(onError).toHaveBeenCalled();
    });

    it('calls onDisconnect callback on close', async () => {
      const onDisconnect = vi.fn();
      const { client, controllers } = createTestClient({ onDisconnect });
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ctrl = controllers[0];
      await connectAndJoin(client, ctrl);

      ctrl.simulateClose(1000);

      expect(onDisconnect).toHaveBeenCalled();
    });

    it('throws if already connected', async () => {
      const { client, controllers } = createTestClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      await connectAndJoin(client, controllers[0]);

      expect(() => {
        client.connect('ws://localhost:8787', 'sess2', 'Alice', 'excalidraw');
      }).toThrow();
    });
  });

  describe('disconnect', () => {
    it('sends LeaveRoom action before closing', async () => {
      const { client, controllers } = createTestClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ctrl = controllers[0];
      await connectAndJoin(client, ctrl);

      const beforeCount = ctrl.sentMessages.length;
      client.disconnect();

      const newMessages = ctrl.sentMessages.slice(beforeCount);
      expect(newMessages).toHaveLength(1);
      expect((newMessages[0] as any).leave).toMatchObject({ reason: 'user disconnected' });
    });

    it('resets state to disconnected', async () => {
      const { client, controllers } = createTestClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      await connectAndJoin(client, controllers[0]);

      client.disconnect();
      expect(client.isConnected).toBe(false);
      expect(client.isConnecting).toBe(false);
    });

    it('fires onDisconnect synchronously', async () => {
      const onDisconnect = vi.fn();
      const { client, controllers } = createTestClient({ onDisconnect });
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      await connectAndJoin(client, controllers[0]);

      client.disconnect();
      // onDisconnect should have been called synchronously (not waiting for async onClose)
      expect(onDisconnect).toHaveBeenCalledTimes(1);
      expect(client.isConnected).toBe(false);
    });

    it('is a no-op if not connected', () => {
      const { client } = createTestClient();
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe('send', () => {
    it('sends action with clientId and timestamp', async () => {
      const { client, controllers } = createTestClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ctrl = controllers[0];
      await connectAndJoin(client, ctrl);

      const beforeCount = ctrl.sentMessages.length;
      client.send({ presence: { isActive: true, username: 'Alice' } });

      const newMessages = ctrl.sentMessages.slice(beforeCount);
      expect(newMessages).toHaveLength(1);
      const msg = newMessages[0] as any;
      expect(msg.clientId).toBe('c1');
      expect(msg.timestamp).toBeDefined();
    });

    it('throws if not connected', () => {
      const { client } = createTestClient();
      expect(() => client.send({ presence: { isActive: true } })).toThrow();
    });
  });

  describe('reconnect', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('does not reconnect after unexpected disconnect', async () => {
      const { client, controllers } = createTestClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      const ctrl = controllers[0];
      ctrl.simulateOpen();
      await vi.advanceTimersByTimeAsync(0);
      ctrl.simulateMessage({
        roomJoined: { clientId: 'c1', sessionId: 's1', peers: [] },
      });

      ctrl.simulateClose(1006);
      await vi.advanceTimersByTimeAsync(60000);

      // Auto-reconnect is disabled — no new connection should be created
      expect(controllers).toHaveLength(1);
      expect(client.isConnected).toBe(false);
    });

    it('does not reconnect after explicit disconnect', async () => {
      const { client, controllers } = createTestClient();
      client.connect('ws://localhost:8787', 'sess1', 'Alice', 'excalidraw');
      controllers[0].simulateOpen();
      await vi.advanceTimersByTimeAsync(0);
      controllers[0].simulateMessage({
        roomJoined: { clientId: 'c1', sessionId: 's1', peers: [] },
      });

      client.disconnect();
      await vi.advanceTimersByTimeAsync(60000);
      expect(controllers).toHaveLength(1);
    });
  });
});
