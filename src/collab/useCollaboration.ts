import { useState, useCallback, useRef, useEffect } from 'react';
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
  /** true if the room has E2EE enabled (from RoomJoined response). */
  roomEncrypted: boolean;
  /** Max peers allowed by relay (from RoomJoined response). */
  maxPeers: number;
}

export interface CollabActions {
  /** Connect to relay. sessionId empty = relay generates one (owner). drawingId used to build hint for session reuse. encrypted declares E2EE (owner only). */
  connect: (relayUrl: string, sessionId: string, username: string, isOwner?: boolean, drawingId?: string, encrypted?: boolean) => void;
  disconnect: () => void;
  send: (action: Record<string, unknown>) => void;
  /** Broadcast CredentialsChanged event to all peers (owner only). */
  notifyCredentialsChanged: (reason: string) => void;
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
    roomEncrypted: false,
    maxPeers: 0,
  });

  const clientRef = useRef<CollabClient | null>(null);

  const connect = useCallback((relayUrl: string, sessionId: string, username: string, isOwner: boolean = false, drawingId?: string, encrypted: boolean = false) => {
    // Persist to localStorage
    localStorage.setItem('excaliframe:lastRelayUrl', relayUrl);
    if (username) localStorage.setItem('excaliframe:lastUsername', username);

    const browserId = getBrowserId();
    const clientHint = drawingId ? `${browserId}:${drawingId}` : '';

    const client = new CollabClient({
      onConnect: (clientId: string) => {
        setState(s => ({ ...s, isConnected: true, isConnecting: false, clientId, error: null }));
      },
      onPeerJoined: (peer: PeerInfo) => {
        setState(s => {
          const peers = new Map(s.peers);
          peers.set(peer.clientId, peer);
          return { ...s, peers };
        });
      },
      onPeerLeft: (clientId: string) => {
        setState(s => {
          const peers = new Map(s.peers);
          peers.delete(clientId);
          return { ...s, peers };
        });
      },
      onError: (err: Error) => {
        setState(s => ({ ...s, error: err.message }));
      },
      onErrorEvent: (code: string, message: string) => {
        // Graceful rejection from relay (ROOM_FULL, PROTOCOL_VERSION_TOO_OLD, etc.)
        setState(s => ({ ...s, error: `${code}: ${message}`, isConnecting: false }));
      },
      onCredentialsChanged: (reason: string) => {
        setState(s => ({
          ...s,
          isConnected: false,
          isConnecting: false,
          clientId: '',
          sessionId: '',
          peers: new Map(),
          isOwner: false,
          ownerClientId: '',
          roomEncrypted: false,
          maxPeers: 0,
          error: reason === 'password_removed'
            ? 'Encryption was removed — please reconnect'
            : 'Password changed — please reconnect with the new password',
        }));
      },
      onDisconnect: () => {
        if (isOwner && drawingId) {
          localStorage.removeItem(`excaliframe:activeSession:${drawingId}`);
        }
        setState(s => ({ ...s, isConnected: false, isConnecting: false, clientId: '', sessionId: '', peers: new Map(), isOwner: false, ownerClientId: '', roomEncrypted: false, maxPeers: 0 }));
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
          roomEncrypted: false,
          maxPeers: 0,
          error: 'The owner ended the sharing session',
        }));
      },
      onOwnerChanged: (newOwnerClientId: string) => {
        setState(s => ({
          ...s,
          ownerClientId: newOwnerClientId,
          isOwner: s.clientId === newOwnerClientId,
        }));
      },
      onEvent: (event) => {
        // Extract ownerClientId, sessionId, and room capabilities from RoomJoined
        if (event.roomJoined) {
          const ownerClientId = event.roomJoined.ownerClientId || '';
          const returnedSessionId = event.roomJoined.sessionId || sessionId;
          setState(s => ({
            ...s,
            sessionId: returnedSessionId,
            ownerClientId,
            isOwner: s.clientId === ownerClientId || isOwner,
            roomEncrypted: !!event.roomJoined.encrypted,
            maxPeers: event.roomJoined.maxPeers || 0,
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
    client.connect(relayUrl, sessionId, username, tool, isOwner, browserId, clientHint, encrypted);
  }, [tool, onEvent]);

  const disconnect = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    // Capture sessionId before disconnect() resets it
    const sid = client.sessionId;
    client.disconnect();
    // Clean up all session mappings (onDisconnect handles activeSession:{drawingId})
    if (sid) {
      localStorage.removeItem(`excaliframe:sessionDrawing:${sid}`);
      localStorage.removeItem(`excaliframe:sessionPassword:${sid}`);
    }
  }, []);

  const send = useCallback((action: Record<string, unknown>) => {
    clientRef.current?.send(action);
  }, []);

  const notifyCredentialsChanged = useCallback((reason: string) => {
    clientRef.current?.send({ credentialsChanged: { reason } });
  }, []);

  // Disconnect on unmount (page refresh, navigation, etc.)
  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  return [state, { connect, disconnect, send, notifyCredentialsChanged }];
}
