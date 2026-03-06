/**
 * Parse the ?connect=<relay-url> query parameter.
 * Returns the relay URL string, or null if not present.
 */
export function parseConnectParam(search?: string): string | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  return params.get('connect') || null;
}

/**
 * Resolve a relay URL that may be relative (e.g. "/relay") to a full
 * WebSocket URL based on the current page location.
 */
export function resolveRelayUrl(relayUrl: string): string {
  // Already a ws:// or wss:// URL
  if (/^wss?:\/\//i.test(relayUrl)) return relayUrl;

  // Relative path — resolve against current page origin
  if (typeof window !== 'undefined' && window.location) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${relayUrl}`;
  }

  return relayUrl;
}

/**
 * Append ?connect=<relay-url> to a page URL.
 * Used for "Copy Link" to share a collaboration link.
 */
export function buildConnectUrl(pageUrl: string, relayUrl: string): string {
  const url = new URL(pageUrl);
  url.searchParams.set('connect', relayUrl);
  return url.toString();
}

/**
 * Encode a join code: base64url(relayWsUrl):sessionId:drawingId
 * Used for cross-origin sharing via /join/<code> URLs.
 */
export function encodeJoinCode(relayUrl: string, sessionId: string, drawingId: string): string {
  const encoded = btoa(relayUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encoded}:${sessionId}:${drawingId}`;
}

/**
 * Decode a join code back to relay URL, session ID, and drawing ID.
 * Returns null if the code is malformed.
 */
export function decodeJoinCode(code: string): { relayUrl: string; sessionId: string; drawingId: string } | null {
  const firstColon = code.indexOf(':');
  if (firstColon < 0) return null;
  const b64 = code.substring(0, firstColon);
  const rest = code.substring(firstColon + 1);
  const secondColon = rest.indexOf(':');
  if (secondColon < 0) return null;
  const sessionId = rest.substring(0, secondColon);
  const drawingId = rest.substring(secondColon + 1);
  if (!sessionId || !drawingId) return null;
  try {
    const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
    const relayUrl = atob(padded);
    return { relayUrl, sessionId, drawingId };
  } catch {
    return null;
  }
}
