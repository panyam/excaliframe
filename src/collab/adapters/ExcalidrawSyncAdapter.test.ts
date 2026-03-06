import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Excalidraw's collab utilities before importing the adapter
vi.mock('@excalidraw/excalidraw', () => ({
  hashElementsVersion: vi.fn((elements: any[]) => {
    // Simple hash: sum of all versionNonces
    return elements.reduce((h: number, el: any) => h + (el.versionNonce ?? 0), 0);
  }),
  reconcileElements: vi.fn((_local: any[], remote: any[], _appState: any) => {
    // Simplified reconcile: merge by id, remote wins on higher version
    const merged = new Map<string, any>();
    for (const el of _local) merged.set(el.id, el);
    for (const el of remote) {
      const existing = merged.get(el.id);
      if (!existing || (el.version ?? 0) >= (existing.version ?? 0)) {
        merged.set(el.id, el);
      }
    }
    return Array.from(merged.values());
  }),
}));

vi.mock('../peerColors', () => ({
  getPeerColor: (index: number) => {
    const colors = [
      { background: '#ff6b6b', stroke: '#c92a2a' },
      { background: '#51cf66', stroke: '#2b8a3e' },
    ];
    return colors[index % colors.length];
  },
  getPeerLabel: (index: number) => `User ${index + 1}`,
}));

import { ExcalidrawSyncAdapter } from './ExcalidrawSyncAdapter';

function makeElement(overrides: Record<string, any> = {}) {
  return {
    id: 'el-1',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    version: 1,
    versionNonce: 100,
    updated: Date.now(),
    seed: 12345,
    ...overrides,
  };
}

function makeMockApi(elements: any[] = []) {
  const state = { elements: [...elements] };
  return {
    getSceneElements: () => state.elements,
    getAppState: () => ({ viewBackgroundColor: '#ffffff' }),
    updateScene: vi.fn(({ elements: newEls }: any) => {
      if (newEls) state.elements = [...newEls];
    }),
    _state: state,
  };
}

