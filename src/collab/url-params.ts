import { CollabProps } from './types';

export function parseCollabParams(search?: string): CollabProps | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  const relayUrl = params.get('relay');
  const sessionId = params.get('session');
  if (!relayUrl || !sessionId) return null;

  const username = params.get('user') || `User-${Math.random().toString(36).slice(2, 8)}`;
  return { relayUrl, sessionId, username };
}

export function buildCollabUrl(base: string, props: CollabProps): string {
  const url = new URL(base);
  url.searchParams.set('relay', props.relayUrl);
  url.searchParams.set('session', props.sessionId);
  url.searchParams.set('user', props.username);
  return url.toString();
}
