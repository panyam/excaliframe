import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSync } from './useSync';
import type { SyncAdapter, SyncConnection, OutgoingUpdate } from './SyncAdapter';

// ─── Mock adapter ───────────────────────────────

function makeMockAdapter(tool: 'excalidraw' | 'mermaid' = 'excalidraw'): SyncAdapter & {
  _outgoing: OutgoingUpdate | null;
} {
  return {
    tool,
    _outgoing: null,
    computeOutgoing() { return this._outgoing; },
    applyRemote: vi.fn(),
    getSceneSnapshot: vi.fn(() => '{"elements":[]}'),
    applySceneInit: vi.fn(),
    getCursorData: vi.fn(() => null),
    applyRemoteCursor: vi.fn(),
    removePeerCursor: vi.fn(),
  };
}

function makeConnection(overrides: Partial<SyncConnection> = {}): SyncConnection {
  return {
    isConnected: false,
    clientId: '',
    peers: new Map(),
    send: vi.fn(),
    ...overrides,
  };
}

describe('useSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns not initialized by default', () => {
    const adapter = makeMockAdapter();
    const conn = makeConnection();

    const { result } = renderHook(() => useSync(adapter, conn));
    expect(result.current[0].isInitialized).toBe(false);
  });

  it('marks initialized when first peer (no others)', () => {
    const adapter = makeMockAdapter();
    const conn = makeConnection({
      isConnected: true,
      clientId: 'self',
      peers: new Map([['self', { clientId: 'self' }]]),
    });

    const { result } = renderHook(() => useSync(adapter, conn));
    expect(result.current[0].isInitialized).toBe(true);
  });

  it('sends sceneInitRequest when joining with existing peers', () => {
    const adapter = makeMockAdapter();
    const conn = makeConnection({
      isConnected: true,
      clientId: 'self',
      peers: new Map([
        ['self', { clientId: 'self' }],
        ['peer-1', { clientId: 'peer-1' }],
      ]),
    });

    renderHook(() => useSync(adapter, conn));
    expect(conn.send).toHaveBeenCalledWith({ sceneInitRequest: {} });
  });

  it('notifyLocalChange debounces and sends outgoing', () => {
    const adapter = makeMockAdapter();
    adapter._outgoing = { type: 'sceneUpdate', payload: { elements: [{ id: 'el-1' }] } };

    const conn = makeConnection({
      isConnected: true,
      clientId: 'self',
      peers: new Map([['self', { clientId: 'self' }]]),
    });

    const { result } = renderHook(() => useSync(adapter, conn, { outgoingDebounceMs: 100 }));

    act(() => {
      result.current[1].notifyLocalChange();
    });

    // Not sent yet (debounce)
    // conn.send was called once for sceneInitRequest (first peer auto-init doesn't send),
    // but notifyLocalChange shouldn't have fired yet
    const sendMock = conn.send as ReturnType<typeof vi.fn>;
    const callsBefore = sendMock.mock.calls.length;

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(sendMock).toHaveBeenCalledWith({ sceneUpdate: { elements: [{ id: 'el-1' }] } });
  });

  it('notifyLocalChange coalesces rapid calls', () => {
    const adapter = makeMockAdapter();
    let callCount = 0;
    adapter.computeOutgoing = () => {
      callCount++;
      return { type: 'sceneUpdate', payload: { elements: [] } };
    };

    const conn = makeConnection({
      isConnected: true,
      clientId: 'self',
      peers: new Map([['self', { clientId: 'self' }]]),
    });

    const { result } = renderHook(() => useSync(adapter, conn, { outgoingDebounceMs: 100 }));

    // Rapid-fire notifications
    act(() => {
      result.current[1].notifyLocalChange();
      result.current[1].notifyLocalChange();
      result.current[1].notifyLocalChange();
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // computeOutgoing called only once
    expect(callCount).toBe(1);
  });

  it('does not send when computeOutgoing returns null', () => {
    const adapter = makeMockAdapter();
    adapter._outgoing = null; // nothing changed

    const conn = makeConnection({
      isConnected: true,
      clientId: 'self',
      peers: new Map([['self', { clientId: 'self' }]]),
    });

    const { result } = renderHook(() => useSync(adapter, conn));

    act(() => {
      result.current[1].notifyLocalChange();
      vi.advanceTimersByTime(200);
    });

    // send should not have been called (first peer auto-init doesn't send either)
    expect(conn.send).not.toHaveBeenCalled();
  });

  it('resets initialization state on disconnect', () => {
    const adapter = makeMockAdapter();
    const connectedConn = makeConnection({
      isConnected: true,
      clientId: 'self',
      peers: new Map([['self', { clientId: 'self' }]]),
    });

    const { result, rerender } = renderHook(
      ({ conn }) => useSync(adapter, conn),
      { initialProps: { conn: connectedConn } },
    );

    expect(result.current[0].isInitialized).toBe(true);

    // Disconnect
    const disconnectedConn = makeConnection({ isConnected: false });
    rerender({ conn: disconnectedConn });

    expect(result.current[0].isInitialized).toBe(false);
  });
});

