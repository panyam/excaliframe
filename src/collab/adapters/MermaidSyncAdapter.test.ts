import { describe, it, expect, vi } from 'vitest';
import { MermaidSyncAdapter } from './MermaidSyncAdapter';

function makeAdapter(initialCode = 'flowchart TD\n    A --> B') {
  let code = initialCode;
  const setCode = vi.fn((c: string) => { code = c; });
  const getCode = () => code;
  const adapter = new MermaidSyncAdapter(getCode, setCode);
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
});
