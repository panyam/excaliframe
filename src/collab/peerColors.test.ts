import { describe, it, expect } from 'vitest';
import { PEER_COLORS, getPeerColor, getPeerLabel, hashClientIdToColorIndex } from './peerColors';

describe('peerColors', () => {
  describe('getPeerColor', () => {
    it('returns distinct colors for indices 0-7', () => {
      const colors = new Set<string>();
      for (let i = 0; i < 8; i++) {
        colors.add(getPeerColor(i).background);
      }
      expect(colors.size).toBe(8);
    });

    it('cycles back after exhausting palette', () => {
      expect(getPeerColor(0)).toEqual(getPeerColor(8));
      expect(getPeerColor(1)).toEqual(getPeerColor(9));
    });

    it('returns background and stroke for each color', () => {
      const color = getPeerColor(0);
      expect(color).toHaveProperty('background');
      expect(color).toHaveProperty('stroke');
      expect(color.background).toMatch(/^#[0-9a-f]{6}$/);
      expect(color.stroke).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  describe('getPeerLabel', () => {
    it('returns 1-based user labels', () => {
      expect(getPeerLabel(0)).toBe('User 1');
      expect(getPeerLabel(1)).toBe('User 2');
      expect(getPeerLabel(9)).toBe('User 10');
    });
  });

  it('PEER_COLORS has 8 entries', () => {
    expect(PEER_COLORS).toHaveLength(8);
  });

  describe('hashClientIdToColorIndex', () => {
    it('returns index in range [0, 7]', () => {
      const ids = ['abc', 'xyz', 'peer-1', 'client-foo-bar', '12345', ''];
      for (const id of ids) {
        const idx = hashClientIdToColorIndex(id);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(PEER_COLORS.length);
      }
    });

    it('is deterministic for same input', () => {
      expect(hashClientIdToColorIndex('peer-1')).toBe(hashClientIdToColorIndex('peer-1'));
    });

    it('produces different indices for different clientIds', () => {
      // With 8 colors and distinct strings, most pairs will differ
      const a = hashClientIdToColorIndex('alice-abc123');
      const b = hashClientIdToColorIndex('bob-xyz789');
      expect(a).not.toBe(b);
    });
  });
});