describe('useSync handleEvent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('routes sceneUpdate to applyRemote', () => {
    const adapter = makeMockAdapter();
    const conn = makeConnection({ isConnected: true, clientId: 'self', peers: new Map([['self', {}]]) });

    const { result } = renderHook(() => useSync(adapter, conn));
    const payload = { elements: [{ id: 'el-1' }] };

    act(() => {
      result.current[1].handleEvent({ sceneUpdate: payload, fromClientId: 'peer-1' });
    });

    expect(adapter.applyRemote).toHaveBeenCalledWith('peer-1', payload);
  });

  it('routes textUpdate to applyRemote', () => {
    const adapter = makeMockAdapter('mermaid');
    const conn = makeConnection({ isConnected: true, clientId: 'self', peers: new Map([['self', {}]]) });

    const { result } = renderHook(() => useSync(adapter, conn));

    act(() => {
      result.current[1].handleEvent({ textUpdate: { text: 'hello', version: 1 }, fromClientId: 'peer-1' });
    });

    expect(adapter.applyRemote).toHaveBeenCalledWith('peer-1', { text: 'hello', version: 1 });
  });

  it('routes sceneInitResponse to applySceneInit and sets initialized', () => {
    const adapter = makeMockAdapter();
    const conn = makeConnection({
      isConnected: true,
      clientId: 'self',
      peers: new Map([['self', {}], ['peer-1', {}]]),
    });

    const { result } = renderHook(() => useSync(adapter, conn));

    act(() => {
      result.current[1].handleEvent({ sceneInitResponse: { payload: '{"elements":[]}' } });
    });

    expect(adapter.applySceneInit).toHaveBeenCalledWith('{"elements":[]}');
    expect(result.current[0].isInitialized).toBe(true);
  });

  it('responds to sceneInitRequest when designated responder (lowest clientId)', () => {
    const adapter = makeMockAdapter();
    const conn = makeConnection({
      isConnected: true,
      clientId: 'aaa-self',
      peers: new Map([
        ['aaa-self', { clientId: 'aaa-self' }],
        ['bbb-other', { clientId: 'bbb-other' }],
        ['ccc-requester', { clientId: 'ccc-requester' }],
      ]),
    });

    const { result } = renderHook(() => useSync(adapter, conn));

    act(() => {
      result.current[1].handleEvent({ sceneInitRequest: {}, fromClientId: 'ccc-requester' });
    });

    // aaa-self is lowest among non-requester candidates → should respond
    expect(adapter.getSceneSnapshot).toHaveBeenCalled();
    expect(conn.send).toHaveBeenCalledWith({
      sceneInitResponse: { payload: '{"elements":[]}' },
    });
  });

  it('does NOT respond to sceneInitRequest when not designated responder', () => {
    const adapter = makeMockAdapter();
    const conn = makeConnection({
      isConnected: true,
      clientId: 'bbb-self',
      peers: new Map([
        ['aaa-other', { clientId: 'aaa-other' }],
        ['bbb-self', { clientId: 'bbb-self' }],
        ['ccc-requester', { clientId: 'ccc-requester' }],
      ]),
    });

    const { result } = renderHook(() => useSync(adapter, conn));

    act(() => {
      result.current[1].handleEvent({ sceneInitRequest: {}, fromClientId: 'ccc-requester' });
    });

    // aaa-other is lowest → bbb-self should NOT respond
    expect(adapter.getSceneSnapshot).not.toHaveBeenCalled();
    // send may have been called for sceneInitRequest (init sync), but not sceneInitResponse
    const sendCalls = (conn.send as ReturnType<typeof vi.fn>).mock.calls;
    const hasInitResponse = sendCalls.some(
      (call: any) => call[0]?.sceneInitResponse !== undefined,
    );
    expect(hasInitResponse).toBe(false);
  });

  it('routes peerLeft to removePeerCursor', () => {
    const adapter = makeMockAdapter();
    const conn = makeConnection({ isConnected: true, clientId: 'self', peers: new Map([['self', {}]]) });

    const { result } = renderHook(() => useSync(adapter, conn));

    act(() => {
      result.current[1].handleEvent({ peerLeft: { clientId: 'departed' } });
    });

    expect(adapter.removePeerCursor).toHaveBeenCalledWith('departed');
  });

  it('does nothing when adapter is null', () => {
    const conn = makeConnection({ isConnected: true, clientId: 'self', peers: new Map([['self', {}]]) });

    const { result } = renderHook(() => useSync(null, conn));

    // Should not throw
    act(() => {
      result.current[1].handleEvent({ sceneUpdate: { elements: [] }, fromClientId: 'peer-1' });
    });
  });
});
