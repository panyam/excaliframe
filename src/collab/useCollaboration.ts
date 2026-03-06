import { useState, useCallback, useRef } from 'react';
import { CollabClient } from './CollabClient';
import { getBrowserId } from './browserId';
import type { PeerInfo } from './types';

export interface CollabState {
  isConnected: boolean;
  isConnecting: boolean;
  clientId: string;
  sessionId: string;
  peers: Map<string, PeerInfo>;
  error: string | null;
  isOwner: boolean;
  ownerClientId: string;
}

export interface CollabActions {
  /** Connect to relay. sessionId empty = relay generates one (owner). drawingId used to build hint for session reuse. */
  connect: (relayUrl: string, sessionId: string, username: string, isOwner?: boolean, drawingId?: string) => void;
  disconnect: () => void;
  send: (action: Record<string, unknown>) => void;
}

export function useCollaboration(
  tool: 'excalidraw' | 'mermaid',
  onEvent?: (event: any) => void,
): [CollabState, CollabActions] {
  const [state, setState] = useState<CollabState>({
    isConnected: false,
    isConnecting: false,
    clientId: '',
    sessionId: '',
    peers: new Map(),
    error: null,
    isOwner: false,
    ownerClientId: '',
  });

  const clientRef = useRef<CollabClient | null>(null);

  const connect = useCallback((relayUrl: string, sessionId: string, username: string, isOwner: boolean = false, drawingId?: string) => {
    // Persist to localStorage
    localStorage.setItem('excaliframe:lastRelayUrl', relayUrl);
    if (username) localStorage.setItem('excaliframe:lastUsername', username);

    const browserId = getBrowserId();
    const clientHint = drawingId ? `${browserId}:${drawingId}` : '';

    const client = new CollabClient({
      onConnect: (clientId) => {
        setState(s => ({ ...s, isConnected: true, isConnecting: false, clientId, error: null }));
      },
      onPeerJoined: (peer) => {
        setState(s => {
          const peers = new Map(s.peers);
          peers.set(peer.clientId, peer);
          return { ...s, peers };
        });
      },
      onPeerLeft: (clientId) => {
        setState(s => {
          const peers = new Map(s.peers);
          peers.delete(clientId);
          return { ...s, peers };
        });
      },
      onError: (err) => {
        setState(s => ({ ...s, error: err.message }));
      },
      onDisconnect: () => {
        if (isOwner && drawingId) {
          localStorage.removeItem(`excaliframe:activeSession:${drawingId}`);
        }
        setState(s => ({ ...s, isConnected: false, isConnecting: false, clientId: '', sessionId: '', peers: new Map(), isOwner: false, ownerClientId: '' }));
      },
      onSessionEnded: () => {
        setState(s => ({
          ...s,
          isConnected: false,
          isConnecting: false,
          clientId: '',
          sessionId: '',
          peers: new Map(),
          isOwner: false,
          ownerClientId: '',
          error: 'The owner ended the sharing session',
        }));
      },
      onOwnerChanged: (newOwnerClientId) => {
        setState(s => ({
          ...s,
          ownerClientId: newOwnerClientId,
          isOwner: s.clientId === newOwnerClientId,
        }));
      },
      onEvent: (event) => {
        // Extract ownerClientId and sessionId from RoomJoined
        if (event.roomJoined) {
          const ownerClientId = event.roomJoined.ownerClientId || '';
          const returnedSessionId = event.roomJoined.sessionId || sessionId;
          setState(s => ({
            ...s,
            sessionId: returnedSessionId,
            ownerClientId,
            isOwner: s.clientId === ownerClientId || isOwner,
          }));
          // Store session mappings in localStorage for same-origin auto-connect and join code reuse
          if (drawingId && returnedSessionId) {
            localStorage.setItem(`excaliframe:sessionDrawing:${returnedSessionId}`, drawingId);
            if (isOwner) {
              localStorage.setItem(`excaliframe:activeSession:${drawingId}`, returnedSessionId);
            }
          }
        }
        onEvent?.(event);
      },
    });

    clientRef.current = client;
    setState(s => ({ ...s, isConnecting: true, error: null }));
    client.connect(relayUrl, sessionId, username, tool, isOwner, browserId, clientHint);
  }, [tool, onEvent]);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const send = useCallback((action: Record<string, unknown>) => {
    clientRef.current?.send(action);
  }, []);

  return [state, { connect, disconnect, send }];
}
