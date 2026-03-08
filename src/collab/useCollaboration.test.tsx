import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCollaboration } from './useCollaboration';

// Mock CollabClient
vi.mock('./CollabClient', () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();
  const mockSend = vi.fn();

  class MockCollabClient {
    static lastInstance: MockCollabClient | null = null;
    options: any;
    _isConnected = false;
    _isConnecting = false;
    _clientId = '';

    constructor(options: any) {
      this.options = options;
      MockCollabClient.lastInstance = this;
    }

    get isConnected() { return this._isConnected; }
    get isConnecting() { return this._isConnecting; }
    get clientId() { return this._clientId; }

    connect = mockConnect;
    disconnect = mockDisconnect;
    send = mockSend;

    // Test helpers
    simulateConnect(clientId: string) {
      this._isConnected = true;
      this._isConnecting = false;
      this._clientId = clientId;
      this.options.onConnect?.(clientId);
    }
    simulatePeerJoined(peer: any) { this.options.onPeerJoined?.(peer); }
    simulatePeerLeft(clientId: string) { this.options.onPeerLeft?.(clientId); }
    simulateEvent(event: any) { this.options.onEvent?.(event); }
    simulateError(error: Error) { this.options.onError?.(error); }
    simulateDisconnect() {
      this._isConnected = false;
      this.options.onDisconnect?.();
    }
    simulateErrorEvent(code: string, message: string) {
      this.options.onErrorEvent?.(code, message);
    }
    simulateCredentialsChanged(reason: string) {
      this.options.onCredentialsChanged?.(reason);
    }
    simulateSessionEnded() { this.options.onSessionEnded?.(); }
    simulateOwnerChanged(newOwnerClientId: string) { this.options.onOwnerChanged?.(newOwnerClientId); }
  }

  return {
    CollabClient: MockCollabClient,
    __getMockClient: () => MockCollabClient.lastInstance,
    __getMocks: () => ({ mockConnect, mockDisconnect, mockSend }),
  };
});

