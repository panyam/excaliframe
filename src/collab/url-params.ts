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