describe('ExcalidrawSyncAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computeOutgoing', () => {
    it('returns null when no elements', () => {
      const api = makeMockApi([]);
      const adapter = new ExcalidrawSyncAdapter(api);
      expect(adapter.computeOutgoing()).toBeNull();
    });

    it('returns all elements on first call', () => {
      const el = makeElement();
      const api = makeMockApi([el]);
      const adapter = new ExcalidrawSyncAdapter(api);

      const result = adapter.computeOutgoing();
      expect(result).not.toBeNull();
      expect(result!.type).toBe('sceneUpdate');
      const elements = result!.payload.elements as any[];
      expect(elements).toHaveLength(1);
      expect(elements[0].id).toBe('el-1');
      expect(elements[0].version).toBe(1);
    });

    it('returns null on second call with no changes', () => {
      const el = makeElement();
      const api = makeMockApi([el]);
      const adapter = new ExcalidrawSyncAdapter(api);

      adapter.computeOutgoing();
      expect(adapter.computeOutgoing()).toBeNull();
    });

    it('detects element changes via version bump', () => {
      const el = makeElement();
      const api = makeMockApi([el]);
      const adapter = new ExcalidrawSyncAdapter(api);

      adapter.computeOutgoing(); // initial sync

      // Mutate element with new version
      api._state.elements = [makeElement({ x: 50, version: 2, versionNonce: 200 })];
      const result = adapter.computeOutgoing();
      expect(result).not.toBeNull();
      expect((result!.payload.elements as any[])[0].version).toBe(2);
    });

    it('detects new elements added', () => {
      const el1 = makeElement({ id: 'el-1' });
      const api = makeMockApi([el1]);
      const adapter = new ExcalidrawSyncAdapter(api);

      adapter.computeOutgoing();

      const el2 = makeElement({ id: 'el-2', type: 'ellipse', versionNonce: 200 });
      api._state.elements = [el1, el2];
      const result = adapter.computeOutgoing();
      expect(result).not.toBeNull();
      // Should only include the new element (el-1 unchanged)
      expect((result!.payload.elements as any[])).toHaveLength(1);
      expect((result!.payload.elements as any[])[0].id).toBe('el-2');
    });

    it('detects in-place mutation (mutateElement style)', () => {
      // Excalidraw's mutateElement() mutates element objects in place during
      // drag/resize. The SAME object reference stays in the elements array but
      // its version/versionNonce fields change. The adapter must detect this
      // because it stores version snapshots, not object references.
      const el = makeElement({ id: 'el-1', x: 0, version: 1, versionNonce: 100 });
      const api = makeMockApi([el]);
      const adapter = new ExcalidrawSyncAdapter(api);

      adapter.computeOutgoing(); // initial sync — stores version snapshot

      // Simulate in-place mutation: SAME object, changed fields
      el.x = 50;
      el.y = 30;
      el.version = 2;
      el.versionNonce = 200;
      // api._state.elements still contains the same `el` reference

      const result = adapter.computeOutgoing();
      expect(result).not.toBeNull();
      const elements = result!.payload.elements as any[];
      expect(elements).toHaveLength(1);
      expect(elements[0].id).toBe('el-1');
      expect(elements[0].version).toBe(2);
      // Verify the serialized data reflects the mutated position
      const data = JSON.parse(elements[0].data);
      expect(data.x).toBe(50);
      expect(data.y).toBe(30);
    });

    it('handles repeated in-place mutations', () => {
      // Ensure tracking updates correctly after each flush so subsequent
      // in-place mutations are also detected (not just the first one).
      const el = makeElement({ id: 'el-1', x: 0, version: 1, versionNonce: 100 });
      const api = makeMockApi([el]);
      const adapter = new ExcalidrawSyncAdapter(api);

      adapter.computeOutgoing(); // initial sync

      // First mutation (drag start)
      el.x = 10;
      el.version = 2;
      el.versionNonce = 200;
      expect(adapter.computeOutgoing()).not.toBeNull();

      // Second mutation (still dragging) — should also be detected
      el.x = 20;
      el.version = 3;
      el.versionNonce = 300;
      const result = adapter.computeOutgoing();
      expect(result).not.toBeNull();
      expect((result!.payload.elements as any[])[0].version).toBe(3);

      // No change — should return null
      expect(adapter.computeOutgoing()).toBeNull();
    });

    it('detects in-place mutation after applyRemote', () => {
      // After receiving a remote update, ensure in-place local mutations
      // on the same element are still detected for outgoing sync.
      const el = makeElement({ id: 'el-1', x: 0, version: 1, versionNonce: 100 });
      const api = makeMockApi([el]);
      const adapter = new ExcalidrawSyncAdapter(api);

      adapter.computeOutgoing(); // initial sync

      // Receive remote update that bumps version
      const remoteEl = makeElement({ id: 'el-1', x: 30, version: 3, versionNonce: 300 });
      adapter.applyRemote('peer-1', {
        elements: [{
          id: 'el-1', version: 3, versionNonce: 300,
          data: JSON.stringify(remoteEl), deleted: false,
        }],
      });

      // No local change — should return null
      expect(adapter.computeOutgoing()).toBeNull();

      // Now mutate the element in-place locally
      const currentEl = api._state.elements[0];
      currentEl.x = 60;
      currentEl.version = 4;
      currentEl.versionNonce = 400;

      const result = adapter.computeOutgoing();
      expect(result).not.toBeNull();
      expect((result!.payload.elements as any[])[0].version).toBe(4);
    });

    it('detects deleted elements', () => {
      const el = makeElement();
      const api = makeMockApi([el]);
      const adapter = new ExcalidrawSyncAdapter(api);

      adapter.computeOutgoing();

      api._state.elements = [];
      const result = adapter.computeOutgoing();
      expect(result).not.toBeNull();
      expect((result!.payload.elements as any[])[0].deleted).toBe(true);
    });
  });

  describe('applyRemote', () => {
    it('applies remote elements via reconcileElements', () => {
      const local = makeElement({ id: 'el-1', x: 0 });
      const api = makeMockApi([local]);
      const adapter = new ExcalidrawSyncAdapter(api);

      const remoteEl = makeElement({ id: 'el-1', x: 99, version: 2, versionNonce: 200 });
      adapter.applyRemote('peer-1', {
        elements: [{
          id: 'el-1',
          version: 2,
          versionNonce: 200,
          data: JSON.stringify(remoteEl),
          deleted: false,
        }],
      });

      expect(api.updateScene).toHaveBeenCalled();
    });

    it('sets isApplyingRemote during update', () => {
      const api = makeMockApi([]);
      const adapter = new ExcalidrawSyncAdapter(api);
      let flagDuringUpdate = false;

      api.updateScene = vi.fn(() => {
        flagDuringUpdate = adapter.isApplyingRemote;
      });

      const remoteEl = makeElement({ id: 'remote-1' });
      adapter.applyRemote('peer-1', {
        elements: [{
          id: 'remote-1',
          version: 1,
          versionNonce: 100,
          data: JSON.stringify(remoteEl),
          deleted: false,
        }],
      });

      expect(flagDuringUpdate).toBe(true);
      expect(adapter.isApplyingRemote).toBe(false);
    });

    it('does nothing with empty elements', () => {
      const api = makeMockApi([]);
      const adapter = new ExcalidrawSyncAdapter(api);

      adapter.applyRemote('peer-1', { elements: [] });
      expect(api.updateScene).not.toHaveBeenCalled();
    });

    it('updates tracking after applying remote to prevent echo', () => {
      const api = makeMockApi([]);
      const adapter = new ExcalidrawSyncAdapter(api);

      const remoteEl = makeElement({ id: 'el-1' });
      adapter.applyRemote('peer-1', {
        elements: [{
          id: 'el-1', version: 1, versionNonce: 100,
          data: JSON.stringify(remoteEl), deleted: false,
        }],
      });

      // computeOutgoing should return null — nothing local changed
      expect(adapter.computeOutgoing()).toBeNull();
    });
  });

  describe('getSceneSnapshot / applySceneInit', () => {
    it('round-trips scene through snapshot and init', () => {
      const el1 = makeElement({ id: 'el-1', x: 10 });
      const el2 = makeElement({ id: 'el-2', type: 'ellipse', x: 50, versionNonce: 200 });
      const api1 = makeMockApi([el1, el2]);
      const adapter1 = new ExcalidrawSyncAdapter(api1);

      const snapshot = adapter1.getSceneSnapshot();

      const api2 = makeMockApi([]);
      const adapter2 = new ExcalidrawSyncAdapter(api2);
      adapter2.applySceneInit(snapshot);

      expect(api2.updateScene).toHaveBeenCalled();
      expect(api2._state.elements).toHaveLength(2);
      expect(api2._state.elements[0].id).toBe('el-1');
      expect(api2._state.elements[1].id).toBe('el-2');
    });

    it('applySceneInit updates tracking state', () => {
      const el = makeElement({ id: 'el-1', x: 10 });
      const api1 = makeMockApi([el]);
      const adapter1 = new ExcalidrawSyncAdapter(api1);
      const snapshot = adapter1.getSceneSnapshot();

      const api2 = makeMockApi([]);
      const adapter2 = new ExcalidrawSyncAdapter(api2);
      adapter2.applySceneInit(snapshot);

      // After init, computeOutgoing should return null
      expect(adapter2.computeOutgoing()).toBeNull();
    });

    it('sets isApplyingRemote during applySceneInit', () => {
      const api = makeMockApi([]);
      const adapter = new ExcalidrawSyncAdapter(api);
      let flagDuringUpdate = false;

      api.updateScene = vi.fn(() => {
        flagDuringUpdate = adapter.isApplyingRemote;
      });

      const el = makeElement();
      const snapshot = JSON.stringify({
        elements: [{
          id: el.id, version: 1, versionNonce: 100,
          data: JSON.stringify(el), deleted: false,
        }],
      });

      adapter.applySceneInit(snapshot);
      expect(flagDuringUpdate).toBe(true);
      expect(adapter.isApplyingRemote).toBe(false);
    });
  });

  describe('getCursorData', () => {
    it('returns null when no local pointer set', () => {
      const api = makeMockApi([]);
      const adapter = new ExcalidrawSyncAdapter(api);
      expect(adapter.getCursorData()).toBeNull();
    });

    it('returns pointer data after setLocalPointer', () => {
      const api = makeMockApi([]);
      const adapter = new ExcalidrawSyncAdapter(api);

      adapter.setLocalPointer({ x: 100, y: 200, tool: 'pointer' }, 'up');
      const cursor = adapter.getCursorData();
      expect(cursor).toEqual({ x: 100, y: 200, tool: 'pointer', button: 'up' });
    });

    it('reflects latest pointer position', () => {
      const api = makeMockApi([]);
      const adapter = new ExcalidrawSyncAdapter(api);

      adapter.setLocalPointer({ x: 10, y: 20, tool: 'pointer' }, 'up');
      adapter.setLocalPointer({ x: 50, y: 60, tool: 'laser' }, 'down');
      expect(adapter.getCursorData()).toEqual({ x: 50, y: 60, tool: 'laser', button: 'down' });
    });
  });

  describe('applyRemoteCursor', () => {
    it('calls updateScene with collaborators map', () => {
      const api = makeMockApi([]);
      const adapter = new ExcalidrawSyncAdapter(api);

      adapter.applyRemoteCursor({
        clientId: 'peer-1',
        username: 'Alice',
        x: 100,
        y: 200,
        tool: 'pointer',
        button: 'up',
      });

      expect(api.updateScene).toHaveBeenCalledWith({
        collaborators: expect.any(Map),
      });

      const collaborators = api.updateScene.mock.calls[0][0].collaborators as Map<string, any>;
      expect(collaborators.size).toBe(1);
      expect(collaborators.has('peer-1')).toBe(true);
      const collab = collaborators.get('peer-1');
      expect(collab.pointer).toEqual({ x: 100, y: 200, tool: 'pointer' });
      expect(collab.button).toBe('up');
      expect(collab.username).toBe('Alice');
      expect(collab.color).toEqual({ background: '#ff6b6b', stroke: '#c92a2a' });
    });

    it('assigns stable colors per clientId', () => {
      const api = makeMockApi([]);
      const adapter = new ExcalidrawSyncAdapter(api);

      adapter.applyRemoteCursor({ clientId: 'peer-1', username: 'A', x: 0, y: 0 });
      adapter.applyRemoteCursor({ clientId: 'peer-2', username: 'B', x: 0, y: 0 });
      // Update peer-1 again — should keep same color
      adapter.applyRemoteCursor({ clientId: 'peer-1', username: 'A', x: 10, y: 10 });

      const lastCall = api.updateScene.mock.calls[api.updateScene.mock.calls.length - 1][0];
      const collaborators = lastCall.collaborators as Map<string, any>;
      expect(collaborators.get('peer-1').color).toEqual({ background: '#ff6b6b', stroke: '#c92a2a' });
      expect(collaborators.get('peer-2').color).toEqual({ background: '#51cf66', stroke: '#2b8a3e' });
    });

    it('uses getPeerLabel as fallback when username empty', () => {
      const api = makeMockApi([]);
      const adapter = new ExcalidrawSyncAdapter(api);

      adapter.applyRemoteCursor({ clientId: 'peer-1', username: '', x: 0, y: 0 });
      const collaborators = api.updateScene.mock.calls[0][0].collaborators as Map<string, any>;
      expect(collaborators.get('peer-1').username).toBe('User 1');
    });
  });

  describe('removePeerCursor', () => {
    it('removes peer from collaborators and calls updateScene', () => {
      const api = makeMockApi([]);
      const adapter = new ExcalidrawSyncAdapter(api);

      adapter.applyRemoteCursor({ clientId: 'peer-1', username: 'A', x: 0, y: 0 });
      adapter.applyRemoteCursor({ clientId: 'peer-2', username: 'B', x: 0, y: 0 });
      adapter.removePeerCursor('peer-1');

      const lastCall = api.updateScene.mock.calls[api.updateScene.mock.calls.length - 1][0];
      const collaborators = lastCall.collaborators as Map<string, any>;
      expect(collaborators.size).toBe(1);
      expect(collaborators.has('peer-1')).toBe(false);
      expect(collaborators.has('peer-2')).toBe(true);
    });

    it('handles removing non-existent peer gracefully', () => {
      const api = makeMockApi([]);
      const adapter = new ExcalidrawSyncAdapter(api);

      adapter.removePeerCursor('nonexistent');
      expect(api.updateScene).toHaveBeenCalledWith({ collaborators: expect.any(Map) });
    });
  });
});
