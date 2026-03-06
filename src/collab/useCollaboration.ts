import { useState, useCallback, useRef } from 'react';
import { CollabClient } from './CollabClient';
import type { PeerInfo } from './types';

export interface CollabState {
  isConnected: boolean;
  isConnecting: boolean;
  clientId: string;
  peers: Map<string, PeerInfo>;
  error: string | null;
}

export interface CollabActions {
  connect: (relayUrl: string, sessionId: string, username: string) => void;
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
    peers: new Map(),
    error: null,
  });

  const clientRef = useRef<CollabClient | null>(null);

  const connect = useCallback((relayUrl: string, sessionId: string, username: string) => {
    // Persist to localStorage
    localStorage.setItem('excaliframe:lastRelayUrl', relayUrl);
    localStorage.setItem('excaliframe:lastUsername', username);

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
        setState(s => ({ ...s, isConnected: false, clientId: '', peers: new Map() }));
      },
      onEvent: onEvent,
    });

    clientRef.current = client;
    client.connect(relayUrl, sessionId, username, tool);
  }, [tool, onEvent]);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const send = useCallback((action: Record<string, unknown>) => {
    clientRef.current?.send(action);
  }, []);

  return [state, { connect, disconnect, send }];
}