describe('useCollaboration', () => {
  let getMockClient: () => any;
  let getMocks: () => { mockConnect: any; mockDisconnect: any; mockSend: any };

  beforeEach(async () => {
    const mod = await import('./CollabClient') as any;
    getMockClient = mod.__getMockClient;
    getMocks = mod.__getMocks;
    getMocks().mockConnect.mockClear();
    getMocks().mockDisconnect.mockClear();
    getMocks().mockSend.mockClear();
    localStorage.clear();
  });

  it('returns initial disconnected state', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    const [state] = result.current;
    expect(state.isConnected).toBe(false);
    expect(state.isConnecting).toBe(false);
    expect(state.clientId).toBe('');
    expect(state.peers.size).toBe(0);
    expect(state.error).toBeNull();
  });

  it('connect() creates CollabClient and calls connect', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    act(() => {
      result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice');
    });
    expect(getMocks().mockConnect).toHaveBeenCalledWith(
      'ws://localhost:8787', 'sess1', 'Alice', 'excalidraw',
      false, expect.any(String), '', false,
    );
  });

  it('updates isConnected after successful connection', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });
    act(() => { getMockClient().simulateConnect('client-1'); });

    expect(result.current[0].isConnected).toBe(true);
    expect(result.current[0].clientId).toBe('client-1');
  });

  it('adds peer on PeerJoined event', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });
    act(() => { getMockClient().simulateConnect('c1'); });
    act(() => {
      getMockClient().simulatePeerJoined({
        clientId: 'c2', username: 'Charlie', avatarUrl: '', clientType: 'browser', isActive: true,
      });
    });

    expect(result.current[0].peers.size).toBe(1);
    expect(result.current[0].peers.get('c2')?.username).toBe('Charlie');
  });

  it('removes peer on PeerLeft event', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });
    act(() => { getMockClient().simulateConnect('c1'); });
    act(() => {
      getMockClient().simulatePeerJoined({
        clientId: 'c2', username: 'Charlie', avatarUrl: '', clientType: 'browser', isActive: true,
      });
    });
    act(() => { getMockClient().simulatePeerLeft('c2'); });

    expect(result.current[0].peers.size).toBe(0);
  });

  it('sets error on connection failure', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });
    act(() => { getMockClient().simulateError(new Error('Connection refused')); });

    expect(result.current[0].error).toBe('Connection refused');
  });

  it('disconnect() disconnects and resets state', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });
    act(() => { getMockClient().simulateConnect('c1'); });
    act(() => {
      result.current[1].disconnect();
      getMockClient().simulateDisconnect();
    });

    expect(result.current[0].isConnected).toBe(false);
    expect(getMocks().mockDisconnect).toHaveBeenCalled();
  });

  it('forwards onEvent callback to caller', () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useCollaboration('excalidraw', onEvent));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });

    const testEvent = { type: 'custom', eventId: 'e1' };
    act(() => { getMockClient().simulateEvent(testEvent); });

    expect(onEvent).toHaveBeenCalledWith(testEvent);
  });

  it('passes correct tool type to connect', () => {
    const { result } = renderHook(() => useCollaboration('mermaid'));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });

    expect(getMocks().mockConnect).toHaveBeenCalledWith(
      'ws://localhost:8787', 'sess1', 'Alice', 'mermaid',
      false, expect.any(String), '', false,
    );
  });

  it('saves relay URL to localStorage on connect', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });

    expect(localStorage.getItem('excaliframe:lastRelayUrl')).toBe('ws://localhost:8787');
  });

  it('saves username to localStorage on connect', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });

    expect(localStorage.getItem('excaliframe:lastUsername')).toBe('Alice');
  });

  it('passes encrypted flag to CollabClient.connect', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice', true, 'd1', true); });

    expect(getMocks().mockConnect).toHaveBeenCalledWith(
      'ws://localhost:8787', 'sess1', 'Alice', 'excalidraw',
      true, expect.any(String), expect.any(String), true,
    );
  });

  it('initial state has roomEncrypted=false and maxPeers=0', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    expect(result.current[0].roomEncrypted).toBe(false);
    expect(result.current[0].maxPeers).toBe(0);
  });

  it('sets roomEncrypted and maxPeers from RoomJoined event', () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useCollaboration('excalidraw', onEvent));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });
    act(() => { getMockClient().simulateConnect('c1'); });
    act(() => {
      getMockClient().simulateEvent({
        roomJoined: { sessionId: 'sess1', ownerClientId: 'c1', encrypted: true, maxPeers: 10 },
      });
    });

    expect(result.current[0].roomEncrypted).toBe(true);
    expect(result.current[0].maxPeers).toBe(10);
  });

  it('sets error on ErrorEvent (ROOM_FULL)', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });
    act(() => { getMockClient().simulateErrorEvent('ROOM_FULL', 'Room is full (10/10)'); });

    expect(result.current[0].error).toBe('ROOM_FULL: Room is full (10/10)');
    expect(result.current[0].isConnecting).toBe(false);
  });

  it('resets state and sets error on CredentialsChanged (password_changed)', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });
    act(() => { getMockClient().simulateConnect('c1'); });
    act(() => { getMockClient().simulateCredentialsChanged('password_changed'); });

    expect(result.current[0].isConnected).toBe(false);
    expect(result.current[0].error).toContain('Password changed');
  });

  it('resets state and sets error on CredentialsChanged (password_removed)', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });
    act(() => { getMockClient().simulateConnect('c1'); });
    act(() => { getMockClient().simulateCredentialsChanged('password_removed'); });

    expect(result.current[0].isConnected).toBe(false);
    expect(result.current[0].error).toContain('Encryption was removed');
  });

  it('notifyCredentialsChanged sends credentialsChanged action', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });
    act(() => { getMockClient().simulateConnect('c1'); });
    act(() => { result.current[1].notifyCredentialsChanged('password_changed'); });

    expect(getMocks().mockSend).toHaveBeenCalledWith({ credentialsChanged: { reason: 'password_changed' } });
  });

  it('sets error and resets on SessionEnded', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });
    act(() => { getMockClient().simulateConnect('c1'); });
    act(() => { getMockClient().simulateSessionEnded(); });

    expect(result.current[0].isConnected).toBe(false);
    expect(result.current[0].error).toContain('owner ended');
  });

  it('updates owner on OwnerChanged event', () => {
    const { result } = renderHook(() => useCollaboration('excalidraw'));
    act(() => { result.current[1].connect('ws://localhost:8787', 'sess1', 'Alice'); });
    act(() => { getMockClient().simulateConnect('c1'); });
    act(() => { getMockClient().simulateOwnerChanged('c1'); });

    expect(result.current[0].ownerClientId).toBe('c1');
    expect(result.current[0].isOwner).toBe(true);
  });
});
