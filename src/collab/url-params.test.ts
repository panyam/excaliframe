import { describe, it, expect } from 'vitest';
import { parseConnectParam, buildConnectUrl, resolveRelayUrl } from './url-params';

describe('parseConnectParam', () => {
  it('returns null when no connect param', () => {
    expect(parseConnectParam('?foo=bar')).toBeNull();
  });

  it('returns null for empty search string', () => {
    expect(parseConnectParam('')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseConnectParam(undefined)).toBeNull();
  });

  it('returns relay URL from connect param', () => {
    expect(parseConnectParam('?connect=/relay')).toBe('/relay');
  });

  it('returns full ws:// URL from connect param', () => {
    expect(parseConnectParam('?connect=ws://localhost:8787/relay')).toBe('ws://localhost:8787/relay');
  });

  it('decodes URI-encoded values', () => {
    expect(parseConnectParam('?connect=wss%3A%2F%2Fexample.com%2Frelay')).toBe('wss://example.com/relay');
  });

  it('ignores other params', () => {
    expect(parseConnectParam('?foo=bar&connect=/relay&baz=1')).toBe('/relay');
  });
});

describe('resolveRelayUrl', () => {
  it('returns ws:// URLs unchanged', () => {
    expect(resolveRelayUrl('ws://localhost:8787/relay')).toBe('ws://localhost:8787/relay');
  });

  it('returns wss:// URLs unchanged', () => {
    expect(resolveRelayUrl('wss://example.com/relay')).toBe('wss://example.com/relay');
  });

  it('resolves relative path to ws:// URL using window.location', () => {
    // jsdom sets window.location to http://localhost by default
    const resolved = resolveRelayUrl('/relay');
    expect(resolved).toMatch(/^ws:\/\/localhost/);
    expect(resolved).toContain('/relay');
  });
});

describe('buildConnectUrl', () => {
  it('appends connect param to page URL', () => {
    const url = buildConnectUrl('http://localhost:8080/edit/abc', '/relay');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('connect')).toBe('/relay');
    expect(parsed.pathname).toBe('/edit/abc');
  });

  it('encodes relay URL with special characters', () => {
    const url = buildConnectUrl('http://localhost:8080/edit', 'wss://example.com/relay');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('connect')).toBe('wss://example.com/relay');
  });

  it('preserves existing path', () => {
    const url = buildConnectUrl('http://localhost:8080/playground/abc/edit', '/relay');
    expect(url).toContain('/playground/abc/edit');
  });
});
