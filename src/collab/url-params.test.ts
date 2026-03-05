import { describe, it, expect } from 'vitest';
import { parseCollabParams, buildCollabUrl } from './url-params';

describe('parseCollabParams', () => {
  it('returns null when no relay param', () => {
    expect(parseCollabParams('?session=abc&user=Alice')).toBeNull();
  });

  it('returns null when no session param', () => {
    expect(parseCollabParams('?relay=ws://localhost:8787&user=Alice')).toBeNull();
  });

  it('returns CollabProps with relay, session, and user', () => {
    const result = parseCollabParams('?relay=ws://localhost:8787&session=abc&user=Alice');
    expect(result).toEqual({
      relayUrl: 'ws://localhost:8787',
      sessionId: 'abc',
      username: 'Alice',
    });
  });

  it('generates random username when user param missing', () => {
    const result = parseCollabParams('?relay=ws://localhost:8787&session=abc');
    expect(result).not.toBeNull();
    expect(result!.relayUrl).toBe('ws://localhost:8787');
    expect(result!.sessionId).toBe('abc');
    expect(result!.username).toBeTruthy();
    expect(result!.username.length).toBeGreaterThan(0);
  });

  it('handles wss:// relay URLs', () => {
    const result = parseCollabParams('?relay=wss://relay.example.com&session=s1');
    expect(result!.relayUrl).toBe('wss://relay.example.com');
  });

  it('decodes URI-encoded values', () => {
    const result = parseCollabParams('?relay=ws%3A%2F%2Flocalhost%3A8787&session=test%20session&user=Alice%20B');
    expect(result!.relayUrl).toBe('ws://localhost:8787');
    expect(result!.sessionId).toBe('test session');
    expect(result!.username).toBe('Alice B');
  });

  it('returns null for empty search string', () => {
    expect(parseCollabParams('')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseCollabParams(undefined)).toBeNull();
  });
});

describe('buildCollabUrl', () => {
  it('builds URL with relay, session, user params', () => {
    const url = buildCollabUrl('http://localhost:8080/edit', {
      relayUrl: 'ws://localhost:8787',
      sessionId: 'sess1',
      username: 'Alice',
    });
    expect(url).toContain('relay=');
    expect(url).toContain('session=sess1');
    expect(url).toContain('user=Alice');
    // URL should decode to contain the relay URL
    const parsed = new URL(url);
    expect(parsed.searchParams.get('relay')).toBe('ws://localhost:8787');
  });

  it('preserves existing path', () => {
    const url = buildCollabUrl('http://localhost:8080/playground/abc/edit', {
      relayUrl: 'ws://localhost:8787',
      sessionId: 'sess1',
      username: 'Alice',
    });
    expect(url).toContain('/playground/abc/edit');
  });

  it('encodes special characters', () => {
    const url = buildCollabUrl('http://localhost:8080/edit', {
      relayUrl: 'wss://relay.example.com',
      sessionId: 'test session',
      username: 'Alice & Bob',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('session')).toBe('test session');
    expect(parsed.searchParams.get('user')).toBe('Alice & Bob');
  });
});
