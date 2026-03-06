import { describe, it, expect } from 'vitest';
import { PEER_COLORS, getPeerColor, getPeerLabel } from './peerColors';

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
});
