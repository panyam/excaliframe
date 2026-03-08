import { describe, it, expect, vi } from 'vitest';
import { MermaidSyncAdapter } from './MermaidSyncAdapter';

function makeAdapter(initialCode = 'flowchart TD\n    A --> B', onCursorsChange?: () => void) {
  let code = initialCode;
  const setCode = vi.fn((c: string) => { code = c; });
  const getCode = () => code;
  const adapter = new MermaidSyncAdapter(getCode, setCode, onCursorsChange);
  return { adapter, getCode, setCode, setLocalCode: (c: string) => { code = c; } };
}

describe('MermaidSyncAdapter', () => {
  describe('computeOutgoing', () => {
    it('returns null when code has not changed', () => {
      const { adapter } = makeAdapter();
      expect(adapter.computeOutgoing()).toBeNull();
    });

    it('returns textUpdate when code changes', () => {
      const { adapter, setLocalCode } = makeAdapter('original');
      setLocalCode('modified');

      const result = adapter.computeOutgoing();
      expect(result).not.toBeNull();
      expect(result!.type).toBe('textUpdate');
      expect(result!.payload.text).toBe('modified');
      expect(result!.payload.version).toBe(1);
    });

    it('returns null on second call with no further changes', () => {
      const { adapter, setLocalCode } = makeAdapter('original');
      setLocalCode('modified');
      adapter.computeOutgoing();

      expect(adapter.computeOutgoing()).toBeNull();
    });

    it('increments version on each change', () => {
      const { adapter, setLocalCode } = makeAdapter('v0');

      setLocalCode('v1');
      const r1 = adapter.computeOutgoing();
      expect(r1!.payload.version).toBe(1);

      setLocalCode('v2');
      const r2 = adapter.computeOutgoing();
      expect(r2!.payload.version).toBe(2);

      setLocalCode('v3');
      const r3 = adapter.computeOutgoing();
      expect(r3!.payload.version).toBe(3);
    });
  });

  describe('applyRemote', () => {
    it('applies remote text with higher version', () => {
      const { adapter, setCode } = makeAdapter('local text');

      adapter.applyRemote('peer-1', { text: 'remote text', version: 5 });

      expect(setCode).toHaveBeenCalledWith('remote text');
    });

    it('rejects remote text with lower version', () => {
      const { adapter, setLocalCode, setCode } = makeAdapter('v0');
      // Generate some local versions
      setLocalCode('v1');
      adapter.computeOutgoing(); // version 1
      setLocalCode('v2');
      adapter.computeOutgoing(); // version 2
      setLocalCode('v3');
      adapter.computeOutgoing(); // version 3

      setCode.mockClear();
      adapter.applyRemote('peer-1', { text: 'old remote', version: 1 });
      expect(setCode).not.toHaveBeenCalled();
    });

    it('sets isApplyingRemote during update', () => {
      const { adapter } = makeAdapter('initial');
      let flagDuringUpdate = false;

      // Override setCode to capture flag
      const origAdapter = adapter as any;
      const origSetCode = origAdapter.setCode;
      origAdapter.setCode = (code: string) => {
        flagDuringUpdate = adapter.isApplyingRemote;
        origSetCode(code);
      };

      adapter.applyRemote('peer-1', { text: 'remote', version: 5 });
      expect(flagDuringUpdate).toBe(true);
      expect(adapter.isApplyingRemote).toBe(false);
    });

    it('ignores missing text field', () => {
      const { adapter, setCode } = makeAdapter('initial');
      adapter.applyRemote('peer-1', { version: 5 });
      expect(setCode).not.toHaveBeenCalled();
    });
  });

  describe('getSceneSnapshot / applySceneInit', () => {
    it('round-trips text through snapshot and init', () => {
      const { adapter: a1 } = makeAdapter('flowchart TD\n    A --> B');
      const snapshot = a1.getSceneSnapshot();

      const { adapter: a2, setCode } = makeAdapter('');
      a2.applySceneInit(snapshot);

      expect(setCode).toHaveBeenCalledWith('flowchart TD\n    A --> B');
    });

    it('applySceneInit updates version tracking', () => {
      const { adapter: a1, setLocalCode: setLocal1 } = makeAdapter('v0');
      setLocal1('updated text');
      a1.computeOutgoing(); // version 1
      const snapshot = a1.getSceneSnapshot();

      const { adapter: a2 } = makeAdapter('');
      a2.applySceneInit(snapshot);

      // After init, computeOutgoing should return null
      expect(a2.computeOutgoing()).toBeNull();
    });

    it('sets isApplyingRemote during applySceneInit', () => {
      const { adapter } = makeAdapter('');
      let flagDuringUpdate = false;

      const origSetCode = (adapter as any).setCode;
      (adapter as any).setCode = (code: string) => {
        flagDuringUpdate = adapter.isApplyingRemote;
        origSetCode(code);
      };

      adapter.applySceneInit(JSON.stringify({ text: 'init text', version: 0 }));
      expect(flagDuringUpdate).toBe(true);
      expect(adapter.isApplyingRemote).toBe(false);
    });
  });

  describe('cursor tracking', () => {
    describe('getCursorData', () => {
      it('returns null when no selection set', () => {
        const { adapter } = makeAdapter();
        expect(adapter.getCursorData()).toBeNull();
      });

      it('returns {x, y, tool: "text"} after setLocalSelection', () => {
        const { adapter } = makeAdapter();
        adapter.setLocalSelection(5, 10);
        expect(adapter.getCursorData()).toEqual({ x: 5, y: 10, tool: 'text' });
      });

      it('updates on subsequent setLocalSelection calls', () => {
        const { adapter } = makeAdapter();
        adapter.setLocalSelection(0, 0);
        adapter.setLocalSelection(20, 25);
        expect(adapter.getCursorData()).toEqual({ x: 20, y: 25, tool: 'text' });
      });
    });

    describe('applyRemoteCursor', () => {
      it('stores peer with correct line number', () => {
        // "line1\nline2\nline3" — offset 6 is start of line 2
        const { adapter } = makeAdapter('line1\nline2\nline3');
        adapter.applyRemoteCursor({ clientId: 'peer-1', username: 'Alice', x: 6, y: 6 });

        const cursors = adapter.getRemoteCursors();
        expect(cursors.size).toBe(1);
        const c = cursors.get('peer-1')!;
        expect(c.line).toBe(2);
        expect(c.username).toBe('Alice');
      });

      it('fires onCursorsChange callback', () => {
        const cb = vi.fn();
        const { adapter } = makeAdapter('abc', cb);
        adapter.applyRemoteCursor({ clientId: 'peer-1', username: '', x: 0, y: 0 });
        expect(cb).toHaveBeenCalledTimes(1);
      });

      it('assigns stable color for same clientId', () => {
        const { adapter } = makeAdapter('abc');
        adapter.applyRemoteCursor({ clientId: 'peer-1', username: '', x: 0, y: 0 });
        const color1 = adapter.getRemoteCursors().get('peer-1')!.color;

        // Update same peer
        adapter.applyRemoteCursor({ clientId: 'peer-1', username: '', x: 2, y: 2 });
        const color2 = adapter.getRemoteCursors().get('peer-1')!.color;
        expect(color1).toEqual(color2);
      });

      it('assigns different colors to different peers', () => {
        const { adapter } = makeAdapter('abc');
        adapter.applyRemoteCursor({ clientId: 'peer-1', username: '', x: 0, y: 0 });
        adapter.applyRemoteCursor({ clientId: 'peer-2', username: '', x: 0, y: 0 });

        const c1 = adapter.getRemoteCursors().get('peer-1')!.color;
        const c2 = adapter.getRemoteCursors().get('peer-2')!.color;
        expect(c1).not.toEqual(c2);
      });

      it('uses getPeerLabel when username is empty', () => {
        const { adapter } = makeAdapter('abc');
        adapter.applyRemoteCursor({ clientId: 'peer-1', username: '', x: 0, y: 0 });
        const c = adapter.getRemoteCursors().get('peer-1')!;
        expect(c.username).toBe('User 1');
      });
    });

    describe('removePeerCursor', () => {
      it('removes peer and fires callback', () => {
        const cb = vi.fn();
        const { adapter } = makeAdapter('abc', cb);
        adapter.applyRemoteCursor({ clientId: 'peer-1', username: 'A', x: 0, y: 0 });
        adapter.applyRemoteCursor({ clientId: 'peer-2', username: 'B', x: 0, y: 0 });
        cb.mockClear();

        adapter.removePeerCursor('peer-1');
        expect(adapter.getRemoteCursors().size).toBe(1);
        expect(adapter.getRemoteCursors().has('peer-1')).toBe(false);
        expect(cb).toHaveBeenCalledTimes(1);
      });

      it('is a no-op for unknown clientId', () => {
        const cb = vi.fn();
        const { adapter } = makeAdapter('abc', cb);
        adapter.removePeerCursor('nonexistent');
        expect(cb).toHaveBeenCalledTimes(1); // still fires, harmless
      });
    });

    describe('charOffsetToLine', () => {
      it('returns line 1 for offset 0', () => {
        const { adapter } = makeAdapter('hello\nworld');
        adapter.applyRemoteCursor({ clientId: 'p', username: '', x: 0, y: 0 });
        expect(adapter.getRemoteCursors().get('p')!.line).toBe(1);
      });

      it('returns correct line for multi-line text', () => {
        const { adapter } = makeAdapter('a\nb\nc\nd');
        // offset 4 = start of 'c' (line 3): "a\nb\n" = 4 chars
        adapter.applyRemoteCursor({ clientId: 'p', username: '', x: 4, y: 4 });
        expect(adapter.getRemoteCursors().get('p')!.line).toBe(3);
      });

      it('clamps negative offset to line 1', () => {
        const { adapter } = makeAdapter('abc');
        adapter.applyRemoteCursor({ clientId: 'p', username: '', x: -5, y: 0 });
        expect(adapter.getRemoteCursors().get('p')!.line).toBe(1);
      });

      it('handles offset beyond text length', () => {
        const { adapter } = makeAdapter('a\nb');
        // offset 100 → clamps to full text → line 2
        adapter.applyRemoteCursor({ clientId: 'p', username: '', x: 100, y: 0 });
        expect(adapter.getRemoteCursors().get('p')!.line).toBe(2);
      });
    });
  });
});
